// SockHunt — SOCKS mode: 5 cute low-poly socks scattered across the yard.
// Walk near one to pick it up (it pops with a little poof); walk near the
// laundry basket while carrying to deposit them. Five in the basket → done.
//
// Rendered inside the Canvas by GameLayer when gameMode === "socks". All
// proximity logic runs in useFrame reading the live `avatarPos` (non-reactive)
// so picking up a sock doesn't churn React every frame — only the discrete
// pickup/deposit events touch the store.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { avatarPos, avatarActive, useGame } from "./gameStore";
import {
  svgXToWorld,
  svgToWorldOnTerrain,
  terrainHeight,
  POND_X,
  POND_Z,
  POND_RADIUS,
} from "../scene3d/coords";
import {
  resetSocks,
  pickUpSock,
  depositSocks,
  useSockGame,
  SOCK_GOAL,
} from "./sockStore";

const PICKUP_RANGE = 1.2;
const DEPOSIT_RANGE = 2.0;

// Warm, distinct sock colors so each reads as its own little collectible.
const SOCK_COLORS = ["#E2725B", "#6FA8A0", "#E0A458", "#8C7BD9", "#D96BA0"];
const BAND_COLORS = ["#FFF3E6", "#FBEFD8", "#FCEBD2", "#F1ECFF", "#FDE7F2"];

// ── Basket deposit point ──────────────────────────────────────────────────────
// WickerBasket uses svgToWorldOnTerrain(sx=180, 640, 1.6) for its [x,z], grounded
// at terrainHeight(x,z). We reproduce that exact world position as the drop point.
function basketWorld() {
  const x = svgXToWorld(180);
  const [, , z] = svgToWorldOnTerrain(180, 640, 1.6);
  return new THREE.Vector3(x, terrainHeight(x, z), z);
}

// ── Seeded scatter ─────────────────────────────────────────────────────────────
// Deterministic positions spread around the yard, kept off the pond and away
// from the clothesline center. Varied but reproducible each round.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scatterSocks(seed = 42) {
  const rng = mulberry32(seed);
  const out = [];
  let guard = 0;
  while (out.length < SOCK_GOAL && guard < 400) {
    guard++;
    // Spread across the yard in a ring-ish band, biased to the front/open area.
    const ang = rng() * Math.PI * 2;
    const rad = 7 + rng() * 16; // 7..23 units from origin
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad * 0.8 + 2; // slight push toward front

    // Avoid the pond.
    const pd = Math.hypot(x - POND_X, z - POND_Z);
    if (pd < POND_RADIUS + 2.5) continue;
    // Avoid the clothesline center strip (posts + hanging garments around x≈0).
    if (Math.abs(x) < 3.5 && Math.abs(z) < 2) continue;
    // Don't spawn right on top of the basket.
    const bx = svgXToWorld(180);
    if (Math.hypot(x - bx, z - 1.6) < 3) continue;
    // Keep them apart from each other.
    if (out.some((p) => Math.hypot(p.x - x, p.z - z) < 4)) continue;

    out.push({ x, z, y: terrainHeight(x, z) });
  }
  // Fallback fill (in case the guard tripped) so we always have 5.
  while (out.length < SOCK_GOAL) {
    const x = -16 + out.length * 8;
    const z = 6;
    out.push({ x, z, y: terrainHeight(x, z) });
  }
  return out.map((p, i) => ({
    id: i,
    pos: new THREE.Vector3(p.x, p.y, p.z),
    color: SOCK_COLORS[i % SOCK_COLORS.length],
    band: BAND_COLORS[i % BAND_COLORS.length],
    phase: i * 1.27,
  }));
}

// ── A single collectible sock ───────────────────────────────────────────────────
function Sock({ data, collected }) {
  const group = useRef();
  const popRef = useRef(1); // 1 = full size, eases to 0 when collected
  const { pos, color, band, phase } = data;

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    if (collected) {
      // poof: shrink + lift slightly, then it's gone.
      popRef.current = Math.max(0, popRef.current - dt * 3.2);
      const s = popRef.current;
      g.scale.setScalar(s);
      g.position.y = pos.y + 0.25 + (1 - s) * 0.6;
      g.visible = s > 0.01;
      return;
    }
    // gentle idle bob + slow spin so it reads as collectible.
    const bob = Math.sin(t * 2 + phase) * 0.12;
    g.position.y = pos.y + 0.32 + bob;
    g.rotation.y = t * 0.8 + phase;
  });

  return (
    <group ref={group} position={[pos.x, pos.y + 0.32, pos.z]}>
      {/* foot (lying flat) */}
      <mesh castShadow position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.12, 0.26, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* leg / cuff (standing up) */}
      <mesh castShadow position={[0, 0.16, -0.06]}>
        <capsuleGeometry args={[0.12, 0.2, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* colored cuff band */}
      <mesh position={[0, 0.3, -0.06]}>
        <cylinderGeometry args={[0.135, 0.135, 0.09, 10]} />
        <meshStandardMaterial color={band} roughness={0.7} />
      </mesh>
      {/* soft glow so it pops as collectible */}
      <mesh position={[0, 0.05, 0.02]}>
        <sphereGeometry args={[0.42, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.14}
          depthWrite={false}
        />
      </mesh>
      {/* point light kiss for the glow at night */}
      <pointLight color={color} intensity={0.5} distance={2.2} position={[0, 0.3, 0]} />
    </group>
  );
}

// ── Socks piling in the basket ──────────────────────────────────────────────────
function BasketPile({ basket, inBasket }) {
  const offsets = useMemo(
    () => [
      [-0.12, 0.5, 0.05, 0.5],
      [0.13, 0.52, -0.04, -0.6],
      [0.02, 0.55, 0.12, 0.2],
      [-0.1, 0.57, -0.1, 1.0],
      [0.1, 0.6, 0.08, -0.3],
    ],
    []
  );
  return (
    <group position={[basket.x, basket.y, basket.z]}>
      {offsets.slice(0, inBasket).map((o, i) => (
        <mesh key={i} position={[o[0], o[1], o[2]]} rotation={[0.4, o[3], 0.2]} castShadow>
          <capsuleGeometry args={[0.1, 0.2, 4, 8]} />
          <meshStandardMaterial color={SOCK_COLORS[i % SOCK_COLORS.length]} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// ── Floating guide arrow toward nearest target ──────────────────────────────────
function GuideArrow({ targetRef }) {
  const ref = useRef();
  useFrame((state) => {
    const g = ref.current;
    const target = targetRef.current;
    if (!g || !target || !avatarActive) {
      if (g) g.visible = false;
      return;
    }
    g.visible = true;
    const t = state.clock.elapsedTime;
    // hover above the avatar, point toward the target on the ground plane.
    g.position.set(avatarPos.x, avatarPos.y + 2.2 + Math.sin(t * 3) * 0.08, avatarPos.z);
    const dir = Math.atan2(target.x - avatarPos.x, target.z - avatarPos.z);
    g.rotation.set(Math.PI / 2, 0, 0);
    g.rotation.y = dir;
  });
  return (
    <mesh ref={ref} visible={false}>
      <coneGeometry args={[0.14, 0.4, 6]} />
      <meshBasicMaterial color="#E2725B" transparent opacity={0.85} depthWrite={false} />
    </mesh>
  );
}

export function SockHunt() {
  const { playing } = useGame();
  const sock = useSockGame();
  const { inBasket, carrying } = sock;
  // Live mirror of `carrying` for the per-frame loop (avoids stale closure).
  const carryingRef = useRef(carrying);
  carryingRef.current = carrying;
  // Re-seed each time a new round starts.
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const socks = useMemo(() => scatterSocks(seed), [seed]);
  const basket = useMemo(() => basketWorld(), []);

  // collected[i] = true once picked up (drives the poof + hides from proximity).
  const [collected, setCollected] = useState(() => socks.map(() => false));
  const collectedRef = useRef(collected);
  collectedRef.current = collected;

  // Reset state on (re)entry so replaying re-scatters + clears counts.
  useEffect(() => {
    if (!playing) return;
    resetSocks();
    setSeed(Math.floor(Math.random() * 1e6));
  }, [playing]);

  // When the seed changes the socks list is rebuilt → reset the collected flags.
  useEffect(() => {
    setCollected(socks.map(() => false));
  }, [socks]);

  // The nearest target the guide arrow points at (a sock, or the basket while carrying).
  const guideTarget = useRef(null);

  // throttle proximity work a touch
  const acc = useRef(0);
  useFrame((state, dt) => {
    if (!avatarActive) return;
    acc.current += dt;
    if (acc.current < 0.06) return;
    acc.current = 0;

    const flags = collectedRef.current;
    let nearestSock = null;
    let nearestD = Infinity;

    // pickups
    let changed = false;
    const next = flags.slice();
    for (let i = 0; i < socks.length; i++) {
      if (flags[i]) continue;
      const d = Math.hypot(socks[i].pos.x - avatarPos.x, socks[i].pos.z - avatarPos.z);
      if (d <= PICKUP_RANGE) {
        next[i] = true;
        changed = true;
        pickUpSock();
        continue;
      }
      if (d < nearestD) {
        nearestD = d;
        nearestSock = socks[i].pos;
      }
    }
    if (changed) setCollected(next);

    // deposit when near the basket while carrying. `carrying` from the store is
    // the truth; pickUpSock() above bumps it synchronously, so account for any
    // pickups landed this same frame.
    const carryingNow = carryingRef.current + (changed ? next.filter(Boolean).length - flags.filter(Boolean).length : 0);
    if (carryingNow > 0) {
      const bd = Math.hypot(basket.x - avatarPos.x, basket.z - avatarPos.z);
      if (bd <= DEPOSIT_RANGE) {
        depositSocks();
      }
      guideTarget.current = basket; // head to the basket while carrying
    } else {
      guideTarget.current = nearestSock; // otherwise toward the nearest loose sock
    }
  });

  if (!playing) return null;

  return (
    <group>
      {socks.map((s, i) => (
        <Sock key={s.id} data={s} collected={collected[i]} />
      ))}
      <BasketPile basket={basket} inBasket={inBasket} />
      <GuideArrow targetRef={guideTarget} />
    </group>
  );
}
