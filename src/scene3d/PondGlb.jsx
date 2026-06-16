/**
 * PondGlb — the little-pond-with-fish GLB, ANIMATED (water pulse + swimming
 * fish from its baked "Take 001" clip) and BURIED into the terrain so the tall
 * tub walls sink below grade and only the water surface + grass rim show.
 *
 * GlbScenery clones via THREE clone() which drops the animation binding (and
 * mangles the 3 skinned fish), so the pond needs its own loader: SkeletonUtils
 * clone (preserves skinning) + useAnimations to play the clip. Recenter/scale/
 * ground math mirrors GlbScenery so the burial numbers stay consistent.
 */
import React, { useEffect, useMemo, useRef } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { terrainHeight } from "./coords";

const URL = "/models/little_pond__fish.glb";

export function PondGlb({ position = [0, 0, 0], targetSize = 14, yOffset = -2.4 }) {
  const groupRef = useRef();
  const { scene, animations } = useGLTF(URL);

  // SkeletonUtils clone keeps the rigged fish intact (plain clone() would not).
  const cloned = useMemo(() => skeletonClone(scene), [scene]);

  // Recenter (base at local 0, centred in x/z) + uniform scale to targetSize —
  // identical to GlbScenery so the geometry-derived burial offset still holds.
  const { offset, scaleFactor } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    return {
      offset: [-center.x, -box.min.y, -center.z],
      scaleFactor: targetSize / Math.max(size.x, size.z, 0.001),
    };
  }, [cloned, targetSize]);

  // Play the baked clip(s) on the cloned hierarchy (mixer bound to groupRef).
  const { actions } = useAnimations(animations, groupRef);
  useEffect(() => {
    const acts = Object.values(actions || {});
    acts.forEach((a) => {
      a.reset();
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.play();
    });
    return () => acts.forEach((a) => a.stop());
  }, [actions]);

  const [x, , z] = position;
  const y = terrainHeight(x, z) + yOffset;

  return (
    <group ref={groupRef} position={[x, y, z]} scale={scaleFactor}>
      <group position={offset}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}

useGLTF.preload(URL);
