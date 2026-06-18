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
import { avatarPos, setLanded, refreshGuideTarget, useGame, chase, resolveCollisions, occlusionMaxDist } from "./gameStore";
import { terrainHeight } from "../scene3d/coords";
import { AVATARS, AVATAR_BY_ID, DEFAULT_AVATAR } from "./avatarConfig";
import { DropBurst, ParachuteCanopy, CometStreak } from "./DropEffects";

AVATARS.forEach((a) => useGLTF.preload(a.url));

const WALK_SPEED = 4.0;
const RUN_SPEED = 8.6;
const WALK_REF = 3.0; // ground speed the walk clips are authored for
const RUN_REF = 6.6;
const SPAWN = new THREE.Vector3(0, 42, 16);
const TRACK_YAW = 0.4; // fixed ¾ camera angle for the calm "Track" mode
const TRACK_PITCH = 0.66; // higher, more top-down so every walk direction is visible without rotating
const JUMP_DUR = 0.66;
const JUMP_H = 1.7;

// ── Entrance "drop" styles (selectable). Each is a quick, frame-pacing-proof 0→1
// timeline. DUR = seconds; FALL(p) = how far the body has fallen (0 = up at the
// spawn height, 1 = on the ground); IMPACT = the p at which the body "arrives"
// (burst fires); KIND = the burst flavour. The squash/scale flair lives in
// AvatarModel and is applied to an INNER group so it never touches rig.scale.
const DROP_DUR = { bounce: 0.95, parachute: 1.7, comet: 2.3, pop: 0.55 };
// Start the fall LOW enough that the avatar is in the (ground-framed) shot for the
// whole descent, so you actually see the entrance instead of it happening above
// the top edge. Parachute starts lowest (a gentle in-frame float); pop doesn't fall.
const DROP_START_Y = { bounce: 12, parachute: 4.5, comet: 11, pop: 0 };
const DROP_IMPACT = { bounce: 0.4, comet: 0.6, parachute: 0.97, pop: 0.04 };
function dropFall(p, style) {
  if (style === "pop") return 1; // no fall — already on the ground, just pops in
  if (style === "comet") {
    // ONE gentle accelerating descent to the ground by 0.6, then it settles (a
    // slow shooting-star arrival, not a crash). The long fall lets the streak read.
    if (p >= 0.6) return 1;
    const f = p / 0.6;
    return f * f; // ease-in, but softer than a cube
  }
  if (style === "parachute") return 1 - Math.pow(1 - Math.min(1, p), 1.8); // gentle, ease-out
  // bounce: a quick plunge, then ONE clean rebound that settles.
  if (p < 0.42) {
    const f = p / 0.42;
    return f * f;
  }
  const r = (p - 0.42) / 0.58;
  return 1 - Math.max(0, Math.sin(r * Math.PI)) * 0.22 * Math.exp(-r * 1.6);
}
function easeOutBack(p) {
  const c1 = 1.70158 * 1.2;
  const c3 = c1 + 1;
  const t = p - 1;
  return 1 + c3 * t * t * t + c1 * t * t;
}

// Critically-damped spring toward a target ANGLE (shortest path). Unlike an
// exponential lerp — which is fastest the instant the target jumps and then
// crawls in asymptotically (the "lag, then snap behind you" feel) — this carries
// angular velocity, so the camera eases in from rest AND eases out, trailing the
// avatar as one continuous motion. `smoothTime` is roughly the seconds to catch
// up. `velRef` is a mutable { current } holding the carried velocity.
function smoothDampAngle(current, target, velRef, smoothTime, dt) {
  const st = Math.max(0.0001, smoothTime);
  const omega = 2 / st;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let delta = current - target; // shortest signed angle
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  const targetAdj = current - delta;
  const temp = (velRef.current + omega * delta) * dt;
  velRef.current = (velRef.current - omega * temp) * exp;
  return targetAdj + (delta + temp) * exp;
}

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
  const flairRef = useRef(); // inner group: drop-in squash/stretch/pop (NEVER rig.scale)
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

    // Soften the exported PBR so the characters read as cute matte toys instead
    // of shiny plastic. The avatar GLBs ship with metalness 0.4 (and some with
    // roughness ~0.27), which gives a metallic sheen plus a hard specular hotspot
    // under the sun. Flatten to fully non-metal + high roughness so they catch
    // light as soft clay/fabric. Materials are cloned so we don't mutate the
    // shared useGLTF cache.
    obj.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const soften = (m) => {
        const m2 = m.clone();
        if ("metalness" in m2) m2.metalness = 0;
        if ("roughness" in m2) m2.roughness = 0.92;
        if ("envMapIntensity" in m2) m2.envMapIntensity = 0;
        return m2;
      };
      o.material = Array.isArray(o.material) ? o.material.map(soften) : soften(o.material);
    });

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
    const { moving, running, jumping, speed, drop, dropStyle } = motion.current;

    // ── DROP-IN flair on the INNER group (composes with rig.scale via multiply, so
    // it can never resize the avatar). Per style: pop scales up with overshoot;
    // bounce/comet stretch on the way down then squash & ring back on impact;
    // parachute just sways. Cleared to identity once the drop is done.
    const f = flairRef.current;
    if (f) {
      if (drop > 0 && drop < 1) {
        if (dropStyle === "pop") {
          const s = Math.max(0.001, easeOutBack(drop));
          f.scale.set(s, s, s);
          f.rotation.set(0, 0, 0);
        } else if (dropStyle === "parachute") {
          f.scale.set(1, 1, 1);
          f.rotation.set(0, 0, Math.sin(state.clock.elapsedTime * 2.1) * 0.12);
        } else if (dropStyle === "comet") {
          // a moderate stretch down the plunge, then a single hard SQUASH that
          // rings out (it crashes and stays).
          let sy;
          if (drop < 0.6) {
            sy = 1 + 0.5 * Math.sin((drop / 0.6) * Math.PI * 0.5);
          } else {
            const r = (drop - 0.6) / 0.4;
            sy = 1 - 0.42 * Math.cos(r * Math.PI * 2.1) * Math.exp(-r * 5);
          }
          const sx = 1 / Math.sqrt(Math.max(0.2, sy));
          f.scale.set(sx, sy, sx);
          f.rotation.set(0, 0, 0);
        } else {
          // bounce: a modest stretch falling, then one squash + gentle rebound.
          let sy;
          if (drop < 0.42) {
            sy = 1 + 0.26 * Math.sin((drop / 0.42) * Math.PI * 0.5);
          } else {
            const r = (drop - 0.42) / 0.58;
            sy = 1 - 0.3 * Math.cos(r * Math.PI * 1.6) * Math.exp(-r * 2.6);
          }
          const sx = 1 / Math.sqrt(Math.max(0.2, sy));
          f.scale.set(sx, sy, sx);
          f.rotation.set(0, 0, 0);
        }
      } else if (f.scale.x !== 1 || f.scale.y !== 1 || f.rotation.z !== 0) {
        f.scale.set(1, 1, 1);
        f.rotation.set(0, 0, 0);
      }
    }

    if (hasClips && actions) {
      let want;
      if (jumping && clips.jump) want = clips.jump;
      else if (moving) want = running ? clips.run || clips.walk : clips.walk || clips.run;
      else want = clips.idle;
      if (want && want !== curAction.current) {
        if (curAction.current && actions[curAction.current]) actions[curAction.current].fadeOut(0.15);
        const nx = actions[want];
        if (nx) {
          nx.reset();
          nx.setEffectiveWeight(1);
          if (want === clips.jump) {
            // play the (short) jump clip ONCE and hold the last pose — looping it
            // for the whole hop is what made the jump stutter/glitch.
            nx.setLoop(THREE.LoopOnce, 1);
            nx.clampWhenFinished = true;
          } else {
            nx.setLoop(THREE.LoopRepeat, Infinity);
            nx.clampWhenFinished = false;
          }
          nx.fadeIn(0.12).play();
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
      <group ref={flairRef}>
        <primitive object={rig.obj} />
      </group>
    </group>
  );
}

export function Avatar() {
  const { camera, gl } = useThree();
  const ref = useRef();
  const keys = useRef({});
  const dropping = useRef(true);
  const dropT = useRef(0); // 0→1 elapsed-time progress of the entrance
  const dropStyleRef = useRef("bounce"); // locked at spawn so it can't change mid-drop
  const burstFired = useRef(false); // impact dust/sparkle fired once
  const poofSeq = useRef(0); // bump → DropBurst fires
  const poofKind = useRef("dust"); // "dust" | "sparkle"
  const canopyRef = useRef(0); // 0→1 parachute-canopy scale/opacity
  const streakRef = useRef(0); // 0→1 comet streak visibility
  const shakeRef = useRef(0); // comet impact camera shake amount
  const guideTimer = useRef(0);
  const jumping = useRef(false);
  const jumpT = useRef(0);
  const motion = useRef({ moving: false, running: false, jumping: false, speed: 0, drop: 0, dropStyle: "bounce" });
  const tmpFwd = useRef(new THREE.Vector3());
  const tmpRight = useRef(new THREE.Vector3());
  const tmpMove = useRef(new THREE.Vector3());
  const tmpTarget = useRef(new THREE.Vector3());
  // orbit follow camera
  const yaw = useRef(0);
  const pitch = useRef(0.38);
  const dist = useRef(8.5);
  const occlR = useRef(8.5); // smoothed camera radius after occlusion pull-in
  const yawVel = useRef(0); // carried angular velocity for the follow spring
  const inDirX = useRef(0); // last raw input direction (camera target source)
  const inDirZ = useRef(1);
  const yawT = useRef(0);
  const pitchT = useRef(0.38);
  const distT = useRef(8.5);
  const drag = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const leadX = useRef(0);
  const leadZ = useRef(0);
  const headX = useRef(0); // smoothed heading (movement dir)
  const headZ = useRef(1);
  const focus = useRef(null); // smoothed camera focus point
  const idle = useRef(0); // seconds since last movement
  const deathT = useRef(0); // seconds into the death topple (0 = alive)

  const { playing, avatarVariant, cameraMode, cameraDist, dropStyle, welcomeSeen } = useGame();
  const cfg = AVATAR_BY_ID[avatarVariant] || AVATAR_BY_ID[DEFAULT_AVATAR];
  // live mirror so the frame loop can gate the drop on the welcome modal being
  // dismissed, without re-subscribing.
  const welcomeSeenRef = useRef(welcomeSeen);
  welcomeSeenRef.current = welcomeSeen;

  // Near / Far framing preset → snap the camera distance target (scroll can still
  // fine-tune afterward).
  useEffect(() => {
    distT.current = cameraDist === "far" ? 15 : 8.5;
  }, [cameraDist]);

  useEffect(() => {
    if (!playing) return;
    avatarPos.copy(SPAWN);
    dropping.current = true;
    // lock the entrance style for this run + reset its timeline/effects
    dropStyleRef.current = dropStyle;
    motion.current.dropStyle = dropStyle;
    motion.current.drop = 0;
    dropT.current = 0;
    burstFired.current = false;
    canopyRef.current = 0;
    streakRef.current = 0;
    shakeRef.current = 0;
    jumping.current = false;
    focus.current = null; // re-center the camera focus on spawn
    yawVel.current = 0; // clear follow-spring momentum
    idle.current = 0;
    deathT.current = 0; // alive again on (re)start
    if (ref.current) ref.current.rotation.set(0, ref.current.rotation.y, 0);
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

  useFrame((frameState, dt) => {
    if (!playing || !ref.current) return;
    const d = Math.min(dt, 0.05);
    const slowed = chase.slowedUntil > frameState.clock.elapsedTime; // soft-tag by the chaser
    const groundY = terrainHeight(avatarPos.x, avatarPos.z);
    let moved = false;
    let running = false;
    let speed = 0;

    // ── DEATH: caught 3 times. Stop all movement and play a one-shot topple —
    // the avatar tips onto its side (rotation.z → ~90°) and sinks slightly, then
    // stays down. Procedural (the GLBs ship no death clip). Reset on new game via
    // deathT=0 in the spawn effect. Read the non-reactive mirror per-frame.
    if (chase.dead) {
      deathT.current = Math.min(0.8, deathT.current + d);
      const k = THREE.MathUtils.clamp(deathT.current / 0.8, 0, 1);
      const e = 1 - Math.pow(1 - k, 3); // easeOutCubic
      ref.current.rotation.z = e * (Math.PI / 2); // topple onto its side
      ref.current.rotation.x = 0;
      // sink a touch into the ground as it falls
      avatarPos.y = terrainHeight(avatarPos.x, avatarPos.z) - e * 0.22;
      ref.current.position.copy(avatarPos);
      motion.current.moving = false;
      motion.current.running = false;
      motion.current.jumping = false;
      motion.current.speed = 0;
      return; // freeze camera + everything else on death
    }

    // ── PAUSE-TO-READ: frozen while reading an artifact reveal. Hold the avatar
    // in place (no input, no jump), but keep the camera framing alive below so
    // the world doesn't lock up. Read the non-reactive mirror per-frame.
    if (chase.paused) {
      avatarPos.y = dropping.current ? avatarPos.y : terrainHeight(avatarPos.x, avatarPos.z);
      ref.current.position.copy(avatarPos);
      motion.current.moving = false;
      motion.current.running = false;
      motion.current.jumping = false;
      motion.current.speed = 0;
      return;
    }

    if (dropping.current && !welcomeSeenRef.current) {
      // WAIT for the welcome modal to be dismissed before the entrance plays —
      // the avatar stays up out of frame (hidden below) while the camera holds on
      // the spawn ground, so the modal sits over a clean establishing shot. The
      // moment you hit "Start exploring", the drop begins as a clear reveal.
      avatarPos.y = SPAWN.y;
      motion.current.drop = 0;
      ref.current.position.copy(avatarPos);
      ref.current.visible = false;
      motion.current.moving = false;
      motion.current.running = false;
      motion.current.jumping = false;
      motion.current.speed = 0;
    } else if (dropping.current) {
      ref.current.visible = true;
      // Drive the whole entrance off an accumulated 0→1 timeline (frame-pacing-
      // proof: a throttled rAF can't stall it). Height + flair + burst all key off
      // `p` and the locked drop style.
      const style = dropStyleRef.current;
      dropT.current = Math.min(1, dropT.current + d / (DROP_DUR[style] || 0.85));
      const p = dropT.current;
      const top = groundY + (DROP_START_Y[style] ?? 12);
      avatarPos.y = top + (groundY - top) * dropFall(p, style);
      motion.current.drop = p;
      // parachute canopy: fade in, hold, fade out near touchdown
      let cy = 0;
      if (style === "parachute") {
        if (p < 0.1) cy = p / 0.1;
        else if (p > 0.88) cy = Math.max(0, 1 - (p - 0.88) / 0.12);
        else cy = 1;
      }
      canopyRef.current = cy;
      // comet streak: a stretched trail above the avatar during the plunge.
      streakRef.current = style === "comet" && p < 0.6 ? Math.min(1, p * 5) : 0;
      // fire the impact flair once, at the style's arrival moment. The SEASON
      // ground burst (FootstepEffects, on touchdown) kicks up the dust for every
      // style; here we only add the magical SPARKLE for parachute/pop, and a
      // gentle thud-shake for the comet.
      if (!burstFired.current && p >= (DROP_IMPACT[style] || 1)) {
        burstFired.current = true;
        if (style === "parachute" || style === "pop") {
          poofKind.current = "sparkle";
          poofSeq.current += 1;
        }
        if (style === "comet") shakeRef.current = 0.3; // soft thud, not a crash
      }
      if (p >= 1) {
        avatarPos.y = groundY;
        dropping.current = false;
        motion.current.drop = 1;
        canopyRef.current = 0;
        setLanded(true);
      }
    } else {
      const k = keys.current;
      running = !!(k.ShiftLeft || k.ShiftRight);
      speed = running ? RUN_SPEED : WALK_SPEED;
      if (slowed) speed *= 0.45; // briefly hobbled after a zombie tag
      // Movement basis from the SMOOTHED orbit yaw (single source of truth) — NOT
      // camera.getWorldDirection. This is one-way (yaw → basis), so movement never
      // rotates the camera: a held key holds a fixed world direction (no curve).
      const cy = yaw.current;
      const fwdX = -Math.sin(cy);
      const fwdZ = -Math.cos(cy);
      const rgtX = Math.cos(cy);
      const rgtZ = -Math.sin(cy);
      let ix = 0;
      let iz = 0;
      // Arrow keys ONLY — W/A/S/D are free for Wash Day actions (S = spin, etc.)
      if (k.ArrowUp) { ix += fwdX; iz += fwdZ; }
      if (k.ArrowDown) { ix -= fwdX; iz -= fwdZ; }
      if (k.ArrowRight) { ix += rgtX; iz += rgtZ; }
      if (k.ArrowLeft) { ix -= rgtX; iz -= rgtZ; }
      const il = Math.hypot(ix, iz);
      if (il > 0) {
        moved = true;
        ix /= il;
        iz /= il;
        // raw input dir — the camera's follow target reads this directly so the
        // camera starts trailing the instant a key is pressed (no heading-smooth lag).
        inDirX.current = ix;
        inDirZ.current = iz;
        avatarPos.x += ix * speed * d;
        avatarPos.z += iz * speed * d;
        // smooth the heading, then ease the avatar's facing toward it
        headX.current = THREE.MathUtils.damp(headX.current, ix, 6, dt);
        headZ.current = THREE.MathUtils.damp(headZ.current, iz, 6, dt);
        const tf = Math.atan2(headX.current, headZ.current);
        let df = tf - ref.current.rotation.y;
        df = Math.atan2(Math.sin(df), Math.cos(df));
        // gentler body turn (was 12) so direction changes ease around, not snap
        ref.current.rotation.y += df * (1 - Math.exp(-7 * dt));
      }
      // push out of solids (artifacts + the chaser) so nothing ghosts through;
      // resolve on x/z first, then derive height from the resolved position.
      resolveCollisions(avatarPos);
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

    idle.current = moved ? 0 : idle.current + dt;
    const hl = Math.hypot(headX.current, headZ.current) || 1;
    const shx = headX.current / hl;
    const shz = headZ.current / hl;

    // ── Camera ────────────────────────────────────────────────────────────────
    // CRITICAL — no movement feedback loop: the movement basis above reads from
    // yaw.current (the SMOOTHED orbit yaw), and the heading (shx/shz) it chases
    // is derived from the player's INPUT direction, not from the camera. So the
    // camera follows the heading, but the heading is set by the keys — the
    // camera never feeds back into the movement basis to curve a held key.
    // (ArrowUp resolves to a fixed world direction per frame; the basis only
    // drifts as yaw eases behind it, which is the chase, not a curl.)
    // Three follow MODES (all spring-smoothed via smoothDampAngle so the camera
    // eases in/out as one continuous motion — never lag-then-snap):
    //   • track  — LOCKED ¾ viewing angle: the camera glides to keep you centred
    //              but its angle never changes (drag won't spin it, movement won't
    //              swing it). Zero disorientation. The calm default.
    //   • follow — eases BEHIND your heading, but with a DEADZONE so small left/
    //              right wiggles don't rotate the view — it only re-centers on a
    //              real, sustained turn (and more gently than before).
    //   • free   — pure manual orbit: drag to spin the camera wherever you like.
    // (This is the concrete Track-vs-Free difference: Track's yaw is fixed; Free's
    // yaw follows your drag.)
    let targetYaw = cameraMode === "track" ? TRACK_YAW : yawT.current;
    let smoothTime = 0.12; // manual / track: settle to the chosen angle promptly
    const follow = cameraMode === "follow" && !drag.current;
    if (follow && moved) {
      // Heading the player is walking (raw input → no smoothing lag).
      const headingYaw = Math.atan2(-inDirX.current, -inDirZ.current);
      // Deadzone: only chase the heading once it diverges from where the camera
      // already sits by more than ~22°. Small strafes stay put → no whip.
      let off = headingYaw - yaw.current;
      off = Math.atan2(Math.sin(off), Math.cos(off));
      const DEADZONE = 0.45; // ~26° — ignore wiggle before re-centering
      if (Math.abs(off) > DEADZONE) {
        targetYaw = headingYaw;
        yawT.current = headingYaw; // keep manual-drag target in sync
        smoothTime = 1.5; // SLOW drift behind the heading — a gentle turn, not a twist
      } else {
        targetYaw = yaw.current; // within deadzone — hold the current angle
      }
    }
    yaw.current = smoothDampAngle(yaw.current, targetYaw, yawVel, smoothTime, d);
    // Track holds a fixed, higher top-down pitch (ignores drag) so you see every
    // direction without rotating; Follow/Free use the drag-set pitch.
    const pitchTarget = cameraMode === "track" ? TRACK_PITCH : pitchT.current;
    pitch.current = THREE.MathUtils.damp(pitch.current, pitchTarget, 10, dt);
    dist.current = THREE.MathUtils.damp(dist.current, distT.current, 8, dt);

    // Look-ahead (follow mode only) from the SMOOTHED heading; eases to 0 when idle.
    const leadOn = cameraMode === "follow" && moved;
    const LEAD = 1.2;
    leadX.current = THREE.MathUtils.damp(leadX.current, leadOn ? shx * LEAD : 0, 2.0, dt);
    leadZ.current = THREE.MathUtils.damp(leadZ.current, leadOn ? shz * LEAD : 0, 2.0, dt);

    // Damp a FOCUS point toward (avatar + lead). Track the avatar TIGHTLY (high
    // lambda) so the camera doesn't lag behind at speed, while the yaw eases
    // gently above — together that reads as a smooth follow, not "fast + laggy".
    // Always frame the GROUND (not the falling avatar's high Y) so the camera
    // holds steady on the spawn while the avatar drops INTO view from above.
    const camBaseY = terrainHeight(avatarPos.x, avatarPos.z);
    const goalX = avatarPos.x + leadX.current;
    const goalZ = avatarPos.z + leadZ.current;
    if (!focus.current) focus.current = { x: goalX, y: camBaseY, z: goalZ };
    const f = focus.current;
    f.x = THREE.MathUtils.damp(f.x, goalX, 13, dt);
    f.z = THREE.MathUtils.damp(f.z, goalZ, 13, dt);
    f.y = THREE.MathUtils.damp(f.y, camBaseY, 8, dt);

    const cp = pitch.current;
    // Occlusion pull-in: if a big obstacle (tent / washer) would sit between the
    // camera and the avatar, tuck the camera in so the player stays visible. Work
    // in the horizontal plane (cos(cp)*r), then smooth so it eases rather than pops.
    const horiz = Math.cos(cp) * dist.current;
    const camX = f.x + Math.sin(yaw.current) * horiz;
    const camZ = f.z + Math.cos(yaw.current) * horiz;
    const maxHoriz = occlusionMaxDist(f.x, f.z, camX, camZ);
    const wantR = maxHoriz < horiz ? maxHoriz / Math.max(0.2, Math.cos(cp)) : dist.current;
    // pull in fast (so the obstacle never covers you), ease back out gently
    occlR.current = THREE.MathUtils.damp(occlR.current, wantR, wantR < occlR.current ? 16 : 5, dt);
    const r = Math.min(dist.current, occlR.current);
    camera.position.set(
      f.x + Math.sin(yaw.current) * Math.cos(cp) * r,
      f.y + Math.sin(cp) * r + 1.0,
      f.z + Math.cos(yaw.current) * Math.cos(cp) * r,
    );
    // Comet-impact camera shake — a quick decaying jitter.
    if (shakeRef.current > 0.001) {
      shakeRef.current = Math.max(0, shakeRef.current - d * 2.4);
      const amp = shakeRef.current * 0.4;
      camera.position.x += (Math.random() - 0.5) * amp;
      camera.position.y += (Math.random() - 0.5) * amp;
      camera.position.z += (Math.random() - 0.5) * amp;
    }
    camera.lookAt(tmpTarget.current.set(f.x, f.y + 1.1, f.z));

    guideTimer.current += d;
    if (guideTimer.current > 0.4) {
      guideTimer.current = 0;
      refreshGuideTarget();
    }
  });

  if (!playing) return null;
  return (
    <>
      <group ref={ref}>
        <Suspense fallback={null}>
          <AvatarModel key={avatarVariant} cfg={cfg} motion={motion} />
        </Suspense>
      </group>
      {/* entrance flourishes — SIBLINGS (they place themselves in world space from
          avatarPos, so they must NOT be inside the moved `ref` group) */}
      <DropBurst seqRef={poofSeq} kindRef={poofKind} />
      <ParachuteCanopy canopyRef={canopyRef} />
      <CometStreak streakRef={streakRef} />
    </>
  );
}
