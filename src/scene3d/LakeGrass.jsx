/**
 * LakeGrass — scatters small grass-tuft GLBs around the pond's organic shoreline.
 * Placement follows pondEdgeRadius(angle) so the grass hugs the irregular
 * waterline, with seeded jitter and small per-tuft scale ("not too big").
 *
 * The grass_brush.glb ships with an alpha-MASKED ("MASK", alphaCutoff ~0.456)
 * material whose visibility lives entirely in a baseColor alpha texture (a grass
 * "card"). With the default white baseColorFactor and that cutout, the tufts
 * render invisible. On top of that, the model's tall axis is local +Z, and the
 * GLB's two SceneRoot matrices cancel out — so the tuft lies FLAT on the ground
 * (tall axis = world Z) instead of standing up.
 *
 * Fix (local to LakeGrass so other GlbScenery callers are untouched): load the
 * GLB ourselves, override the mesh material with a simple flat low-poly green
 * MeshStandardMaterial (no alpha mask), rotate the tuft upright (Z->Y), then
 * recenter / scale / ground exactly like GlbScenery so placement still works.
 */
import React, { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { POND_X, POND_Z, pondEdgeRadius, terrainHeight } from "./coords";
import { seededRng } from "./particleUtils";

const URL = "/models/grass_brush.glb";
const COUNT = 40;

// Pleasant low-poly grass green, double-sided so thin blades read from any angle.
const GRASS_MAT = new THREE.MeshStandardMaterial({
  color: "#6FA84B",
  flatShading: true,
  roughness: 0.9,
  metalness: 0,
  side: THREE.DoubleSide,
});

function buildPlacements() {
  const out = [];
  for (let i = 0; i < COUNT; i += 1) {
    const angle = (i / COUNT) * Math.PI * 2 + (seededRng(i * 13 + 5) - 0.5) * 0.42;
    const edge = pondEdgeRadius(angle);
    // sit on the bank just OUTSIDE the waterline (so it's on land, not submerged)
    const radialFrac = 1.12 + seededRng(i * 7 + 2) * 0.24; // 1.12–1.36 × edge
    const r = edge * radialFrac;
    out.push({
      key: i,
      x: POND_X + Math.cos(angle) * r,
      z: POND_Z + Math.sin(angle) * r,
      // small, clearly-visible tufts: ~1.2–2.2 units tall
      targetHeight: 1.2 + seededRng(i * 23 + 9) * 1.0,
      rotationY: seededRng(i * 31 + 3) * Math.PI * 2,
    });
  }
  return out;
}

function GrassTuft({ x, z, targetHeight, rotationY }) {
  const { scene } = useGLTF(URL);

  const model = useMemo(() => {
    const c = scene.clone(true);

    // Override the alpha-masked grass-card material with a solid green so the
    // tufts actually draw. Keep shadows.
    c.traverse((o) => {
      if (o.isMesh) {
        o.material = GRASS_MAT;
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    // Stand the tuft upright: the GLB's tall axis is local +Z and the root
    // matrices cancel, so rotate -90° about X to bring +Z up into world +Y.
    // (+90° points it DOWN, which left the base floating in the air.)
    c.rotation.x = -Math.PI / 2;
    c.updateWorldMatrix(true, true);

    // Recenter on the footprint base and ground at y=0 (in the wrapper group),
    // mirroring GlbScenery, then scale to the desired height.
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    c.traverse((o) => {
      if (o.isMesh && o.visible) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        box.union(tmp);
      }
    });
    if (box.isEmpty()) return c;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    c.position.set(-center.x, -box.min.y, -center.z);

    const g = new THREE.Group();
    g.add(c);
    // Scale so the tuft stands ~targetHeight units tall (small but visible).
    g.scale.setScalar(targetHeight / Math.max(size.y, 0.001));
    return g;
  }, [scene, targetHeight]);

  // Deterministic grounding, exactly like ShoreRocks: the recenter above puts
  // the tuft's base at local y=0, so a single static position prop grounds it.
  // The -0.1 tucks the base slightly into the sand. No imperative mutation, so
  // R3F re-renders can't desync the placement.
  return (
    <primitive
      object={model}
      position={[x, terrainHeight(x, z) - 0.1, z]}
      rotation={[0, rotationY, 0]}
    />
  );
}

export function LakeGrass() {
  const items = useMemo(buildPlacements, []);
  return (
    <group name="lake-grass">
      {items.map((it) => (
        <GrassTuft
          key={it.key}
          x={it.x}
          z={it.z}
          targetHeight={it.targetHeight}
          rotationY={it.rotationY}
        />
      ))}
    </group>
  );
}

useGLTF.preload(URL);
