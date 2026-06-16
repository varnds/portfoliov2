/**
 * GlbModel — renders a GLB centered at LOCAL origin (base at y=0), scaled to
 * `targetSize` (largest dimension). Unlike GlbScenery it does NOT apply a world
 * position or terrain height, so it composes cleanly INSIDE a <Discoverable>
 * (which already handles placement + grounding + the buried rise).
 */
import React, { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export function GlbModel({
  url,
  targetSize = 3,
  rotationY = 0,
  yOffset = 0,
  hideNames = null,
  tint = null,
}) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const c = scene.clone(true);
    c.updateWorldMatrix(true, true);

    if (hideNames) {
      const re = new RegExp(hideNames, "i");
      c.traverse((o) => {
        if (!o.isMesh) return;
        const n = `${o.name} ${o.parent ? o.parent.name : ""}`;
        if (re.test(n)) o.visible = false;
      });
    }
    if (tint) {
      const tc = new THREE.Color(tint);
      c.traverse((o) => {
        if (o.isMesh && o.material) {
          const m = o.material.clone();
          if (m.color) m.color = m.color.clone().lerp(tc, 0.5);
          o.material = m;
        }
      });
    }

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
    c.position.set(-center.x, -box.min.y, -center.z); // base on the ground, centered
    const g = new THREE.Group();
    g.add(c);
    g.scale.setScalar(targetSize / Math.max(size.x, size.y, size.z, 0.001));
    return g;
  }, [scene, targetSize, hideNames, tint]);

  return <primitive object={model} position={[0, yOffset, 0]} rotation={[0, rotationY, 0]} />;
}

useGLTF.preload("/models/portal.glb");
useGLTF.preload("/models/skull.glb");
useGLTF.preload("/models/gravestone.glb");
