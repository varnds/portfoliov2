import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createWoodTexture } from "./materials";
import { getGarmentType } from "../garmentTypes";
import { buildFlatPanel } from "./clothGarment";
import { drawGarmentArt } from "./garmentArt";

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
 * A flat 2D garment illustration standing in the 3D world. The art (drawn with
 * transparency outside the silhouette in garmentArt.js) is mapped onto a thin
 * flat panel that ripples in the breeze: each frame every vertex is displaced by
 * a travelling flutter whose amplitude grows toward the free hem (vWeight²) and
 * is zero at the pinned top — so the drawing waves like a sheet of cloth without
 * becoming volumetric.
 */
function FlatGarment({ typeKey, accent, highlighted, windStrength = 0.5, index = 0 }) {
  const meshRef = useRef();

  const art = useMemo(() => drawGarmentArt(typeKey, accent), [typeKey, accent]);
  const { geometry, base, vWeight } = useMemo(
    () => buildFlatPanel(art.w, art.h),
    [art.w, art.h],
  );
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: art.texture,
        transparent: true,
        alphaTest: 0.5,
        roughness: 0.95,
        metalness: 0,
        side: THREE.DoubleSide,
        emissive: new THREE.Color("#FFE7C2"),
        emissiveMap: art.texture,
        emissiveIntensity: highlighted ? 0.35 : 0,
      }),
    [art.texture, highlighted],
  );

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
      const w = vWeight[k];
      const amp = w * w; // anchored at top, free at the hem
      // travelling diagonal ripple + a finer cross-flutter, out of the flat plane
      const flutter =
        Math.sin(bx * 15 + by * 6 + t * 2.4 * spd + ph) * 0.04 +
        Math.sin(by * 11 - t * 1.7 * spd + ph * 1.3) * 0.06 +
        Math.sin(bx * 30 + t * 3.2 * spd + ph) * 0.018;
      arr[o] = bx + Math.sin(by * 6 + t * 1.2 * spd + ph) * 0.02 * amp; // lateral sway
      arr[o + 1] = by;
      arr[o + 2] = flutter * amp * gust; // billow out of plane
    }

    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} castShadow receiveShadow />;
}

const ART_TYPES = ["LEHENGA", "KURTA", "DUPATTA", "CHURIDAR", "SAREE", "SOCK"];

export function GarmentModel({ piece, palette, highlighted, windStrength, index }) {
  const type = getGarmentType(piece);

  return (
    <group>
      <Clothespin accent={palette.accent} />
      <FlatGarment
        typeKey={ART_TYPES.includes(type) ? type : "KURTA"}
        accent={palette.accent}
        highlighted={highlighted}
        windStrength={windStrength}
        index={index}
      />
    </group>
  );
}
