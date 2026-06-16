/**
 * LakeGrass — small low-poly grass tufts scattered around the pond's organic
 * shoreline (placement follows pondEdgeRadius(angle)).
 *
 * NOTE: this used to instance grass_brush.glb, but that model's geometry made
 * grounding unreliable (its bounding box didn't correspond to the visible blade
 * base, so the tufts floated no matter how they were offset). Replaced with
 * PROCEDURAL blades whose bases sit at local y=0 — so a single static
 * `position={[x, terrainHeight(x,z), z]}` grounds them exactly like the shore
 * rocks, which are known to sit correctly on the ground.
 */
import React, { useMemo } from "react";
import * as THREE from "three";
import { POND_X, POND_Z, pondEdgeRadius, terrainHeight } from "./coords";
import { seededRng } from "./particleUtils";

const COUNT = 40;

// A single grass blade: a thin tapered shape standing on its base (y=0 → up).
// Built once and shared; per-blade transforms vary the look.
const BLADE_GEO = (() => {
  // tapered quad: wide at base, narrow at tip, with a slight forward bend baked in
  const w = 0.5; // base half-width (scaled down per-tuft)
  const h = 1.0; // unit height (scaled per-tuft)
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

const GRASS_MATS = [
  new THREE.MeshStandardMaterial({ color: "#6FA84B", flatShading: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
  new THREE.MeshStandardMaterial({ color: "#7CB85A", flatShading: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
  new THREE.MeshStandardMaterial({ color: "#5E9440", flatShading: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
];

function buildPlacements() {
  const out = [];
  for (let i = 0; i < COUNT; i += 1) {
    const angle = (i / COUNT) * Math.PI * 2 + (seededRng(i * 13 + 5) - 0.5) * 0.5;
    const edge = pondEdgeRadius(angle);
    const radialFrac = 1.06 + seededRng(i * 7 + 2) * 0.3; // 1.06–1.36 × edge (on the bank)
    const r = edge * radialFrac;
    out.push({
      key: i,
      x: POND_X + Math.cos(angle) * r,
      z: POND_Z + Math.sin(angle) * r,
      height: 0.7 + seededRng(i * 23 + 9) * 0.7, // 0.7–1.4 tall — small tufts
      rotationY: seededRng(i * 31 + 3) * Math.PI * 2,
      seed: i,
    });
  }
  return out;
}

/** A tuft = a fan of blades, all rooted at local y=0 (so the group grounds cleanly). */
function GrassTuft({ x, z, height, rotationY, seed }) {
  const blades = useMemo(() => {
    const n = 5 + Math.floor(seededRng(seed * 3 + 1) * 3); // 5–7 blades
    const arr = [];
    for (let b = 0; b < n; b += 1) {
      const a = (b / n) * Math.PI * 2 + seededRng(seed * 7 + b) * 0.6;
      const spread = 0.12 + seededRng(seed * 5 + b) * 0.18; // splay outward
      const bh = height * (0.7 + seededRng(seed * 11 + b) * 0.5);
      const bw = 0.18 + seededRng(seed * 13 + b) * 0.12;
      arr.push({
        rotY: a,
        // tilt outward from vertical so blades fan; base stays at y=0
        tilt: spread + seededRng(seed * 17 + b) * 0.15,
        scale: [bw, bh, bw],
        mat: GRASS_MATS[b % GRASS_MATS.length],
      });
    }
    return arr;
  }, [height, seed]);

  // Base at local y=0 → grounds exactly like ShoreRocks via the static prop.
  return (
    <group position={[x, terrainHeight(x, z), z]} rotation={[0, rotationY, 0]}>
      {blades.map((bl, i) => (
        <group key={i} rotation={[bl.tilt, bl.rotY, 0]}>
          <mesh geometry={BLADE_GEO} scale={bl.scale} material={bl.mat} castShadow receiveShadow />
        </group>
      ))}
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
