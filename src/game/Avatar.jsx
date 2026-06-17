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
import { avatarPos, setLanded, refreshGuideTarget, useGame, chase, resolveCollisions } from "./gameStore";
import { terrainHeight } from "../scene3d/coords";
import { AVATARS, AVATAR_BY_ID, DEFAULT_AVATAR } from "./avatarConfig";
import LandingPoof from "./LandingPoof";

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
const DROP_DUR = 1.25; // seconds for the whole drop-in timeline (0→1), frame-pacing-proof

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
    const { moving, running, jumping, speed, drop } = motion.current;

    // ── DROP-IN flair: squash/stretch + a playful spin, all keyed off the
    // parent's 0→1 `drop` progress. While falling fast the body STRETCHES thin
    // and tall; on impact it SQUASHES wide and short, then springs back through
    // a small overshoot to normal. A lazy half-spin unwinds on the way down so
    // it lands facing forward. Volume-preserving (wide ↔ tall) so it reads as a
    // bouncy toy, not a scaling glitch. Applied to rigRef so it composes with
    // the outer `rig.scale`. When drop is done (>=1 and settled) we leave the
    // rig at identity for normal play.
    if (rigRef.current && drop > 0 && drop < 1) {
      const p = drop;
      let sx = 1;
      let sy = 1;
      let spin = 0;
      let lift = 0;
      if (p < 0.18) {
        // anticipation: a tiny crouch/wind-up at the top
        const a = p / 0.18;
        sy = 1 - 0.12 * Math.sin(a * Math.PI);
        sx = 1 + 0.08 * Math.sin(a * Math.PI);
        spin = Math.PI; // start of the unwinding half-spin
      } else {
        const q = (p - 0.18) / 0.82; // 0→1 over fall+settle
        if (q < 0.74) {
          // PLUNGE: stretch thin & tall, peaking with fall speed
          const s = Math.sin((q / 0.74) * Math.PI * 0.5); // 0→1
          sy = 1 + 0.45 * s;
          sx = 1 / Math.sqrt(sy); // preserve volume → narrows as it lengthens
          spin = Math.PI * (1 - q / 0.74); // unwind the half-spin to 0 by impact
          lift = 0;
        } else {
          // IMPACT → SETTLE: squash wide, then a damped spring back to 1.
          const r = (q - 0.74) / 0.26; // 0→1 after impact
          // squash amount rings down: big at impact, overshoots past 1, settles
          const ring = Math.cos(r * Math.PI * 2.2) * Math.exp(-r * 4.5);
          sy = 1 - 0.4 * ring; // <1 at impact (squashed), springs up & settles
          sx = 1 / Math.sqrt(Math.max(0.2, sy));
          spin = 0;
        }
      }
      rigRef.current.scale.set(sx, sy, sx);
      rigRef.current.rotation.y = spin;
      rigRef.current.position.y = lift;
      // hold the locomotion clips on idle but skip their per-frame transform
      // writes (position/rotation) so they don't fight the squash/stretch.
      return;
    } else if (rigRef.current && rigRef.current.scale.y !== 1) {
      // drop just finished (or never ran): clear any leftover squash/spin so
      // normal play starts from a clean identity transform.
      rigRef.current.scale.set(1, 1, 1);
      rigRef.current.rotation.y = 0;
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
      <primitive object={rig.obj} />
    </group>
  );
}

export function Avatar() {
  const { camera, gl } = useThree();
  const ref = useRef();
  const keys = useRef({});
  const dropping = useRef(true);
  const dropT = useRef(0); // 0→1 elapsed-time progress of the drop-in (frame-pacing-proof)
  const dropStartY = useRef(SPAWN.y); // y the drop eases down FROM
  const poofSeq = useRef(0); // bumped on impact to fire the dust poof
  const guideTimer = useRef(0);
  const jumping = useRef(false);
  const jumpT = useRef(0);
  // `drop` (0→1) lets the model apply squash/stretch + spin during the entrance.
  const motion = useRef({ moving: false, running: false, jumping: false, speed: 0, drop: 0 });
  const tmpFwd = useRef(new THREE.Vector3());
  const tmpRight = useRef(new THREE.Vector3());
  const tmpMove = useRef(new THREE.Vector3());
  const tmpTarget = useRef(new THREE.Vector3());
  // orbit follow camera
  const yaw = useRef(0);
  const pitch = useRef(0.38);
  const dist = useRef(8.5);
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

  const { playing, avatarVariant, cameraMode, cameraDist } = useGame();
  const cfg = AVATAR_BY_ID[avatarVariant] || AVATAR_BY_ID[DEFAULT_AVATAR];

  // Near / Far framing preset → snap the camera distance target (scroll can still
  // fine-tune afterward).
  useEffect(() => {
    distT.current = cameraDist === "far" ? 15 : 8.5;
  }, [cameraDist]);

  useEffect(() => {
    if (!playing) return;
    avatarPos.copy(SPAWN);
    dropping.current = true;
    dropT.current = 0;
    dropStartY.current = SPAWN.y;
    motion.current.drop = 0;
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

    if (dropping.current) {
      // Drive the whole entrance off an accumulated 0→1 timeline rather than a
      // y-easing threshold: this lands reliably in ~DROP_DUR seconds no matter
      // how the frames are paced (headless / throttled rAF can't stall it), and
      // gives the squash/stretch reliable timing.
      dropT.current = Math.min(1, dropT.current + d / DROP_DUR);
      const p = dropT.current;
      // Height curve: a brief ANTICIPATION hang at the top, then a snappy
      // accelerating PLUNGE (ease-in), then a small BOUNCE that overshoots the
      // ground and settles. Built from a 0→1 "fallen" fraction.
      let fall;
      if (p < 0.18) {
        // hang / wind-up: barely moves, slight extra rise for anticipation
        fall = -0.04 * Math.sin((p / 0.18) * Math.PI);
      } else {
        const q = (p - 0.18) / 0.82; // 0→1 over the fall+settle
        // Accelerating PLUNGE that bottoms out (reaches the ground) right at the
        // model's impact at q≈0.74, so the squash and the touchdown line up.
        const f = Math.min(1, q / 0.74);
        const plunge = f * f; // ease-in to ground
        // damped BOUNCE after touchdown: a quick hop back up that rings out to 0.
        const r = q > 0.74 ? (q - 0.74) / 0.26 : -1; // 0→1 after impact, else inactive
        // a single decaying hop UP (clamped ≥0 so the body never sinks below ground)
        const bounce = r >= 0 ? Math.max(0, Math.sin(r * Math.PI)) * 0.1 * Math.exp(-r * 2.5) : 0;
        fall = plunge - bounce; // bounce lifts it slightly above ground, then settles
      }
      const top = dropStartY.current;
      avatarPos.y = top + (groundY - top) * fall;
      // expose progress so the model can squash/stretch + spin in sync
      motion.current.drop = p;
      if (p >= 1) {
        avatarPos.y = groundY;
        dropping.current = false;
        motion.current.drop = 1;
        poofSeq.current += 1; // kick the dust poof
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
    const camBaseY = dropping.current ? avatarPos.y : terrainHeight(avatarPos.x, avatarPos.z);
    const goalX = avatarPos.x + leadX.current;
    const goalZ = avatarPos.z + leadZ.current;
    if (!focus.current) focus.current = { x: goalX, y: camBaseY, z: goalZ };
    const f = focus.current;
    f.x = THREE.MathUtils.damp(f.x, goalX, 13, dt);
    f.z = THREE.MathUtils.damp(f.z, goalZ, 13, dt);
    f.y = THREE.MathUtils.damp(f.y, camBaseY, 8, dt);

    const cp = pitch.current;
    const r = dist.current;
    camera.position.set(
      f.x + Math.sin(yaw.current) * Math.cos(cp) * r,
      f.y + Math.sin(cp) * r + 1.0,
      f.z + Math.cos(yaw.current) * Math.cos(cp) * r,
    );
    camera.lookAt(tmpTarget.current.set(f.x, f.y + 1.1, f.z));

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
      <LandingPoof seqRef={poofSeq} />
    </group>
  );
}
