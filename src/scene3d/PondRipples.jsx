// Recovered pond-ripple effect for the seasonal clothesline diorama.
// Renders 3 expanding white ring ripples on the pond surface, each scaling
// outward from the center and fading as it grows, staggered by phase so the
// pond reads as gently rippling. Pure useFrame animation, no external deps.

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { POND_X, POND_Z, POND_RADIUS, terrainHeight } from "./coords";

const RIPPLE_COUNT = 3;
const CYCLE = 3.2; // seconds for one ripple to grow and fade out

export function PondRipples({ seasonKey, palette } = {}) {
  // Slightly above the carved basin floor so the rings never z-fight the water.
  const waterY = useMemo(() => terrainHeight(POND_X, POND_Z) + 0.06, []);
  const maxScale = POND_RADIUS * 0.9;

  // Seed deterministic per-ripple data from the index (no randomness at runtime).
  const ripples = useMemo(
    () =>
      Array.from({ length: RIPPLE_COUNT }, (_, i) => ({
        phase: i / RIPPLE_COUNT, // 0, 1/3, 2/3 — staggered emanation
      })),
    []
  );

  const refs = useRef([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    for (let i = 0; i < ripples.length; i++) {
      const mesh = refs.current[i];
      if (!mesh) continue;

      // Normalized progress through this ripple's growth cycle (0 -> 1).
      let p = ((t / CYCLE) + ripples[i].phase) % 1;
      if (p < 0) p += 1;

      const scale = THREE.MathUtils.lerp(0.001, maxScale, p);
      mesh.scale.set(scale, scale, scale);

      // Fade from ~0.5 at birth to 0 as it reaches the rim.
      mesh.material.opacity = 0.5 * (1 - p);
    }
  });

  return (
    <group position={[POND_X, waterY, POND_Z]}>
      {ripples.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => (refs.current[i] = el)}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          {/* Thin flat ring, scaled up at runtime. */}
          <ringGeometry args={[0.82, 1, 48]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
