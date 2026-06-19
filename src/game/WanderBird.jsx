// WanderBird — an ambient COMPANION bird for the "Patchwork" play mode, where the
// player discovers hidden patches with NO hints. This bird is pure charm: it
// WANDERS the world between pretty landmarks and occasionally perches. It knows
// NOTHING about patch locations and must NEVER betray where anything is — it has
// no access to the discovery registry, no objective target, no "lead" behavior.
//
// All motion is driven by a single useFrame with reused scratch vectors — nothing
// is allocated per frame. The bird only appears once the avatar has spawned.
//
// Reuses the SAME deep-orange OrangeBirdShape mesh as the other birds so it reads
// as one consistent creature in the world.
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { OrangeBirdShape } from "../scene3d/birdShape";
import { avatarPos, avatarActive } from "./gameStore";
import { terrainHeight } from "../scene3d/coords";
import { sfx } from "./audio";

// ── Hover heights ────────────────────────────────────────────────────────────
const FLY_H = 2.5; // hover height above terrain while roaming
const PERCH_H = 0.55; // close to the ground/landmark when perched

// ── Timing ───────────────────────────────────────────────────────────────────
const ARRIVE_DIST = 1.6; // within this XZ distance of a target → "arrived"
const MAX_LEG = 14; // seconds before forcing a new target even if not arrived
const PERCH_MIN = 2.4; // perch duration range (seconds)
const PERCH_MAX = 4.8;
const PERCH_CHANCE = 0.4; // ~40% of arrivals become a perch
const PLAYER_DRIFT_CHANCE = 0.22; // sometimes pick a target near the player instead

// ── Interesting LANDMARK spots to wander between (NOT patch spots) ─────────────
// Hand-picked scenic places that keep the bird roughly within ~28u of origin and
// generally in view. These are ambient points of interest only — they carry no
// gameplay meaning and never correlate with hidden patches.
const LANDMARKS = [
  { x: 0, z: 0 }, // around the clothesline posts (near origin)
  { x: 2.5, z: -3 }, // just off the line, courtyard side
  { x: 10, z: 11 }, // the tent / camp area
  { x: 13, z: 4 }, // rocky east patch of ground
  { x: -8, z: 9 }, // pond shore (north-west water's edge)
  { x: -12, z: 2 }, // a little further along the shore
  { x: -6, z: -12 }, // back hill, south-west
  { x: 6, z: -14 }, // far back rise, south
  { x: 16, z: -6 }, // out toward the east tree line
  { x: -2, z: 14 }, // open meadow to the north
];

// ── Reusable scratch (no per-frame allocations) ──────────────────────────────
const _goal = new THREE.Vector3();
const _prev = new THREE.Vector3();

export function WanderBird() {
  const root = useRef();
  const wingL = useRef();
  const wingR = useRef();

  // Smoothed flown position (null until first placed at spawn).
  const posRef = useRef(null);
  // Current roaming target (XZ) + whether this leg ends in a perch.
  const target = useRef({ x: LANDMARKS[0].x, z: LANDMARKS[0].z });
  const legTime = useRef(0); // seconds spent on the current leg
  const perchTime = useRef(0); // seconds left of an active perch (>0 → perched)
  const wantPerch = useRef(false); // does the current leg end in a perch?
  const lastIdx = useRef(0); // last landmark index (so we don't repeat in place)
  const flapPhase = useRef(0); // continuous wing-flap phase (so flapping eases off)
  const wasActive = useRef(false); // detect the spawn rising edge

  // Per-bird random phase offsets so the bobbing/looking never looks mechanical.
  const seed = useMemo(() => Math.random() * 100, []);

  // Pick a brand-new roaming target. Mostly a fresh landmark (never the same one
  // twice in a row); occasionally a spot loosely near the player so it feels like
  // a companion — but it is only ever NEAR the player, never ON them, and this
  // never points at any objective.
  const pickTarget = () => {
    if (avatarActive && Math.random() < PLAYER_DRIFT_CHANCE) {
      // A spot a few units to a random side of the player (not on the player).
      const ang = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 3;
      target.current.x = avatarPos.x + Math.cos(ang) * r;
      target.current.z = avatarPos.z + Math.sin(ang) * r;
    } else {
      // A different landmark than last time, with a small random jitter so the
      // bird doesn't land on the exact same pixel each visit.
      let idx = lastIdx.current;
      for (let i = 0; i < 4 && idx === lastIdx.current; i++) {
        idx = (Math.random() * LANDMARKS.length) | 0;
      }
      lastIdx.current = idx;
      const lm = LANDMARKS[idx];
      target.current.x = lm.x + (Math.random() - 0.5) * 2.4;
      target.current.z = lm.z + (Math.random() - 0.5) * 2.4;
    }
    // Keep it roughly within ~28u of origin and never far out of view.
    const d = Math.hypot(target.current.x, target.current.z);
    if (d > 28) {
      const s = 28 / d;
      target.current.x *= s;
      target.current.z *= s;
    }
    legTime.current = 0;
    wantPerch.current = Math.random() < PERCH_CHANCE;
  };

  useFrame((st, dt) => {
    const g = root.current;
    if (!g) return;
    const t = st.clock.elapsedTime;
    const d = dt > 0 && dt < 0.25 ? dt : 1 / 60; // guard zero/NaN/huge dt

    // Stay hidden until the avatar has actually spawned.
    if (!avatarActive) {
      g.visible = false;
      wasActive.current = false;
      return;
    }
    g.visible = true;

    // On spawn (rising edge): place the bird at its first target so it eases in
    // from a sensible spot rather than flying in from the origin.
    if (!wasActive.current) {
      wasActive.current = true;
      pickTarget();
      perchTime.current = 0;
      posRef.current = null;
    }

    const perched = perchTime.current > 0;

    // ── Decide when to move on ──────────────────────────────────────────────────
    if (perched) {
      perchTime.current = Math.max(0, perchTime.current - d);
      if (perchTime.current <= 0) {
        // Take off again toward a fresh target — a rare soft chirp on takeoff.
        pickTarget();
        if (Math.random() < 0.5) sfx.birdChirp();
      }
    } else {
      legTime.current += d;
      const dx = target.current.x - (posRef.current ? posRef.current.x : 0);
      const dz = target.current.z - (posRef.current ? posRef.current.z : 0);
      const arrived = Math.hypot(dx, dz) < ARRIVE_DIST;
      if (arrived || legTime.current > MAX_LEG) {
        if (arrived && wantPerch.current) {
          // Settle into a perch at this landmark for a few seconds.
          perchTime.current = PERCH_MIN + Math.random() * (PERCH_MAX - PERCH_MIN);
        } else {
          pickTarget();
        }
      }
    }

    // ── Compute the goal position (eased toward) ────────────────────────────────
    const tx = target.current.x;
    const tz = target.current.z;
    const ground = terrainHeight(tx, tz);
    // Soft, two-frequency bob; smaller and slower while perched (a tiny idle bob).
    const bob = perched
      ? Math.sin(t * 1.6 + seed) * 0.05
      : Math.sin(t * 2.2 + seed) * 0.14 + Math.sin(t * 4.6 + seed) * 0.05;
    const hoverY = (perched ? PERCH_H : FLY_H) + bob;
    _goal.set(tx, ground + hoverY, tz);

    if (!posRef.current) posRef.current = _goal.clone();
    const pos = posRef.current;
    _prev.copy(pos);
    // Gentle ease toward the goal — slower while perched so it stays put.
    const k = Math.min(1, d * (perched ? 1.4 : 0.9));
    pos.lerp(_goal, k);
    g.position.copy(pos);

    // ── Facing + banking ────────────────────────────────────────────────────────
    const mdx = pos.x - _prev.x;
    const mdz = pos.z - _prev.z;
    const moving = mdx * mdx + mdz * mdz > 1e-6;
    if (perched) {
      // A slow idle "look around" while perched — gently sweeps its heading.
      g.rotation.y += Math.sin(t * 0.6 + seed) * 0.01;
      g.rotation.z += (0 - g.rotation.z) * Math.min(1, d * 3); // level out
    } else if (moving) {
      // Face the direction of travel (local forward is +X → atan2(-dz, dx)).
      const yaw = Math.atan2(-mdz, mdx);
      // Shortest-arc ease toward the travel yaw so turns are smooth, not snappy.
      let dy = yaw - g.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      g.rotation.y += dy * Math.min(1, d * 4);
      // Gentle banking roll, leaning into turns a touch.
      const bank = Math.sin(t * 1.1 + seed) * 0.16 + THREE.MathUtils.clamp(dy, -0.4, 0.4) * 0.5;
      g.rotation.z += (bank - g.rotation.z) * Math.min(1, d * 4);
    }

    // ── Wing flap ───────────────────────────────────────────────────────────────
    // Flap while flying; fold (wings rest) while perched. Ease the flap amplitude
    // so wings settle smoothly when landing rather than snapping shut.
    const targetAmp = perched ? 0 : 0.8;
    flapPhase.current += d * (perched ? 0 : 14);
    const flap = Math.sin(flapPhase.current) * targetAmp + (perched ? 0 : 0.2);
    const ease = Math.min(1, d * 10); // smooth so wings settle on landing, not snap
    if (wingL.current) {
      const cur = wingL.current.rotation.z;
      wingL.current.rotation.z = cur + (flap - cur) * ease;
    }
    if (wingR.current) {
      const cur = wingR.current.rotation.z;
      wingR.current.rotation.z = cur + (-flap - cur) * ease;
    }
  });

  return (
    <group ref={root} visible={false}>
      <group scale={0.42}>
        <OrangeBirdShape wingL={wingL} wingR={wingR} />
      </group>
    </group>
  );
}
