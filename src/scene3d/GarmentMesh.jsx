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
  interactive = true,
}) {
  const groupRef = useRef();
  const clothRef = useRef();

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    // Just a gentle whole-garment pendulum from the pins — the cloth's own
    // per-vertex ripple (ClothGarment) carries the fabric billow now, so this
    // stays small to avoid the old stiff "swinging board" read.
    const t = clock.getElapsedTime();
    const spd = 1 / Math.max(windStrength, 0.2);
    const ph = index * 1.7;
    groupRef.current.rotation.z =
      Math.sin(t * 0.7 * spd + ph) * THREE.MathUtils.degToRad(1.6) +
      Math.sin(t * 1.9 * spd + ph) * THREE.MathUtils.degToRad(0.5);
  });

  // In the 3D explore world the garments are scenery, not buttons — when not
  // interactive, attach no pointer/click handlers (and no pointer cursor).
  const handlers = interactive
    ? {
        onPointerOver: (e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
          onPointerOver?.(e);
        },
        onPointerOut: (e) => {
          document.body.style.cursor = "";
          onPointerOut?.(e);
        },
        onClick,
      }
    : {};

  return (
    <group ref={groupRef} position={position}>
      <group ref={clothRef} {...handlers}>
        <GarmentModel
          piece={piece}
          palette={palette}
          highlighted={highlighted}
          windStrength={windStrength}
          index={index}
        />
      </group>
    </group>
  );
}
