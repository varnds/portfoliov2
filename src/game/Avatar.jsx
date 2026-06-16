/**
 * Avatar — the explorable character for play mode. Drops in from the sky, walks
 * on the terrain via WASD / arrows (hold Shift to run), and JUMPS with Space.
 *
 * Split in two so animations rebind correctly when the model is switched:
 *   • Avatar       — owns movement, position (avatarPos), jump, follow camera.
 *                    Writes per-frame intent into a `motion` ref (no re-renders).
 *   • AvatarModel  — owns the GLB + mixer; REMOUNTED on variant change via
 *                    key={avatarVariant} so useAnimations binds to the fresh
 *                    skeleton every switch. Reads `motion` to drive the clips.
 *
 * Clip names vary per model, so clips are matched by name (idle/walk/run/jump).
 * Models with no clips (chicken, banana) get a procedural bob/hop instead.
 */
import React, { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { avatarPos, setLanded, refreshGuideTarget, useGame } from "./gameStore";
import { terrainHeight } from "../scene3d/coords";
import { AVATARS, AVATAR_BY_ID, DEFAULT_AVATAR } from "./avatarConfig";

AVATARS.forEach((a) => useGLTF.preload(a.url));

const WALK_SPEED = 3.4;
const RUN_SPEED = 7.6;
const WALK_REF = 3.0; // ground speed the walk clips are authored for
const RUN_REF = 6.6;
const SPAWN = new THREE.Vector3(0, 42, 16);
const JUMP_DUR = 0.66;
const JUMP_H = 1.7;

function pickClip(names, includes, excludes = []) {
  if (!names || !names.length) return null;
  const rows = names.map((n) => ({ n, l: n.toLowerCase(), last: n.toLowerCase().split("|").pop() }));
  const blocked = (l) => excludes.some((e) => l.includes(e));
  for (const inc of includes) {
    const seg = rows.find((r) => r.last === inc && !blocked(r.l));
    if (seg) return seg.n;
  }
  for (const inc of includes) {
    const hit = rows.find((r) => r.l.includes(inc) && !blocked(r.l));
    if (hit) return hit.n;
  }
  return null;
}

/**
 * The model + animation mixer. Remounted per variant (key) so the mixer always
 * binds to the current skeleton. Driven by the parent's `motion` ref.
 */
function AvatarModel({ cfg, motion }) {
  const rigRef = useRef();
  const { scene, animations } = useGLTF(cfg.url);
  const { actions, names } = useAnimations(animations, rigRef);
  const curAction = useRef(null);

  const clips = useMemo(
    () => ({
      idle: pickClip(names, ["idle"], ["idle_", "idle."]),
      walk: pickClip(names, ["walk"], ["walk_hold", "walk."]),
      run: pickClip(names, ["run", "sprint"], ["run_", "run."]),
      jump: pickClip(names, ["jump_start", "jump"], ["jump_idle", "jump_land", "jump_loop"]),
    }),
    [names],
  );
  const hasClips = !!(names && names.length);

  const rig = useMemo(() => {
    const obj = skeletonClone(scene);
    obj.rotation.set(0, 0, 0);
    obj.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    obj.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        box.union(tmp);
      }
    });
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    obj.position.set(-center.x, -box.min.y, -center.z);
    const scale = cfg.target / Math.max(size.x, size.y, size.z, 0.001);
    return { obj, scale };
  }, [scene, cfg]);

  // Start on idle.
  useEffect(() => {
    if (!actions) return;
    const start = clips.idle || clips.walk || (names && names[0]);
    const a = start && actions[start];
    if (a) {
      a.reset().fadeIn(0.2).play();
      curAction.current = start;
    }
    return () => Object.values(actions).forEach((x) => x && x.stop());
  }, [actions, clips, names]);

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05);
    const { moving, running, jumping, speed } = motion.current;

    if (hasClips && actions) {
      let want;
      if (jumping && clips.jump) want = clips.jump;
      else if (moving) want = running ? clips.run || clips.walk : clips.walk || clips.run;
      else want = clips.idle;
      if (want && want !== curAction.current) {
        if (curAction.current && actions[curAction.current]) actions[curAction.current].fadeOut(0.18);
        const nx = actions[want];
        if (nx) {
          nx.reset();
          nx.setEffectiveWeight(1);
          nx.fadeIn(0.18).play();
        }
        curAction.current = want;
      }
      // sync locomotion playback to ground speed (no foot-sliding)
      const cur = curAction.current && actions[curAction.current];
      if (cur) {
        if (want === clips.walk || want === clips.run) {
          const ref = want === clips.run ? RUN_REF : WALK_REF;
          cur.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / ref, 0.6, 1.7));
        } else {
          cur.setEffectiveTimeScale(1);
        }
      }
      if (rigRef.current) rigRef.current.position.y = 0;
    } else if (rigRef.current) {
      // procedural fallback for clipless models (chicken, banana)
      const t = state.clock.elapsedTime;
      if (moving) {
        rigRef.current.position.y = Math.abs(Math.sin(t * (running ? 13 : 9))) * 0.12;
        rigRef.current.rotation.x = -0.1;
      } else {
        rigRef.current.position.y = Math.sin(t * 2) * 0.03;
        rigRef.current.rotation.x = 0;
      }
    }
  });

  return (
    <group ref={rigRef} scale={rig.scale}>
      <primitive object={rig.obj} />
    </group>
  );
}

export function Avatar() {
  const { camera, gl } = useThree();
  const ref = useRef();
  const keys = useRef({});
  const dropping = useRef(true);
  const guideTimer = useRef(0);
  const jumping = useRef(false);
  const jumpT = useRef(0);
  const motion = useRef({ moving: false, running: false, jumping: false, speed: 0 });
  const tmpFwd = useRef(new THREE.Vector3());
  const tmpRight = useRef(new THREE.Vector3());
  const tmpMove = useRef(new THREE.Vector3());
  const tmpTarget = useRef(new THREE.Vector3());
  // orbit follow camera
  const yaw = useRef(0);
  const pitch = useRef(0.38);
  const dist = useRef(8.5);
  const yawT = useRef(0);
  const pitchT = useRef(0.38);
  const distT = useRef(8.5);
  const drag = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const leadX = useRef(0);
  const leadZ = useRef(0);

  const { playing, avatarVariant, cameraMode } = useGame();
  const cfg = AVATAR_BY_ID[avatarVariant] || AVATAR_BY_ID[DEFAULT_AVATAR];

  useEffect(() => {
    if (!playing) return;
    avatarPos.copy(SPAWN);
    dropping.current = true;
    jumping.current = false;
    setLanded(false);
    const MOVE_KEYS = new Set([
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space",
    ]);
    const down = (e) => {
      keys.current[e.code] = true;
      // Stop the browser from scrolling the page on arrows/space (which would
      // steal the keypress and make movement feel broken).
      if (MOVE_KEYS.has(e.code)) e.preventDefault();
      if (e.code === "Space" && !dropping.current && !jumping.current) {
        jumping.current = true;
        jumpT.current = 0;
      }
    };
    const up = (e) => { keys.current[e.code] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    const el = gl.domElement;
    const onDown = (e) => { drag.current = true; last.current = { x: e.clientX, y: e.clientY }; };
    const onMove = (e) => {
      if (!drag.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      yawT.current -= dx * 0.005;
      pitchT.current = Math.min(1.2, Math.max(0.06, pitchT.current + dy * 0.004));
    };
    const onUp = () => { drag.current = false; };
    const onWheel = (e) => {
      distT.current = Math.min(90, Math.max(3.5, distT.current * (1 + e.deltaY * 0.002)));
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [playing, gl]);

  useFrame((_, dt) => {
    if (!playing || !ref.current) return;
    const d = Math.min(dt, 0.05);
    const groundY = terrainHeight(avatarPos.x, avatarPos.z);
    let moved = false;
    let running = false;
    let speed = 0;

    if (dropping.current) {
      avatarPos.y += (groundY - avatarPos.y) * Math.min(1, d * 3.2);
      if (avatarPos.y <= groundY + 0.06) {
        avatarPos.y = groundY;
        dropping.current = false;
        setLanded(true);
      }
    } else {
      const k = keys.current;
      running = !!(k.ShiftLeft || k.ShiftRight);
      speed = running ? RUN_SPEED : WALK_SPEED;
      const fwd = tmpFwd.current;
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      if (fwd.lengthSq() > 1e-6) fwd.normalize();
      const right = tmpRight.current.crossVectors(fwd, camera.up).normalize();
      const move = tmpMove.current.set(0, 0, 0);
      if (k.KeyW || k.ArrowUp) move.add(fwd);
      if (k.KeyS || k.ArrowDown) move.sub(fwd);
      if (k.KeyD || k.ArrowRight) move.add(right);
      if (k.KeyA || k.ArrowLeft) move.sub(right);
      if (move.lengthSq() > 0) {
        moved = true;
        move.normalize().multiplyScalar(speed * d);
        avatarPos.x += move.x;
        avatarPos.z += move.z;
        ref.current.rotation.y = Math.atan2(move.x, move.z);
      }
      let y = terrainHeight(avatarPos.x, avatarPos.z);
      if (jumping.current) {
        jumpT.current += d;
        const t = jumpT.current / JUMP_DUR;
        if (t >= 1) jumping.current = false;
        else y += JUMP_H * 4 * t * (1 - t);
      }
      avatarPos.y = y;
    }
    ref.current.position.copy(avatarPos);

    // hand intent to the model (read in AvatarModel's useFrame)
    motion.current.moving = moved;
    motion.current.running = running;
    motion.current.jumping = jumping.current;
    motion.current.speed = moved ? speed : 0;

    // normalized horizontal movement direction (for camera modes)
    let mdx = 0;
    let mdz = 0;
    if (moved) {
      const ml = Math.hypot(tmpMove.current.x, tmpMove.current.z) || 1;
      mdx = tmpMove.current.x / ml;
      mdz = tmpMove.current.z / ml;
    }

    // SWING BEHIND ("behind"/"both"): ease the camera yaw toward sitting behind
    // the heading, so forward always goes into the screen. Suppressed while the
    // user is manually dragging.
    if ((cameraMode === "behind" || cameraMode === "both") && moved && !drag.current) {
      const desiredYaw = Math.atan2(-mdx, -mdz);
      let dyaw = desiredYaw - yawT.current;
      dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); // shortest path
      yawT.current += dyaw * Math.min(1, d * 2.6);
    }

    // LEAD ("lead"/"both"): glide a look-ahead offset toward the movement
    // direction so you see more of where you're going; returns to 0 when idle.
    const leadOn = (cameraMode === "lead" || cameraMode === "both") && moved;
    const LEAD = 2.6;
    const tgX = leadOn ? mdx * LEAD : 0;
    const tgZ = leadOn ? mdz * LEAD : 0;
    leadX.current += (tgX - leadX.current) * Math.min(1, d * 3);
    leadZ.current += (tgZ - leadZ.current) * Math.min(1, d * 3);

    // follow camera tracks the GROUND height so jumps read as real lift
    const camBaseY = dropping.current ? avatarPos.y : terrainHeight(avatarPos.x, avatarPos.z);
    const ease = Math.min(1, d * 12);
    yaw.current += (yawT.current - yaw.current) * ease;
    pitch.current += (pitchT.current - pitch.current) * ease;
    dist.current += (distT.current - dist.current) * Math.min(1, d * 10);
    const cp = pitch.current;
    const r = dist.current;
    const fx = avatarPos.x + leadX.current;
    const fz = avatarPos.z + leadZ.current;
    camera.position.set(
      fx + Math.sin(yaw.current) * Math.cos(cp) * r,
      camBaseY + Math.sin(cp) * r + 1.0,
      fz + Math.cos(yaw.current) * Math.cos(cp) * r,
    );
    const target = tmpTarget.current.set(fx, camBaseY + 1.1, fz);
    camera.lookAt(target);

    guideTimer.current += d;
    if (guideTimer.current > 0.4) {
      guideTimer.current = 0;
      refreshGuideTarget();
    }
  });

  if (!playing) return null;
  return (
    <group ref={ref}>
      <Suspense fallback={null}>
        <AvatarModel key={avatarVariant} cfg={cfg} motion={motion} />
      </Suspense>
    </group>
  );
}
