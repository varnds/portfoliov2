/**
 * Foliage — recovered seasonal vegetation scatter for the diorama.
 *
 * Procedurally places low-poly trees / shrubs / rocks in a ring around the
 * clothesline, season-tinted, kept clear of the pond. Rebuilt from a partial
 * recovery of the original (the original's per-type meshes were lost); this is a
 * faithful low-poly re-creation driven by the same ring + pond-mask placement.
 */
import React, { useMemo } from "react";
import * as THREE from "three";
import { terrainHeight, POND_X, POND_Z, POND_RADIUS } from "./coords";

function seeded(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const SEASON = {
  summer: { trunk: "#7a5230", canopy: ["#4f7a3a", "#5d8a44"], shrub: "#5a7d3a", rock: ["#9b8c79", "#857560"] },
  spring: { trunk: "#7a5230", canopy: ["#6fae53", "#86c266"], shrub: "#7bb85e", rock: ["#a99e8c", "#8f8472"] },
  autumn: { trunk: "#6e4a2a", canopy: ["#c8702e", "#b8852f", "#9c5a26"], shrub: "#b06a2e", rock: ["#9b8a74", "#82715c"] },
  winter: { trunk: "#5f4a38", canopy: ["#8a9aa0", "#9fb0b4"], shrub: "#90a0a4", rock: ["#aeb4b8", "#949a9e"] },
  night:  { trunk: "#3a2c20", canopy: ["#2f4a36", "#36543d"], shrub: "#2c4632", rock: ["#5a5550", "#48443f"] },
};

function buildItems(seasonKey) {
  const INNER = 18;
  const OUTER = 120;
  const rings = [
    { ang: 4.5, dist: 95, patchR: 16, count: 12 },
    { ang: 5.8, dist: 115, patchR: 20, count: 13 },
    { ang: 2.5, dist: 130, patchR: 18, count: 12 },
    { ang: 0.95, dist: 62, patchR: 12, count: 11 },
    { ang: -1.1, dist: 40, patchR: 11, count: 12 },
    { ang: 3.4, dist: 50, patchR: 13, count: 10 },
    { ang: 1.6, dist: 78, patchR: 16, count: 11 },
  ];
  const items = [];
  let k = 1;
  for (const ring of rings) {
    const cx = Math.cos(ring.ang) * ring.dist;
    const cz = Math.sin(ring.ang) * ring.dist;
    for (let i = 0; i < ring.count; i += 1) {
      k += 1;
      const a = seeded(k * 1.3) * Math.PI * 2;
      const rr = Math.sqrt(seeded(k * 2.1)) * ring.patchR;
      const x = cx + Math.cos(a) * rr;
      const z = cz + Math.sin(a) * rr;
      const r = Math.sqrt(x * x + z * z);
      if (r < INNER || r > OUTER) continue;
      const pdx = x - POND_X;
      const pdz = z - POND_Z;
      if (pdx * pdx + pdz * pdz < (POND_RADIUS + 4) * (POND_RADIUS + 4)) continue;
      const roll = seeded(k * 5.7);
      const type = roll < 0.6 ? "tree" : roll < 0.82 ? "shrub" : "rock";
      const scale = 0.8 + seeded(k * 7.3) * 0.7;
      const rotY = seeded(k * 9.1) * Math.PI * 2;
      items.push({ x, y: terrainHeight(x, z), z, type, scale, rotY, seed: k });
    }
  }
  return items;
}

function Tree({ pal, seed, scale }) {
  const canopyColor = pal.canopy[Math.floor(seeded(seed * 3.3) * pal.canopy.length)];
  const blobs = useMemo(() => {
    const out = [];
    const n = 3;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2 + seeded(seed + i) * 1.5;
      out.push({
        pos: [Math.cos(a) * 0.45, 1.9 + i * 0.32, Math.sin(a) * 0.45],
        s: 0.95 - i * 0.12,
      });
    }
    return out;
  }, [seed]);
  return (
    <group scale={scale}>
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.12, 0.2, 1.8, 6]} />
        <meshStandardMaterial color={pal.trunk} roughness={1} flatShading />
      </mesh>
      {blobs.map((b, i) => (
        <mesh key={i} position={b.pos} castShadow receiveShadow>
          <icosahedronGeometry args={[b.s, 0]} />
          <meshStandardMaterial color={canopyColor} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Shrub({ pal, scale }) {
  return (
    <mesh position={[0, 0.35 * scale, 0]} scale={scale} castShadow receiveShadow>
      <icosahedronGeometry args={[0.5, 0]} />
      <meshStandardMaterial color={pal.shrub} roughness={1} flatShading />
    </mesh>
  );
}

function Rock({ pal, seed, scale }) {
  const color = pal.rock[Math.floor(seeded(seed * 4.4) * pal.rock.length)];
  return (
    <mesh position={[0, 0.18 * scale, 0]} scale={[scale, scale * 0.7, scale]} castShadow receiveShadow>
      <dodecahedronGeometry args={[0.4, 0]} />
      <meshStandardMaterial color={color} roughness={1} flatShading />
    </mesh>
  );
}

export function Foliage({ seasonKey = "summer", palette } = {}) {
  const pal = SEASON[seasonKey] || SEASON.summer;
  const items = useMemo(() => buildItems(seasonKey), [seasonKey]);
  return (
    <group>
      {items.map((it) => (
        <group key={it.seed} position={[it.x, it.y, it.z]} rotation={[0, it.rotY, 0]}>
          {it.type === "tree" && <Tree pal={pal} seed={it.seed} scale={it.scale} />}
          {it.type === "shrub" && <Shrub pal={pal} scale={it.scale} />}
          {it.type === "rock" && <Rock pal={pal} seed={it.seed} scale={it.scale} />}
        </group>
      ))}
    </group>
  );
}
