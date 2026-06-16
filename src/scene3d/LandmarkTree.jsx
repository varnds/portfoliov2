// Recovered scenic landmark tree for the seasonal clothesline diorama.
// One large low-poly stylized tree placed in a side clearing as a landmark.
import React, { useMemo } from "react";
import * as THREE from "three";
import { terrainHeight } from "./coords";

const TREE_X = 22;
const TREE_Z = -6;
const TRUNK_HEIGHT = 3.2;
const CANOPY_RADIUS = 2.2;

// Season tints. base = main foliage color, accents = extra small blobs.
const SEASONS = {
  summer: { base: "#4f7a3a", accents: [] },
  spring: {
    base: "#6fae53",
    accents: [
      { color: "#f2a9c4", scale: 0.42, offset: [1.1, 0.4, 0.9] },
      { color: "#f6bcd2", scale: 0.36, offset: [-1.0, 0.9, -0.6] },
    ],
  },
  autumn: { base: "#c8702e", accents: [
      { color: "#e0a13a", scale: 0.5, offset: [0.8, 0.6, -0.9] },
    ] },
  winter: {
    base: "#8a7d6b",
    accents: [
      { color: "#ffffff", scale: 0.4, offset: [1.0, 0.7, 0.7] },
      { color: "#f3f6f8", scale: 0.34, offset: [-0.9, 1.0, -0.5] },
      { color: "#ffffff", scale: 0.3, offset: [0.2, 1.4, -0.2] },
    ],
  },
  night: { base: "#2f4a36", accents: [] },
};

// Deterministic cluster of foliage blobs (no runtime randomness).
const BLOBS = [
  { offset: [0, TRUNK_HEIGHT + 0.2, 0], scale: 1.0, kind: "ico" },
  { offset: [1.1, TRUNK_HEIGHT - 0.3, 0.5], scale: 0.78, kind: "dodec" },
  { offset: [-1.0, TRUNK_HEIGHT - 0.1, -0.4], scale: 0.7, kind: "ico" },
  { offset: [0.2, TRUNK_HEIGHT + 0.9, -0.6], scale: 0.62, kind: "dodec" },
];

export function LandmarkTree({ seasonKey = "summer", palette } = {}) {
  const season = SEASONS[seasonKey] || SEASONS.summer;
  const groundY = terrainHeight(TREE_X, TREE_Z);

  const trunkGeo = useMemo(
    () => new THREE.CylinderGeometry(0.32, 0.55, TRUNK_HEIGHT, 7, 1),
    []
  );
  const icoGeo = useMemo(() => new THREE.IcosahedronGeometry(CANOPY_RADIUS, 0), []);
  const dodecGeo = useMemo(() => new THREE.DodecahedronGeometry(CANOPY_RADIUS, 0), []);

  const foliageColor = (palette && palette.foliage) || season.base;

  return (
    <group position={[TREE_X, groundY, TREE_Z]}>
      {/* Tapered trunk */}
      <mesh
        geometry={trunkGeo}
        position={[0, TRUNK_HEIGHT / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#6b4a2b" flatShading roughness={0.95} />
      </mesh>

      {/* Clustered low-poly canopy */}
      {BLOBS.map((b, i) => (
        <mesh
          key={`blob-${i}`}
          geometry={b.kind === "ico" ? icoGeo : dodecGeo}
          position={b.offset}
          scale={b.scale}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={foliageColor} flatShading roughness={0.85} />
        </mesh>
      ))}

      {/* Season accent blobs (blossoms / snow / etc.) */}
      {season.accents.map((a, i) => (
        <mesh
          key={`accent-${i}`}
          geometry={icoGeo}
          position={[
            a.offset[0],
            TRUNK_HEIGHT + a.offset[1],
            a.offset[2],
          ]}
          scale={a.scale}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={a.color} flatShading roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}
