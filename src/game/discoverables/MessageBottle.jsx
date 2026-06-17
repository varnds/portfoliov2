// Recovered "message in a bottle" discoverable set-piece.
// A low-poly green-glass bottle washed up on the pond shore, lying on its side
// with a cork and a rolled paper note inside. Click to reveal a short message.
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Discoverable } from "../Discoverable";
import { terrainHeight, POND_X, POND_Z } from "../../scene3d/coords";
import { WATER_Y } from "../../scene3d/Water";

// Float the bottle ON the pond surface. The Discoverable grounds its group to
// terrainHeight at (BX,BZ) (the carved basin floor, underwater); WATER_Y is the
// rendered water plane imported from Water.jsx so it tracks the real fill level.
// FLOAT_BASE lifts the bottle from that floor up to the waterline, plus a small
// freeboard so the surface cuts across the lower third of the glass (most of the
// bottle visible above water) rather than burying its centre.
const BX = POND_X;
const BZ = POND_Z + 2; // a touch toward the visible front of the pond
// On-its-side body radius ≈ 0.16 * 0.9 scale ≈ 0.14. Lift the centre ~0.06 above
// the surface so the waterline sits near the lower third of the (larger) bottle.
const FREEBOARD = 0.06;
const FLOAT_BASE = (WATER_Y + FREEBOARD) - terrainHeight(BX, BZ);

export function MessageBottle() {
  const groupRef = useRef();

  // Lay the bottle on its side: rotate around Z so the +Y body axis points along X.
  const rotation = useMemo(() => new THREE.Euler(0, 0, Math.PI / 2), []);

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    // Gentle bob + lazy roll as if floating, nudged by the water.
    g.position.y = FLOAT_BASE + Math.sin(t * 1.1) * 0.05;
    g.rotation.y = Math.sin(t * 0.5) * 0.16;
  });

  return (
    <Discoverable
      id="bottle"
      position={[BX, 0, BZ]}
      radius={5}
      reveal={{
        title: "A message I'd send myself",
        body:
          "Keep making the strange thing. The work that feels too personal to show is usually the work worth showing.",
      }}
    >
      {/* groupRef gets the bob/roll; inner group lays it on its side at ~0.7 long */}
      <group ref={groupRef}>
        <group rotation={rotation} scale={0.9}>
          {/* Glass body */}
          <mesh castShadow>
            <cylinderGeometry args={[0.16, 0.16, 0.6, 10]} />
            <meshStandardMaterial
              color="#6f9a78"
              transparent
              opacity={0.55}
              roughness={0.1}
            />
          </mesh>

          {/* Glass neck */}
          <mesh castShadow position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.07, 0.1, 0.26, 8]} />
            <meshStandardMaterial
              color="#6f9a78"
              transparent
              opacity={0.55}
              roughness={0.1}
            />
          </mesh>

          {/* Cork in the neck */}
          <mesh castShadow position={[0, 0.58, 0]}>
            <cylinderGeometry args={[0.065, 0.065, 0.12, 8]} />
            <meshStandardMaterial color="#c9a36b" roughness={0.8} />
          </mesh>

          {/* Rolled paper note inside the body */}
          <mesh position={[0, -0.02, 0]} rotation={[0, 0, 0.15]}>
            <cylinderGeometry args={[0.05, 0.05, 0.34, 8]} />
            <meshStandardMaterial color="#efe6cf" roughness={0.9} />
          </mesh>
        </group>
      </group>
    </Discoverable>
  );
}
