/**
 * LakeGrass — small PROCEDURAL grass tufts ringing the pond's visible waterline.
 *
 * Showcase mode: four distinct grass styles, one per angular SECTOR around the
 * lake, so you can roam the shoreline and compare them, then pick one:
 *   Sector 0 (East ~+X)   → "Fan"    — flat tapered blades fanning out
 *   Sector 1 (North ~+Z)  → "Spikes" — thin upright spiky reeds (cones)
 *   Sector 2 (West ~−X)   → "Clump"  — low mossy mound with a few blades
 *   Sector 3 (South ~−Z)  → "Wispy"  — many thin tall near-vertical blades
 *
 * All geometry is rooted at local y=0 and each tuft renders at
 * position=[x, terrainHeight(x,z), z] — identical grounding to the shore rocks,
 * so the grass sits ON the ground (no floating).
 */
import React, { useMemo } from "react";
import * as THREE from "three";
import { POND_X, POND_Z, pondEdgeRadius, terrainHeight } from "./coords";
import { seededRng } from "./particleUtils";

const COUNT = 56;

// Shared tapered-blade geometry (base at y=0, tip at y=1), used by Fan + Wispy.
const BLADE_GEO = (() => {
  const w = 0.5;
  const h = 1.0;
  const g = new THREE.BufferGeometry();
  const verts = new Float32Array([
    -w, 0, 0, w, 0, 0, -w * 0.5, h * 0.55, 0.05,
    w, 0, 0, w * 0.5, h * 0.55, 0.05, -w * 0.5, h * 0.55, 0.05,
    -w * 0.5, h * 0.55, 0.05, w * 0.5, h * 0.55, 0.05, 0, h, 0.12,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  g.computeVertexNormals();
  return g;
})();

const MATS = [
  new THREE.MeshStandardMaterial({ color: "#6FA84B", flatShading: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
  new THREE.MeshStandardMaterial({ color: "#7CB85A", flatShading: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
  new THREE.MeshStandardMaterial({ color: "#5E9440", flatShading: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
];
const m = (i) => MATS[i % MATS.length];

function buildPlacements() {
  const out = [];
  for (let i = 0; i < COUNT; i += 1) {
    const angle = (i / COUNT) * Math.PI * 2 + (seededRng(i * 13 + 5) - 0.5) * 0.22;
    const edge = pondEdgeRadius(angle);
    const radialFrac = 1.0 + seededRng(i * 7 + 2) * 0.12; // hug the waterline
    const r = edge * radialFrac;
    // sector 0..3 by angle → which grass type
    const norm = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const type = Math.floor((norm / (Math.PI * 2)) * 4) % 4;
    out.push({
      key: i,
      x: POND_X + Math.cos(angle) * r,
      z: POND_Z + Math.sin(angle) * r,
      height: 0.35 + seededRng(i * 23 + 9) * 0.35, // small
      rotationY: seededRng(i * 31 + 3) * Math.PI * 2,
      seed: i,
      type,
    });
  }
  return out;
}

/** Type 0 — Fan: flat tapered blades splaying outward. */
function FanTuft({ height, seed }) {
  const blades = useMemo(() => {
    const n = 5 + Math.floor(seededRng(seed * 3 + 1) * 3);
    return Array.from({ length: n }, (_, b) => ({
      rotY: (b / n) * Math.PI * 2 + seededRng(seed * 7 + b) * 0.6,
      tilt: 0.18 + seededRng(seed * 17 + b) * 0.22,
      scale: [0.1 + seededRng(seed * 13 + b) * 0.07, height * (0.7 + seededRng(seed * 11 + b) * 0.5), 0.1],
      mat: b % 3,
    }));
  }, [height, seed]);
  return blades.map((bl, i) => (
    <group key={i} rotation={[bl.tilt, bl.rotY, 0]}>
      <mesh geometry={BLADE_GEO} scale={bl.scale} material={m(bl.mat)} castShadow receiveShadow />
    </group>
  ));
}

/** Type 1 — Spikes: thin upright cones, like reedy spikes. */
function SpikeTuft({ height, seed }) {
  const spikes = useMemo(() => {
    const n = 4 + Math.floor(seededRng(seed * 5 + 2) * 3);
    return Array.from({ length: n }, (_, b) => {
      const a = (b / n) * Math.PI * 2 + seededRng(seed * 9 + b) * 0.5;
      const off = 0.04 + seededRng(seed * 6 + b) * 0.06;
      const h = height * (0.9 + seededRng(seed * 11 + b) * 0.6);
      const rad = 0.035 + seededRng(seed * 8 + b) * 0.025;
      return { x: Math.cos(a) * off, z: Math.sin(a) * off, h, rad, tilt: seededRng(seed * 4 + b) * 0.18, mat: b % 3 };
    });
  }, [height, seed]);
  return spikes.map((s, i) => (
    <group key={i} position={[s.x, 0, s.z]} rotation={[s.tilt, 0, s.tilt * 0.5]}>
      {/* cone base at y=0: cone is centered, so lift by h/2 */}
      <mesh position={[0, s.h / 2, 0]} material={m(s.mat)} castShadow receiveShadow>
        <coneGeometry args={[s.rad, s.h, 5]} />
      </mesh>
    </group>
  ));
}

/** Type 2 — Clump: a low mossy mound (flattened icosahedron) with a few blades. */
function ClumpTuft({ height, seed }) {
  const blades = useMemo(() => {
    const n = 3 + Math.floor(seededRng(seed * 5 + 4) * 3);
    return Array.from({ length: n }, (_, b) => ({
      rotY: (b / n) * Math.PI * 2 + seededRng(seed * 7 + b) * 0.8,
      tilt: 0.12 + seededRng(seed * 17 + b) * 0.2,
      scale: [0.08, height * (0.6 + seededRng(seed * 11 + b) * 0.4), 0.08],
      mat: b % 3,
    }));
  }, [height, seed]);
  const moundR = 0.26 + seededRng(seed * 3 + 7) * 0.12;
  const flat = 0.45;
  return (
    <>
      <mesh position={[0, moundR * flat * 0.6, 0]} scale={[1, flat, 1]} material={m(2)} castShadow receiveShadow>
        <icosahedronGeometry args={[moundR, 0]} />
      </mesh>
      {blades.map((bl, i) => (
        <group key={i} position={[0, moundR * flat * 0.6, 0]} rotation={[bl.tilt, bl.rotY, 0]}>
          <mesh geometry={BLADE_GEO} scale={bl.scale} material={m(bl.mat)} castShadow receiveShadow />
        </group>
      ))}
    </>
  );
}

/** Type 3 — Wispy: many thin tall near-vertical blades. */
function WispyTuft({ height, seed }) {
  const blades = useMemo(() => {
    const n = 7 + Math.floor(seededRng(seed * 5 + 3) * 4);
    return Array.from({ length: n }, (_, b) => {
      const a = seededRng(seed * 9 + b) * Math.PI * 2;
      const off = seededRng(seed * 6 + b) * 0.08;
      return {
        x: Math.cos(a) * off,
        z: Math.sin(a) * off,
        rotY: seededRng(seed * 7 + b) * Math.PI * 2,
        tilt: 0.05 + seededRng(seed * 17 + b) * 0.12, // near-vertical
        scale: [0.055, height * (1.2 + seededRng(seed * 11 + b) * 0.8), 0.055],
        mat: b % 3,
      };
    });
  }, [height, seed]);
  return blades.map((bl, i) => (
    <group key={i} position={[bl.x, 0, bl.z]} rotation={[bl.tilt, bl.rotY, 0]}>
      <mesh geometry={BLADE_GEO} scale={bl.scale} material={m(bl.mat)} castShadow receiveShadow />
    </group>
  ));
}

const TYPES = [FanTuft, SpikeTuft, ClumpTuft, WispyTuft];

function GrassTuft({ x, z, height, rotationY, seed, type }) {
  const Tuft = TYPES[type] || FanTuft;
  return (
    <group position={[x, terrainHeight(x, z), z]} rotation={[0, rotationY, 0]}>
      <Tuft height={height} seed={seed} />
    </group>
  );
}

export function LakeGrass() {
  const items = useMemo(buildPlacements, []);
  return (
    <group name="lake-grass">
      {items.map((it) => (
        <GrassTuft key={it.key} {...it} />
      ))}
    </group>
  );
}
