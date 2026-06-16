import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GarmentModel } from "./GarmentModels";

export function GarmentMesh({
  piece,
  index,
  position,
  palette,
  windStrength,
  highlighted,
  onPointerOver,
  onPointerOut,
  onClick,
}) {
  const groupRef = useRef();
  const clothRef = useRef();

  useFrame(({ clock }) => {
    if (!groupRef.current || !clothRef.current) return;
    const speed = 9 + (index % 3) * 1.4;
    const t = clock.getElapsedTime();
    const sway = Math.sin((t * speed) / windStrength) * THREE.MathUtils.degToRad(3.8);
    const billow = Math.sin((t * speed * 0.65) / windStrength) * 0.018;
    groupRef.current.rotation.z = sway;
    clothRef.current.rotation.x = billow;
  });

  return (
    <group ref={groupRef} position={position}>
      <group
        ref={clothRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
          onPointerOver?.(e);
        }}
        onPointerOut={(e) => {
          document.body.style.cursor = "";
          onPointerOut?.(e);
        }}
        onClick={onClick}
      >
        <GarmentModel piece={piece} palette={palette} highlighted={highlighted} />
      </group>
    </group>
  );
}
