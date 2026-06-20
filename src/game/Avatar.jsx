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
import { sfx } from "./audio";
import { terrainHeight } from "../scene3d/coords";
import { AVATARS, AVATAR_BY_ID, DEFAULT_AVATAR } from "./avatarConfig";
import { GlowRing, Beam, VoxelBits } from "./DropEffects";

AVATARS.forEach((a) => useGLTF.preload(a.url));

const WALK_SPEED = 4.0;
const RUN_SPEED = 8.6;
const WALK_REF = 3.0; // ground speed the walk clips are authored for
const RUN_REF = 6.6;
const SPAWN = new THREE.Vector3(0, 42, 16);
// ── Roblox-style manual turn: drag input maps 1:1 to the camera angle, applied the
// SAME frame with no spring (Roblox accumulates a per-frame `rotateInput` delta and
// resets it each Update — the camera turns exactly with the input, never lags or
// snaps). Sensitivities ≈ Roblox's; pitch clamped like its MIN_Y/MAX_Y (±~80°).
const TURN_YAW_SENS = 0.005; // rad per pixel of horizontal drag
const TURN_PITCH_SENS = 0.004; // rad per pixel of vertical drag
const PITCH_MIN = 0.06; // ~3° above horizon (never under the ground)
const PITCH_MAX = 1.4; // ~80° — Roblox's MAX_Y clamp
// ── Roblox "Follow" mode: while you move, the camera CONTINUOUSLY + gently trails
// behind your travel direction — no deadzone, no threshold-snap. The turn is eased
// (small course corrections barely move the camera) AND hard speed-capped, so even
// a sharp 180° about-face can never whip the view: it just glides around over a
// second or two. This is the key to "no drastic rotation when I turn."
const FOLLOW_RATE = 1.3; // exp approach toward the heading (time-constant ≈ 0.77s)
const FOLLOW_MAX_SPEED = 1.2; // rad/s hard cap on camera turn speed (~69°/s)
// Past this divergence the follow rotation fades out to 0 by 180°, so walking
// straight BACKWARD doesn't spin the camera toward an antipodal target (the bug
// that made the down arrow shake). ~137° → full follow below it, none at 180°.
const FOLLOW_BACK_START = 2.4;
const JUMP_DUR = 0.66;
const JUMP_H = 1.7;

// ── Entrance "spawn" styles (selectable, frame-pacing-proof 0→1 timeline). Most
// appear ON THE SPOT (no fall) with an effect; "settle" is a soft short fall. The
// season ground dust on spawn is emitted by FootstepEffects on the active edge.
const DROP_DUR = { materialize: 0.75, voxel: 0.95, beam: 1.0, settle: 0.9 };
// Height the body starts above the ground. On-the-spot spawns are 0; settle falls.
const DROP_START_Y = { materialize: 0, voxel: 0, beam: 0, settle: 5 };
function dropFall(p, style) {
  if (style === "settle") return 1 - Math.pow(1 - Math.min(1, p), 3); // soft ease-out landing
  return 1; // materialize / voxel / beam don't fall — they appear on the ground
}
// Smooth scale-in (small → full) for the on-the-spot spawns — calm, no overshoot.
function spawnScale(p) {
  const t = Math.min(1, Math.max(0, p));
  return 0.12 + 0.88 * (1 - Math.pow(1 - t, 2.4));
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
  const stepHalf = useRef(-1); // clip avatars: walk-cycle half, for foot-plant edges
  const stepSign = useRef(0); // clipless avatars: bob-sine sign, for foot-down edges

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

  // ── Cube Woman skin recolor ──────────────────────────────────────────────────
  // Her colours are baked into one 32×32 texture atlas, so there's no skin material
  // to tint. We recolor her SKIN pixels on a canvas at load. Skin is detected by a
  // colour RULE (a warm, neutral mid-brown — excludes the saturated gold tunic, the
  // teal shorts and the near-black hair) rather than a hardcoded texel, then lightened
  // + warmed toward a medium brown while keeping the relative shading. Runs in an
  // effect that RETRIES until the texture image has decoded, and logs how many pixels
  // it touched so we can confirm it ran. Nothing but skin is changed.
  useEffect(() => {
    if (cfg.id !== "cube_woman" || !rig.obj) return;
    const TARGET = [224, 158, 103]; // warm light-medium brown (more red/orange, less blue → warmer)
    const BLEND = 0.33; // how far each skin pixel moves toward TARGET (keeps shading)
    // ↑ a mid value: 0 = original dark brown, ~0.62 read as too fair. ~0.33 sits
    //   between them — a warm medium brown.
    const isSkin = (r, g, b) =>
      r > 75 && r < 225 && r > g && g >= b && r - b > 25 && b / r > 0.38 && b / r < 0.92;
    let tries = 0;
    let cancelled = false;
    const apply = () => {
      if (cancelled) return;
      let changed = 0;
      let pending = false;
      rig.obj.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (!m || m.userData.__skinDone) return;
          const tex = m.map;
          if (!tex) return;
          const img = tex.image || (tex.source && tex.source.data);
          if (!img || !img.width) {
            pending = true;
            return;
          }
          try {
            const w = img.width;
            const h = img.height;
            const cv = document.createElement("canvas");
            cv.width = w;
            cv.height = h;
            const cx = cv.getContext("2d");
            cx.drawImage(img, 0, 0, w, h);
            const id = cx.getImageData(0, 0, w, h);
            const d = id.data;
            for (let i = 0; i < d.length; i += 4) {
              const r = d[i];
              const g = d[i + 1];
              const b = d[i + 2];
              if (isSkin(r, g, b)) {
                d[i] = Math.round(r * (1 - BLEND) + TARGET[0] * BLEND);
                d[i + 1] = Math.round(g * (1 - BLEND) + TARGET[1] * BLEND);
                d[i + 2] = Math.round(b * (1 - BLEND) + TARGET[2] * BLEND);
                changed++;
              }
            }
            cx.putImageData(id, 0, 0);
            const nt = new THREE.CanvasTexture(cv);
            nt.flipY = tex.flipY;
            nt.colorSpace = tex.colorSpace;
            nt.magFilter = THREE.NearestFilter;
            nt.minFilter = THREE.NearestFilter;
            nt.generateMipmaps = false;
            nt.needsUpdate = true;
            m.map = nt;
            m.needsUpdate = true;
            m.userData.__skinDone = true;
          } catch {
            /* leave the original texture if anything fails */
          }
        });
      });
      // eslint-disable-next-line no-console
      console.log("[cube skin] recolored " + changed + " px" + (pending ? " (texture still loading…)" : ""));
      if (pending && tries++ < 12) setTimeout(apply, 90);
    };
    apply();
    return () => {
      cancelled = true;
    };
  }, [rig, cfg]);

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

    // ── SPAWN-IN flair on the INNER group (composes with rig.scale via multiply, so
    // it can never resize the avatar). The on-the-spot styles scale the body up from
    // small to full as it appears; voxel holds small until its cubes have converged,
    // then forms in the back half; settle just lands at full size (no gimmick).
    // Cleared to identity once the spawn is done.
    const f = flairRef.current;
    if (f) {
      if (drop > 0 && drop < 1 && dropStyle !== "settle") {
        const p = dropStyle === "voxel" ? (drop - 0.35) / 0.65 : drop;
        const s = spawnScale(p);
        f.scale.set(s, s, s);
        f.rotation.set(0, 0, 0);
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
      const onFoot = curAction.current === clips.walk || curAction.current === clips.run;
      if (cur) {
        if (want === clips.walk || want === clips.run) {
          const ref = want === clips.run ? RUN_REF : WALK_REF;
          cur.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / ref, 0.6, 1.7));
        } else {
          cur.setEffectiveTimeScale(1);
        }
      }
      // Footstep SOUND locked to the actual walk/run animation (two foot-plants per
      // cycle) so it stays in sync with the legs at ANY speed — not a distance guess.
      if (moving && onFoot && cur && cur.getClip) {
        const dur = cur.getClip().duration || 0;
        if (dur > 0) {
          const phase = (((cur.time % dur) + dur) % dur) / dur; // 0..1 through the cycle
          const half = phase < 0.5 ? 0 : 1;
          if (half !== stepHalf.current) {
            sfx.footstep();
            stepHalf.current = half;
          }
        }
      } else {
        stepHalf.current = -1;
      }
      if (rigRef.current) rigRef.current.position.y = 0;
    } else if (rigRef.current) {
      // procedural fallback for clipless models (chicken, banana)
      const t = state.clock.elapsedTime;
      if (moving) {
        const bob = Math.sin(t * (running ? 13 : 9));
        rigRef.current.position.y = Math.abs(bob) * 0.12;
        rigRef.current.rotation.x = -0.1;
        // foot-down = the bottom of the bob (abs(sin)=0 → sine zero-crossing): play
        // the footstep on each sign flip so it's locked to the visible bounce.
        const sign = bob >= 0 ? 1 : -1;
        if (sign !== stepSign.current) {
          sfx.footstep();
          stepSign.current = sign;
        }
      } else {
        rigRef.current.position.y = Math.sin(t * 2) * 0.03;
        rigRef.current.rotation.x = 0;
        stepSign.current = 0;
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
  const dropSoundFired = useRef(false); // spawn SFX plays once per entrance
  const dropT = useRef(0); // 0→1 elapsed-time progress of the entrance
  const dropStyleRef = useRef("materialize"); // locked at spawn so it can't change mid-drop
  const ringRef = useRef(0); // materialize: 1→0 expanding glow ring
  const beamRef = useRef(0); // beam: 0→1→0 light-column opacity
  const bitsRef = useRef(0); // voxel: 1 (spread) → 0 (converged) cubes
  const guideTimer = useRef(0);
  const jumping = useRef(false);
  const jumpT = useRef(0);
  const motion = useRef({ moving: false, running: false, jumping: false, speed: 0, drop: 0, dropStyle: "materialize" });
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
  const rotInput = useRef({ x: 0, y: 0 }); // accumulated drag delta (Roblox rotateInput)
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
    dropSoundFired.current = false;
    ringRef.current = 0;
    beamRef.current = 0;
    bitsRef.current = 0;
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
      // Accumulate the raw drag delta (Roblox's `rotateInput`). The frame loop
      // applies it DIRECTLY to the live camera angle and zeroes it — 1:1, no lag.
      rotInput.current.x += dx;
      rotInput.current.y += dy;
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
      if (!dropSoundFired.current) {
        dropSoundFired.current = true;
        sfx.drop(style); // a spawn sound matched to the chosen entrance
      }
      dropT.current = Math.min(1, dropT.current + d / (DROP_DUR[style] || 0.85));
      const p = dropT.current;
      const top = groundY + (DROP_START_Y[style] ?? 0);
      avatarPos.y = top + (groundY - top) * dropFall(p, style);
      motion.current.drop = p;
      // Drive the in-world effect for the active style; the others stay at 0.
      // materialize: a warm ring blooms outward (1→0). beam: a light column fades
      // in, holds, then fades out. voxel: cubes start spread (1) and converge (0).
      ringRef.current = style === "materialize" && p < 1 ? 1 - p : 0;
      beamRef.current =
        style === "beam"
          ? p < 0.18
            ? p / 0.18
            : p > 0.72
            ? Math.max(0, 1 - (p - 0.72) / 0.28)
            : 1
          : 0;
      bitsRef.current = style === "voxel" && p < 1 ? 1 - p : 0;
      // The ONLY landing particles are the SEASON ground burst, emitted by
      // FootstepEffects on the active edge — no generic sparkle/dust here.
      if (p >= 1) {
        avatarPos.y = groundY;
        dropping.current = false;
        motion.current.drop = 1;
        ringRef.current = 0;
        beamRef.current = 0;
        bitsRef.current = 0;
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
    // Two camera MODES:
    //   • follow — Roblox Follow Mode (default): while you move, the camera
    //              CONTINUOUSLY + gently trails behind your travel direction. No
    //              deadzone, no snap; eased and hard speed-capped so it never whips.
    //              Walking straight backward holds the angle (no antipodal spin).
    //   • free   — pure manual orbit: drag to spin the camera wherever you like.
    // ── Roblox-style manual turn: consume the accumulated drag delta and apply it
    // DIRECTLY to the live camera angle this frame — no spring, so left/right turning
    // tracks the input exactly (never lags behind, never snaps to catch up). We sync
    // the spring targets + zero its velocity so the smoothing below is a no-op while
    // dragging. Drag works in both modes; zoom, position and the auto-follow drift
    // stay smoothed. Matches Roblox, where rotateInput is applied to the look CFrame
    // each Update and then reset.
    const ri = rotInput.current;
    if (ri.x || ri.y) {
      yaw.current -= ri.x * TURN_YAW_SENS;
      yawT.current = yaw.current;
      yawVel.current = 0;
      pitch.current = Math.min(PITCH_MAX, Math.max(PITCH_MIN, pitch.current + ri.y * TURN_PITCH_SENS));
      pitchT.current = pitch.current;
    }
    ri.x = 0;
    ri.y = 0;

    if (cameraMode === "follow") {
      // Roblox Follow Mode. While moving (and not mid-drag), ease the camera yaw
      // toward the travel direction CONTINUOUSLY — from the very first degree of
      // divergence, with no deadzone and no threshold. Two things keep it gentle:
      //   1. an exponential approach, so small course corrections move the camera
      //      only a little (the turn rate scales with how off-angle you are), and
      //   2. a hard per-frame SPEED CAP, so a big/sudden turn can't whip the view —
      //      it glides around at a bounded rate instead.
      // Idle → hold the current angle (no drift). Manual drag (applied directly
      // above) overrides; follow resumes gently from wherever you left it.
      if (!drag.current && moved) {
        const headingYaw = Math.atan2(-inDirX.current, -inDirZ.current);
        let off = headingYaw - yaw.current;
        off = Math.atan2(Math.sin(off), Math.cos(off)); // shortest signed angle
        // Don't chase a near-backward heading. When you walk straight back, the
        // target is ~180° away (antipodal) — and atan2 is sign-unstable right at
        // ±π — so blindly easing toward it makes the camera spin/jitter (the
        // down-arrow "shake"). Fade the follow weight to 0 across the back arc, so
        // backward movement just glides and the camera holds its angle. Forward and
        // left/right turning (|off| ≤ FOLLOW_BACK_START) are completely unaffected.
        const aOff = Math.abs(off);
        const w = aOff <= FOLLOW_BACK_START ? 1 : Math.max(0, (Math.PI - aOff) / (Math.PI - FOLLOW_BACK_START));
        let step = off * w * (1 - Math.exp(-FOLLOW_RATE * d)); // eased fraction toward heading
        const maxStep = FOLLOW_MAX_SPEED * d; // hard cap: never turn faster than this
        if (step > maxStep) step = maxStep;
        else if (step < -maxStep) step = -maxStep;
        yaw.current += step;
        yawT.current = yaw.current; // keep the manual-drag target synced
      }
      yawVel.current = 0; // follow drives yaw directly — no spring momentum to carry
    } else {
      // free: settle to the drag target (a no-op right after a direct drag, since
      // yawT was synced to yaw above).
      yaw.current = smoothDampAngle(yaw.current, yawT.current, yawVel, 0.12, d);
    }
    // Follow / Free both use the drag-set pitch.
    pitch.current = THREE.MathUtils.damp(pitch.current, pitchT.current, 10, dt);
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
          avatarPos, so they must NOT be inside the moved `ref` group). Landing dust
          is the season FootstepEffects burst — no generic particles here. */}
      <GlowRing ringRef={ringRef} />
      <Beam beamRef={beamRef} />
      <VoxelBits bitsRef={bitsRef} />
    </>
  );
}
