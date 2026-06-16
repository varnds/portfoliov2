import React, { useMemo } from "react";
import * as THREE from "three";
import { createFabricTexture, createFabricMaterial, createWoodTexture } from "./materials";
import { getGarmentType } from "../garmentTypes";
import { garmentFill } from "./colors";
import { buildExtrudedGarmentGeometry } from "../garmentSilhouettes";

function useFabricMaterial(piece, palette, highlighted) {
  const fill = garmentFill(piece, palette, highlighted);
  const map = useMemo(
    () => createFabricTexture(piece.fabric, fill, palette.accent),
    [piece.fabric, fill, palette.accent],
  );
  return useMemo(
    () => createFabricMaterial(fill, map, palette.accent),
    [fill, map, palette.accent],
  );
}

function useWoodMaterial() {
  const map = useMemo(() => createWoodTexture("#C49A6C"), []);
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#C49A6C",
        map,
        roughness: 0.72,
        metalness: 0.02,
      }),
    [map],
  );
}

function Clothespin({ accent }) {
  const wood = useWoodMaterial();
  return (
    <group position={[0, 0.02, 0.06]}>
      <mesh rotation={[0, 0, Math.PI / 2]} material={wood} castShadow>
        <cylinderGeometry args={[0.011, 0.011, 0.07, 10]} />
      </mesh>
      {[-0.026, 0.026].map((ox, i) => (
        <mesh
          key={i}
          position={[ox, -0.006, 0.012]}
          rotation={[0.08, 0, ox > 0 ? -0.38 : 0.38]}
          material={wood}
          castShadow
        >
          <boxGeometry args={[0.011, 0.07, 0.018]} />
        </mesh>
      ))}
      <mesh position={[0, -0.018, 0.016]}>
        <sphereGeometry args={[0.009, 8, 8]} />
        <meshStandardMaterial color={accent} roughness={0.55} />
      </mesh>
    </group>
  );
}

function ExtrudedGarment({ typeKey, material }) {
  const geometry = useMemo(() => buildExtrudedGarmentGeometry(typeKey), [typeKey]);
  if (!geometry) return null;
  return <mesh geometry={geometry} material={material} castShadow receiveShadow />;
}

const INDIAN_TYPES = ["LEHENGA", "KURTA", "DUPATTA", "CHURIDAR", "SAREE", "SOCK"];

export function GarmentModel({ piece, palette, highlighted }) {
  const material = useFabricMaterial(piece, palette, highlighted);
  const type = getGarmentType(piece);

  return (
    <group>
      <Clothespin accent={palette.accent} />
      <ExtrudedGarment typeKey={INDIAN_TYPES.includes(type) ? type : "KURTA"} material={material} />
    </group>
  );
}
