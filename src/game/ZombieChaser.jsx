// ZombieChaser — the goofy zombie that shambles after the player during the
// chase. Rendered inside the Canvas (GameLayer) only while playing & not won.
//
// Charming, NOT scary: a slow-but-relentless shambler that lurches side to side,
// bobs, and does a little lunge-cackle when it catches up. It can never end the
// game — on contact it just SOFT-TAGS the player (a brief slow, handled by the
// Avatar via gameStore.chase) then pauses a beat so it doesn't perma-stick.
//
// Speed budget (player ref: WALK 4.0, RUN 8.6): the zombie cruises at ~2.7 u/s,
// so a walking player is slowly reeled in but a running player always escapes.
// As the player nears completion it creeps up to a ~3.4 u/s cap — gentle dread.
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import {
  avatarPos, avatarActive, tagPlayer, hitPlayer, useGame, totalCount,
  zombiePos, setZombieActive, ZOMBIE_STANDOFF,
  resolveCollisions, ZOMBIE_RADIUS, chase,
} from "./gameStore";
import { terrainHeight } from "../scene3d/coords";

const ZOMBIE_URL = "/models/avatars/zombie.glb";
useGLTF.preload(ZOMBIE_URL);

// ── Tuning ───────────────────────────────────────────────────────────────────
const TARGET_HEIGHT = 2.4; // a touch bigger than the player (avatars target ~1.7–2.1)
const BASE_SPEED = 2.7; // u/s — slower than WALK (4.0); outrun by RUN (8.6)
const MAX_SPEED = 3.4; // u/s — gentle cap as the player nears completion
const TAG_RANGE = 1.3; // contact distance for a soft tag
const TAG_COOLDOWN = 1.6; // s — minimum seconds between tags
const LUNGE_PAUSE = 0.5; // s — freeze-in-place after a tag so it doesn't stick
const SPAWN = new THREE.Vector3(10, 0, -10); // ~16 units off the avatar spawn (0,_,16)

// sickly tint the zombie is lerped toward, so it reads distinct from a player
// who happens to have picked the selectable zombie avatar.
const SICKLY = new THREE.Color("#8fae72"); // pale green-grey

/** Pick a "walk"/"run" clip by lowercased-name includes, else the first clip. */
function pickClip(names) {
  if (!names || !names.length) return null;
  const lower = names.map((n) => ({ n, l: n.toLowerCase() }));
  const walk = lower.find((r) => r.l.includes("walk"));
  if (walk) return walk.n;
  const run = lower.find((r) => r.l.includes("run"));
  if (run) return run.n;
  return names[0];
}

export function ZombieChaser() {
  const groupRef = useRef(); // outer group: world position + facing yaw
  const lurchRef = useRef(); // inner group: comedic sway / bob / lunge pose
  const { scene, animations } = useGLTF(ZOMBIE_URL);
  const { actions, names } = useAnimations(animations, groupRef);

  // Live binding read inside useFrame (no re-render needed each frame).
  const { discovered } = useGame();
  const progressRef = useRef(0);
  useEffect(() => {
    const total = totalCount();
    progressRef.current = total > 0 ? discovered.size / total : 0;
  }, [discovered]);

  // Per-frame chase bookkeeping (refs so we never trigger React renders).
  const facing = useRef(0); // smoothed yaw
  const lastTag = useRef(-Infinity);
  const pauseUntil = useRef(0);
  const lungeAmt = useRef(0); // 0..1 lunge-pose blend, eases back down
  const tmpDir = useRef(new THREE.Vector3());

  // Clone the skeleton (so the animation mixer owns a private rig), soften the
  // PBR to matte clay, and lerp every material toward a sickly green-grey. All
  // materials are CLONED first so we never mutate the shared useGLTF cache.
  const rig = useMemo(() => {
    const obj = skeletonClone(scene);
    obj.rotation.set(0, 0, 0);

    obj.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const sicken = (m) => {
        const m2 = m.clone();
        if ("metalness" in m2) m2.metalness = 0;
        if ("roughness" in m2) m2.roughness = 0.9;
        if ("envMapIntensity" in m2) m2.envMapIntensity = 0;
        if (m2.color && m2.color.isColor) m2.color.lerp(SICKLY, 0.45);
        if (m2.emissive && m2.emissive.isColor) {
          m2.emissive.lerp(SICKLY, 0.2);
          m2.emissiveIntensity = Math.min(m2.emissiveIntensity ?? 1, 0.25);
        }
        return m2;
      };
      o.material = Array.isArray(o.material) ? o.material.map(sicken) : sicken(o.material);
      o.castShadow = true;
    });

    // Bounding-box fit → uniform scale so the zombie stands ~TARGET_HEIGHT tall,
    // grounded at y=0 within the inner group (mirrors AvatarModel's fit).
    obj.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    obj.traverse((o) => {
      if (o.isMesh) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        box.union(tmp);
      }
    });
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    obj.position.set(-center.x, -box.min.y, -center.z);
    const scale = TARGET_HEIGHT / Math.max(size.x, size.y, size.z, 0.001);
    return { obj, scale };
  }, [scene]);

  // Reset to the spawn point on mount and start the shamble loop.
  useEffect(() => {
    if (groupRef.current) {
      const y = terrainHeight(SPAWN.x, SPAWN.z);
      groupRef.current.position.set(SPAWN.x, y, SPAWN.z);
      zombiePos.copy(groupRef.current.position);
    }
    facing.current = 0;
    lastTag.current = -Infinity;
    pauseUntil.current = 0;
    lungeAmt.current = 0;
    setZombieActive(true); // collidable while present

    const clipName = actions && pickClip(names);
    const a = clipName && actions[clipName];
    if (a) {
      a.reset().fadeIn(0.3).play();
      a.setEffectiveTimeScale(0.9); // a touch sluggish — shambling, not sprinting
    }
    return () => {
      setZombieActive(false);
      if (actions) Object.values(actions).forEach((x) => x && x.stop());
    };
  }, [actions, names]);

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05);
    const t = state.clock.elapsedTime;
    const g = groupRef.current;
    if (!g) return;

    // Wait at spawn until the player has actually landed — otherwise the zombie
    // beelines under the avatar while it's still dropping from the sky (and could
    // even tag it mid-air). `avatarActive` is a live binding; read it fresh.
    if (!avatarActive) {
      g.position.y = terrainHeight(g.position.x, g.position.z);
      zombiePos.copy(g.position);
      return;
    }

    // Frozen while the player reads an artifact reveal (pause-to-read) or is
    // dead — hold position, skip movement + tagging entirely. Read the
    // non-reactive mirrors so this never triggers a re-render.
    if (chase.paused || chase.dead) {
      g.position.y = terrainHeight(g.position.x, g.position.z);
      zombiePos.copy(g.position);
      return;
    }

    // Rising tension: nudge speed up slightly as the player nears completion.
    const speed = THREE.MathUtils.lerp(BASE_SPEED, MAX_SPEED, progressRef.current);

    // Vector toward the player on the ground plane.
    const dir = tmpDir.current.set(avatarPos.x - g.position.x, 0, avatarPos.z - g.position.z);
    const dist = dir.length();

    const paused = t < pauseUntil.current;
    if (dist > 0.0001 && !paused) {
      dir.multiplyScalar(1 / dist); // normalize
      // stop at the stand-off radius so it presses AGAINST the player, never
      // overlapping/penetrating (the avatar also pushes out of the zombie).
      const step = Math.min(speed * d, Math.max(0, dist - ZOMBIE_STANDOFF));
      g.position.x += dir.x * step;
      g.position.z += dir.z * step;
    }

    // Don't walk through artifacts: push out of any solid (includeZombie=false
    // so it never tries to push out of its own circle), then re-ground.
    resolveCollisions(g.position, ZOMBIE_RADIUS, false);

    // Keep grounded on the terrain, and publish the live position for collision.
    g.position.y = terrainHeight(g.position.x, g.position.z);
    zombiePos.copy(g.position);

    // Smoothly rotate to face travel/target direction (atan2 gives the yaw that
    // points +Z forward of the model toward the player).
    if (dist > 0.0001) {
      const targetYaw = Math.atan2(dir.x, dir.z);
      let df = targetYaw - facing.current;
      df = Math.atan2(Math.sin(df), Math.cos(df)); // shortest arc
      facing.current += df * (1 - Math.exp(-7 * d));
      g.rotation.y = facing.current;
    }

    // ── Soft tag on contact (throttled) ────────────────────────────────────────
    if (dist < TAG_RANGE && t - lastTag.current > TAG_COOLDOWN) {
      lastTag.current = t;
      pauseUntil.current = t + LUNGE_PAUSE; // brief beat so it doesn't perma-stick
      lungeAmt.current = 1; // pop the lunge-cackle pose
      tagPlayer(t); // soft-slow the player
      hitPlayer(); // land a hit — three hits → dead (no-op if paused/dead)
    }

    // ── Comedic character: lurch, bob, and a lunge pose on tags ─────────────────
    const lurch = lurchRef.current;
    if (lurch) {
      lungeAmt.current = THREE.MathUtils.damp(lungeAmt.current, 0, 4, d);
      const moving = !paused && dist > TAG_RANGE * 0.9;
      const cadence = moving ? 7.5 : 2.0; // shamble pace vs. idle teeter
      const sway = Math.sin(t * cadence); // side-to-side lurch
      const bob = Math.abs(Math.sin(t * cadence * 0.5)); // little up/down bob

      // side-to-side roll + a small lateral drift = drunken shamble
      lurch.rotation.z = sway * 0.16;
      lurch.position.x = sway * 0.12;
      // bob up while shuffling; the lunge adds a forward+up pop, then a cackle tilt
      lurch.position.y = bob * 0.1 + lungeAmt.current * 0.18;
      lurch.position.z = lungeAmt.current * 0.35; // lunge forward at the player
      lurch.rotation.x = -lungeAmt.current * 0.3 - (moving ? 0.06 : 0); // hunch + cackle
    }

    // One mixer, advanced each frame by the R3F clock.
    // (useAnimations attaches the mixer to groupRef; drei updates it via R3F.)
  });

  return (
    <group ref={groupRef}>
      <group ref={lurchRef}>
        <group scale={rig.scale}>
          <primitive object={rig.obj} />
        </group>
      </group>
    </group>
  );
}
