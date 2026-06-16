import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createFabricTexture, createFabricMaterial, createWoodTexture } from "./materials";
import { getGarmentType } from "../garmentTypes";
import { garmentFill } from "./colors";
import { buildClothGarment } from "./clothGarment";

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

/**
 * A draping cloth sheet that ripples in the breeze. The geometry is a subdivided
 * panel (clothGarment.js); each frame we displace every vertex by a travelling
 * flutter whose amplitude grows toward the hem (vWeight²) and is zero at the
 * pinned top, so it billows like fabric instead of swinging like a board.
 */
function ClothGarment({ typeKey, material, windStrength = 0.5, index = 0 }) {
  const meshRef = useRef();
  const { geometry, base, vWeight } = useMemo(() => buildClothGarment(typeKey), [typeKey]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.getElapsedTime();
    const spd = 1 / Math.max(windStrength, 0.2); // smaller windStrength → brisker breeze
    const ph = index * 1.7; // per-garment phase so they don't move in lockstep
    const gust = 0.7 + 0.5 * Math.sin(t * 0.5 * spd + ph); // slow swelling of the breeze
    const arr = mesh.geometry.attributes.position.array;

    for (let k = 0; k < vWeight.length; k += 1) {
      const o = k * 3;
      const bx = base[o];
      const by = base[o + 1];
      const bz = base[o + 2];
      const w = vWeight[k];
      const amp = w * w; // anchored at top, free at the hem
      // travelling diagonal ripple + a finer cross-flutter
      const flutter =
        Math.sin(bx * 15 + by * 6 + t * 2.4 * spd + ph) * 0.034 +
        Math.sin(by * 11 - t * 1.7 * spd + ph * 1.3) * 0.05 +
        Math.sin(bx * 30 + t * 3.2 * spd + ph) * 0.014;
      arr[o] = bx + Math.sin(by * 6 + t * 1.2 * spd + ph) * 0.022 * amp; // lateral sway
      arr[o + 1] = by;
      arr[o + 2] = bz + flutter * amp * gust;
    }

    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} castShadow receiveShadow />;
}

const CLOTH_TYPES = ["LEHENGA", "KURTA", "DUPATTA", "CHURIDAR", "SAREE", "SOCK"];

export function GarmentModel({ piece, palette, highlighted, windStrength, index }) {
  const material = useFabricMaterial(piece, palette, highlighted);
  const type = getGarmentType(piece);

  return (
    <group>
      <Clothespin accent={palette.accent} />
      <ClothGarment
        typeKey={CLOTH_TYPES.includes(type) ? type : "KURTA"}
        material={material}
        windStrength={windStrength}
        index={index}
      />
    </group>
  );
}
