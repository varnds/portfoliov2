/**
 * Avatar — the explorable character for play mode. Drops in from the sky on
 * start, walks on the terrain via WASD / arrows (follow camera), and JUMPS with
 * Space. The selected model comes from the gameStore (avatarVariant) and the
 * roster in avatarConfig. Animation clips are matched by NAME (idle/walk/run/
 * jump) because clip names differ per model; some models have no clips at all
 * (they just slide / hop). Position lives in gameStore (avatarPos) so
 * Discoverables can measure proximity.
 */
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { avatarPos, setLanded, refreshGuideTarget, useGame } from "./gameStore";
import { terrainHeight } from "../scene3d/coords";
import { AVATARS, AVATAR_BY_ID, DEFAULT_AVATAR } from "./avatarConfig";

AVATARS.forEach((a) => useGLTF.preload(a.url));

const SPEED = 11;
const SPAWN = new THREE.Vector3(0, 42, 16);
const JUMP_DUR = 0.66; // seconds
const JUMP_H = 1.7; // peak height (world units)

/**
 * Pick the best-matching clip name. `includes` is tried in priority order;
 * a clip whose LAST "|"-segment equals the token wins first, then any substring
 * match, skipping anything containing an `excludes` token. Returns null if none.
 */
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

export function Avatar() {
  const { camera, gl } = useThree();
  const ref = useRef();
  const keys = useRef({});
  const dropping = useRef(true);
  const guideTimer = useRef(0);
  const tmpFwd = useRef(new THREE.Vector3());
  const tmpRight = useRef(new THREE.Vector3());
  const tmpMove = useRef(new THREE.Vector3());
  const tmpTarget = useRef(new THREE.Vector3());
  // jump state
  const jumping = useRef(false);
  const jumpT = useRef(0);
  // Orbit follow camera (drag to look, wheel to zoom) — damped toward targets.
  const yaw = useRef(0);
  const pitch = useRef(0.38);
  const dist = useRef(8.5);
  const yawT = useRef(0);
  const pitchT = useRef(0.38);
  const distT = useRef(8.5);
  const drag = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  const { playing, avatarVariant } = useGame();
  const cfg = AVATAR_BY_ID[avatarVariant] || AVATAR_BY_ID[DEFAULT_AVATAR];

  const { scene, animations } = useGLTF(cfg.url);
  const rigRef = useRef();
  const { actions, names } = useAnimations(animations, rigRef);
  const curAction = useRef(null);

  // Resolve the clip names for this model.
  const clips = useMemo(
    () => ({
      idle: pickClip(names, ["idle"], ["idle_", "idle."]),
      walk: pickClip(names, ["walk"], ["walk_hold", "walk."]),
      run: pickClip(names, ["run", "sprint"], ["run_", "run."]),
      jump: pickClip(names, ["jump_start", "jump"], ["jump_idle", "jump_land", "jump_loop"]),
    }),
    [names],
  );

  // Build the model: recenter feet to y=0, centered in x/z, scaled to target.
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

  // Play idle once playing / model ready.
  useEffect(() => {
    if (!playing || !actions) return;
    const start = clips.idle || clips.walk || (names && names[0]);
    const a = start && actions[start];
    if (a) {
      a.reset().fadeIn(0.2).play();
      curAction.current = start;
    }
    return () => Object.values(actions).forEach((x) => x && x.stop());
  }, [actions, clips, names, playing]);

  // Spawn + key handlers (Space = jump).
  useEffect(() => {
    if (!playing) return;
    avatarPos.copy(SPAWN);
    dropping.current = true;
    jumping.current = false;
    setLanded(false);
    const down = (e) => {
      keys.current[e.code] = true;
      if (e.code === "Space") {
        e.preventDefault();
        if (!dropping.current && !jumping.current) {
          jumping.current = true;
          jumpT.current = 0;
        }
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

  // Drag-to-orbit + wheel-zoom.
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

    if (dropping.current) {
      avatarPos.y += (groundY - avatarPos.y) * Math.min(1, d * 3.2);
      if (avatarPos.y <= groundY + 0.06) {
        avatarPos.y = groundY;
        dropping.current = false;
        setLanded(true);
      }
    } else {
      const k = keys.current;
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
        move.normalize().multiplyScalar(SPEED * d);
        avatarPos.x += move.x;
        avatarPos.z += move.z;
        ref.current.rotation.y = Math.atan2(move.x, move.z);
      }
      // grounded height + jump arc on top
      let y = terrainHeight(avatarPos.x, avatarPos.z);
      if (jumping.current) {
        jumpT.current += d;
        const t = jumpT.current / JUMP_DUR;
        if (t >= 1) {
          jumping.current = false;
        } else {
          y += JUMP_H * 4 * t * (1 - t); // parabola, peak at t=0.5
        }
      }
      avatarPos.y = y;
    }
    ref.current.position.copy(avatarPos);

    // animation state machine: jump > walk/run > idle
    if (actions) {
      let want;
      if (jumping.current && clips.jump) want = clips.jump;
      else if (moved) want = clips.walk || clips.run;
      else want = clips.idle;
      if (want && want !== curAction.current) {
        if (curAction.current && actions[curAction.current]) actions[curAction.current].fadeOut(0.15);
        const nx = actions[want];
        if (nx) {
          nx.reset();
          nx.setEffectiveWeight(1);
          nx.setEffectiveTimeScale(1);
          nx.fadeIn(0.15).play();
        }
        curAction.current = want;
      }
    }

    // damped orbit follow camera. Track the GROUND height (not the jump arc) so a
    // jump visibly lifts the avatar instead of moving the whole frame with it.
    const camBaseY = dropping.current ? avatarPos.y : terrainHeight(avatarPos.x, avatarPos.z);
    const ease = Math.min(1, d * 12);
    yaw.current += (yawT.current - yaw.current) * ease;
    pitch.current += (pitchT.current - pitch.current) * ease;
    dist.current += (distT.current - dist.current) * Math.min(1, d * 10);
    const cp = pitch.current;
    const r = dist.current;
    camera.position.set(
      avatarPos.x + Math.sin(yaw.current) * Math.cos(cp) * r,
      camBaseY + Math.sin(cp) * r + 1.0,
      avatarPos.z + Math.cos(yaw.current) * Math.cos(cp) * r,
    );
    const target = tmpTarget.current.set(avatarPos.x, camBaseY + 1.1, avatarPos.z);
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
      <group ref={rigRef} scale={rig.scale}>
        <primitive object={rig.obj} />
      </group>
    </group>
  );
}
