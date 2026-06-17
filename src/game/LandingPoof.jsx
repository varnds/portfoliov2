/**
 * LandingPoof — a quick one-shot puff of dust on the avatar's drop-in impact.
 *
 * A ring of instanced little puff-balls that burst outward + upward from the
 * point of impact, swelling then fading over ~0.6s. Triggered by bumping the
 * number held in `seqRef` (incremented each time the avatar lands). Purely
 * visual, no physics, no per-frame allocations — all scratch objects reused.
 *
 * Takes a REF (not a value) for the trigger so a parent that mutates refs
 * without re-rendering (the avatar's per-frame loop) can still fire it: we
 * watch seqRef.current for a change inside useFrame.
 *
 * Lives INSIDE the moving avatar group, placed at the avatar's feet (local
 * origin). The puff plays out in the group's local space at the spot it lands.
 */
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const COUNT = 14;
const LIFE = 0.62; // seconds

export default function LandingPoof({ seqRef, accent = "#cbb89a" }) {
  const meshRef = useRef();
  const t = useRef(Infinity); // Infinity = inactive (nothing rendered)
  const lastSeq = useRef(seqRef ? seqRef.current : 0);

  // Per-puff scratch directions/speeds, generated once. Reused every burst.
  const puffs = useMemo(() => {
    const arr = [];
    for (let i = 0; i < COUNT; i++) {
      const a = (i / COUNT) * Math.PI * 2 + Math.random() * 0.5;
      const spread = 0.7 + Math.random() * 0.9;
      arr.push({
        dx: Math.cos(a) * spread,
        dz: Math.sin(a) * spread,
        up: 0.5 + Math.random() * 0.9,
        size: 0.18 + Math.random() * 0.22,
        rate: 0.8 + Math.random() * 0.5, // per-puff timing variance
      });
    }
    return arr;
  }, []);

  const scratch = useMemo(() => ({ obj: new THREE.Object3D() }), []);

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    // Detect a trigger bump (ref mutated without a re-render) and start a burst.
    const seq = seqRef ? seqRef.current : lastSeq.current;
    if (seq !== lastSeq.current) {
      lastSeq.current = seq;
      t.current = 0;
    }
    if (t.current === Infinity) {
      if (mesh.visible) mesh.visible = false;
      return;
    }
    t.current += Math.min(dt, 0.05);
    const { obj } = scratch;
    let anyAlive = false;
    for (let i = 0; i < COUNT; i++) {
      const p = puffs[i];
      const k = THREE.MathUtils.clamp((t.current * p.rate) / LIFE, 0, 1);
      if (k < 1) anyAlive = true;
      // ease-out outward drift; pop up then settle back down with gravity
      const ease = 1 - Math.pow(1 - k, 2);
      const x = p.dx * ease;
      const z = p.dz * ease;
      const y = p.up * (Math.sin(k * Math.PI) * 0.6) + 0.05;
      // swell in fast, shrink as it fades
      const grow = Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5);
      const s = Math.max(0.0001, p.size * (0.4 + grow) * (1 - k * 0.6));
      obj.position.set(x, y, z);
      obj.scale.setScalar(s);
      obj.rotation.set(0, 0, 0);
      obj.updateMatrix();
      mesh.setMatrixAt(i, obj.matrix);
    }
    mesh.visible = true;
    mesh.instanceMatrix.needsUpdate = true;
    // fade the whole cloud out near the end
    const fade = 1 - THREE.MathUtils.clamp((t.current - LIFE * 0.6) / (LIFE * 0.5), 0, 1);
    if (mesh.material) mesh.material.opacity = 0.7 * fade;
    if (!anyAlive) {
      t.current = Infinity;
      mesh.visible = false;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, COUNT]}
      visible={false}
      frustumCulled={false}
    >
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color={accent}
        roughness={1}
        metalness={0}
        transparent
        opacity={0.7}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
