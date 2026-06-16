/**
 * SkyDrama — per-season big sky set-pieces.
 *
 *  summer  → low-poly hot-air balloon(s) drifting high across the sky
 *  autumn  → V-formation of migrating birds/geese crossing high overhead
 *  night   → null  (no set-piece)
 *  winter  → null  (handled elsewhere)
 *  spring  → null  (handled elsewhere)
 */

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";


// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Deterministic PRNG — same pattern as SeasonParticles */
function rng(seed) {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

// ─── SUMMER: Hot-Air Balloon ─────────────────────────────────────────────────

/**
 * One low-poly hot-air balloon.
 *
 * Envelope: IcosahedronGeometry scaled tall (egg shape) with flat-shaded
 * coloured panels faked via vertex colours.
 * Basket: small BoxGeometry beneath the envelope.
 * Ropes: 4 thin lines connecting basket corners to envelope bottom.
 *
 * Props
 *  position  – [x, y, z] start world position
 *  driftX    – horizontal drift speed (world units / s)
 *  bobAmp    – vertical bob amplitude (world units)
 *  bobSpeed  – vertical bob speed (rad / s)
 *  scale     – uniform scale
 *  seed      – for colour variation
 *  wrapX     – x range [min, max] for wrapping
 */
function HotAirBalloon({ position, driftX, bobAmp, bobSpeed, scale = 1, seed = 0, wrapX = [-140, 140] }) {
  const groupRef = useRef();
  const startY = position[1];

  // Panel colours — warm, festive
  const PANEL_SETS = [
    ["#E84040", "#F5A623", "#F5E642", "#FFFFFF", "#4A90D9"],
    ["#9B59B6", "#3498DB", "#2ECC71", "#F1C40F", "#E74C3C"],
    ["#FF6B6B", "#FFE66D", "#4ECDC4", "#45B7D1", "#FFA07A"],
    ["#E91E8C", "#FF9800", "#FFC107", "#8BC34A", "#2196F3"],
  ];
  const palette = PANEL_SETS[seed % PANEL_SETS.length];

  // Envelope geometry — icosahedron subdivided once, scaled into egg shape,
  // with per-face vertex colours for panel effect.
  const envelopeGeo = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1.0, 1);
    // Convert to non-indexed so each triangle can have its own colour.
    const nonIndexed = geo.toNonIndexed();
    const posArr = nonIndexed.attributes.position.array;
    const count = posArr.length / 3;
    const colors = new Float32Array(count * 3);
    const col = new THREE.Color();
    // Assign colours by "panel" based on longitude angle.
    for (let i = 0; i < count; i += 3) {
      // centroid x of the triangle
      const cx = (posArr[i * 3] + posArr[(i + 1) * 3] + posArr[(i + 2) * 3]) / 3;
      const cz = (posArr[i * 3 + 2] + posArr[(i + 1) * 3 + 2] + posArr[(i + 2) * 3 + 2]) / 3;
      const angle = Math.atan2(cz, cx); // -π..π
      const panel = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * palette.length);
      col.set(palette[Math.min(panel, palette.length - 1)]);
      for (let v = 0; v < 3; v++) {
        colors[(i + v) * 3] = col.r;
        colors[(i + v) * 3 + 1] = col.g;
        colors[(i + v) * 3 + 2] = col.b;
      }
    }
    nonIndexed.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return nonIndexed;
  }, [seed]);

  // Basket geometry
  const basketGeo = useMemo(() => new THREE.BoxGeometry(0.55, 0.35, 0.55), []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    // Horizontal drift — wrap around
    let x = groupRef.current.position.x + driftX * (1 / 60);
    if (driftX > 0 && x > wrapX[1]) x = wrapX[0];
    if (driftX < 0 && x < wrapX[0]) x = wrapX[1];
    groupRef.current.position.x = x;
    // Vertical bob
    groupRef.current.position.y = startY + Math.sin(t * bobSpeed + seed) * bobAmp;
    // Very slight sway
    groupRef.current.rotation.z = Math.sin(t * 0.28 + seed) * 0.04;
  });

  return (
    <group ref={groupRef} position={position} scale={[scale, scale * 1.35, scale]} frustumCulled={false}>
      {/* Envelope */}
      <mesh geometry={envelopeGeo} renderOrder={5}>
        <meshLambertMaterial vertexColors side={THREE.DoubleSide} fog={false} />
      </mesh>
      {/* Basket */}
      <mesh geometry={basketGeo} position={[0, -1.52, 0]}>
        <meshLambertMaterial color="#8B6914" fog={false} />
      </mesh>
      {/* Ropes — 4 thin cylinders */}
      {[[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]].map(([rx, rz], i) => (
        <mesh key={i} position={[rx, -1.1, rz]}>
          <cylinderGeometry args={[0.012, 0.012, 0.85, 4]} />
          <meshLambertMaterial color="#5C4200" fog={false} />
        </mesh>
      ))}
      {/* Opening glow at the bottom of the envelope */}
      <mesh position={[0, -0.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.22, 6]} />
        <meshBasicMaterial color="#FF9040" transparent opacity={0.7} fog={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

function SummerBalloons() {
  // Generate balloons procedurally on an EVEN ring around the scene centre so
  // they fill every direction — no hand-placed forward bias. Each gets an
  // evenly-spaced azimuth (+ small jitter); height is tied to radius (near ones
  // ride higher/overhead, far ones sit lower) so the middle of the dome fills
  // too. Drift sign alternates by index so they never co-migrate into a clump.
  const RING_COUNT = 11;
  const balloons = useMemo(() => {
    return Array.from({ length: RING_COUNT }, (_, i) => {
      const azimuth = ((i + 0.5) / RING_COUNT) * Math.PI * 2 + (rng(i * 5 + 1) * 2 - 1) * 0.22;
      const rNorm = rng(i * 7 + 3); // 0 near .. 1 far
      const radius = 30 + rNorm * 50; // 30..80
      const x = Math.sin(azimuth) * radius;
      const z = Math.cos(azimuth) * radius;
      const y = 16 + (1 - rNorm) * 22 + rng(i * 11 + 2) * 5; // near→~43 high, far→~16
      return {
        position: [x, y, z],
        driftX: (i % 2 === 0 ? 1 : -1) * (0.18 + rng(i * 13 + 4) * 0.16),
        bobAmp: 0.45 + rng(i * 3 + 6) * 0.3,
        bobSpeed: 0.24 + rng(i * 9 + 8) * 0.2,
        scale: 1.15 + rng(i * 6 + 5) * 0.5,
        seed: i % 4,
        wrapX: [-(radius + 18), radius + 18],
      };
    });
  }, []);

  return (
    <>
      {balloons.map((b, i) => (
        <HotAirBalloon key={i} {...b} />
      ))}
    </>
  );
}

// ─── AUTUMN: Migrating Bird V-Formation ──────────────────────────────────────

/**
 * One low-poly bird.
 * Each wing is a swept, kinked plane (root → elbow → swept tip) that beats up
 * and down about the forward axis with a graceful, faster-downstroke rhythm.
 * Body has a small head and a tail fin for a recognisable silhouette, and the
 * whole bird banks gently so it doesn't read as flat/horizontal.
 */
function Bird({ index, flapOffset, flapSpeed, vx, vy, vz, formOffset }) {
  const groupRef = useRef();
  const leftWingRef = useRef();
  const rightWingRef = useRef();

  // Swept wing — extends along +x (forward = +z). Two triangles: root→elbow,
  // elbow→swept tip, so the silhouette tapers and sweeps back like a real wing.
  const wingGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      // triangle 1: root-leading, root-trailing, elbow
      0, 0, 0.16,
      0, 0, -0.2,
      0.78, 0, -0.04,
      // triangle 2: root-leading, elbow, swept tip
      0, 0, 0.16,
      0.78, 0, -0.04,
      1.55, 0, -0.46,
    ]);
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Body, head, tail
  const bodyGeo = useMemo(() => new THREE.SphereGeometry(0.12, 5, 4), []);
  const headGeo = useMemo(() => new THREE.SphereGeometry(0.08, 5, 4), []);
  const tailGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      0, 0, 0,
      -0.16, 0, -0.42,
      0.16, 0, -0.42,
    ]);
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;

    // Formation drift across the sky
    const speed = 0.9; // world units per second (feels slow and distant)
    let px = groupRef.current.position.x + vx * speed * (1 / 60);
    let pz = groupRef.current.position.z + vz * speed * (1 / 60);

    // Wrap: once past one side, teleport to the other
    if (px > 160) px = -160;
    if (px < -160) px = 160;
    if (pz > 20) pz = -200;

    groupRef.current.position.x = px;
    groupRef.current.position.z = pz;
    groupRef.current.position.y = vy + Math.sin(t * 0.18 + flapOffset) * 0.6;

    // Flap: a shallow resting dihedral (slight upward V) plus a beat with a
    // snappier downstroke (2nd harmonic) so it looks like real flapping, not a
    // even sine wobble.
    const phase = t * flapSpeed + flapOffset;
    const beat = 0.52 * Math.sin(phase) + 0.14 * Math.sin(2 * phase);
    const dihedral = 0.16;
    const a = dihedral + beat;
    if (rightWingRef.current) rightWingRef.current.rotation.z = a;
    if (leftWingRef.current) leftWingRef.current.rotation.z = -a;

    // Gentle bank + bob so the bird isn't dead-flat horizontal.
    groupRef.current.rotation.z = Math.sin(phase) * 0.06;
    groupRef.current.rotation.x = -0.05 + Math.sin(t * 0.18 + flapOffset) * 0.04;
  });

  return (
    <group ref={groupRef} position={formOffset} frustumCulled={false}>
      {/* Body */}
      <mesh geometry={bodyGeo} scale={[0.85, 0.7, 2.1]}>
        <meshLambertMaterial color="#2A1F10" fog={false} />
      </mesh>
      {/* Head — slightly forward + up */}
      <mesh geometry={headGeo} position={[0, 0.04, 0.27]}>
        <meshLambertMaterial color="#2A1F10" fog={false} />
      </mesh>
      {/* Tail fin */}
      <mesh geometry={tailGeo} position={[0, 0, -0.18]}>
        <meshLambertMaterial color="#3D2E18" side={THREE.DoubleSide} fog={false} />
      </mesh>
      {/* Right wing — pivots at the shoulder */}
      <group ref={rightWingRef} position={[0.04, 0.02, 0.04]}>
        <mesh geometry={wingGeo}>
          <meshLambertMaterial color="#3D2E18" side={THREE.DoubleSide} fog={false} />
        </mesh>
      </group>
      {/* Left wing — mirrored across x */}
      <group ref={leftWingRef} position={[-0.04, 0.02, 0.04]}>
        <mesh geometry={wingGeo} scale={[-1, 1, 1]}>
          <meshLambertMaterial color="#3D2E18" side={THREE.DoubleSide} fog={false} />
        </mesh>
      </group>
    </group>
  );
}

function AutumnBirds() {
  // V-formation positions relative to the lead bird.
  // Leader at [0,0,0]; wings spread back at ±x, slightly staggered in z.
  const formation = useMemo(() => {
    const v = [];
    // Lead
    v.push([0, 0, 0]);
    // Left wing
    for (let i = 1; i <= 5; i++) v.push([-i * 2.2, 0, i * 1.8]);
    // Right wing
    for (let i = 1; i <= 5; i++) v.push([i * 2.2, 0, i * 1.8]);
    return v;
  }, []);

  // Direction: drifting across from right to left, slightly into distance
  const vx = -1;
  const vz = -0.15;
  const baseY = 46;

  return (
    <group
      // Rotate so the formation faces the direction of travel
      rotation={[0, Math.atan2(vx, vz) + Math.PI, 0]}
    >
      {formation.map(([fx, fy, fz], i) => (
        <Bird
          key={i}
          index={i}
          flapOffset={rng(i * 7) * Math.PI * 2}
          flapSpeed={2.8 + rng(i * 13) * 0.8}
          vx={vx}
          vy={baseY + fy}
          vz={vz}
          formOffset={[fx + (rng(i + 100) - 0.5) * 0.4, baseY + fy, -120 + fz]}
        />
      ))}
    </group>
  );
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * SkyDrama — export one sky set-piece per season.
 *
 * @param {string} seasonKey   'spring' | 'summer' | 'autumn' | 'winter' | 'night'
 * @param {object} palette     season palette from Scene3D (not currently used;
 *                             reserved for future colour-matching)
 */
export function SkyDrama({ seasonKey, palette }) {
  if (seasonKey === "summer") return <SummerBalloons />;
  if (seasonKey === "autumn") return <AutumnBirds />;
  if (seasonKey === "night")  return null;
  return null;
}
