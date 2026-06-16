/**
 * SnowDrifts.jsx — low-poly snow mounds/layers accumulating on the ground
 * between the winter foliage. Seeded scatter, seated on the terrain, clear of
 * the clothesline yard.
 */

import React, { useMemo } from "react";
import * as THREE from "three";
import { seededRng } from "./particleUtils";
import { terrainHeight } from "./coords";

export function SnowDrifts({ count = 46 }) {
  const drifts = useMemo(() => {
    const arr = [];
    let i = 0;
    let guard = 0;
    while (arr.length < count && guard < count * 12) {
      guard += 1;
      i += 1;
      const x = (seededRng(i + 3100) - 0.5) * 150;
      const z = -8 + (seededRng(i + 3601) - 0.5) * 150;
      if (Math.hypot(x, z) < 17) continue; // keep the clothesline yard clear
      const y = terrainHeight(x, z);
      const s = 1.4 + seededRng(i + 3102) * 3.4;
      arr.push({
        x,
        y,
        z,
        sx: s * (1 + seededRng(i + 3103) * 0.7),
        sz: s * (1 + seededRng(i + 3104) * 0.7),
        sy: 0.45 + seededRng(i + 3105) * 0.6, // rounded drifts that catch light
        rot: seededRng(i + 3106) * Math.PI,
      });
    }
    return arr;
  }, [count]);

  return (
    <group name="snow-drifts">
      {drifts.map((m, idx) => (
        <mesh
          key={idx}
          position={[m.x, m.y + m.sy * 0.25, m.z]}
          rotation={[0, m.rot, 0]}
          scale={[m.sx, m.sy, m.sz]}
          receiveShadow
        >
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#EEF3FA" flatShading roughness={0.96} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}
