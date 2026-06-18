// DropEffects — in-world flourishes for the avatar's spawn-in styles. Each reads
// the live avatarPos + a 0..1 ref the Avatar drives, and runs off refs in useFrame
// (no re-renders, no per-frame allocations). Season ground dust on spawn is handled
// separately by FootstepEffects.
//   • GlowRing  — materialize: a warm ring blooms outward on the ground.
//   • Beam      — beam-down: a soft column of light over the spawn.
//   • VoxelBits — voxel assemble: little cubes fly IN and converge onto the avatar.
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { avatarPos } from "./gameStore";
import { terrainHeight } from "../scene3d/coords";

const _o = new THREE.Object3D();

export function GlowRing({ ringRef }) {
  const g = useRef();
  const mat = useRef();
  useFrame(() => {
    const grp = g.current;
    if (!grp) return;
    const s = ringRef.current || 0; // 1 → 0 over the spawn
    grp.visible = s > 0.02;
    if (s <= 0.02) return;
    const gy = terrainHeight(avatarPos.x, avatarPos.z);
    grp.position.set(avatarPos.x, gy + 0.06, avatarPos.z);
    const rad = 0.4 + (1 - s) * 2.1; // bloom outward as it fades
    grp.scale.set(rad, rad, rad);
    if (mat.current) mat.current.opacity = s * 0.8;
  });
  return (
    <group ref={g} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[0.6, 0.82, 44]} />
        <meshBasicMaterial
          ref={mat}
          color="#FFE3A8"
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export function Beam({ beamRef }) {
  const g = useRef();
  const mat = useRef();
  useFrame(() => {
    const grp = g.current;
    if (!grp) return;
    const s = beamRef.current || 0; // fades in then out across the spawn
    grp.visible = s > 0.02;
    if (s <= 0.02) return;
    const gy = terrainHeight(avatarPos.x, avatarPos.z);
    grp.position.set(avatarPos.x, gy, avatarPos.z);
    grp.scale.set(1, 1, 1);
    if (mat.current) mat.current.opacity = s * 0.5;
  });
  return (
    <group ref={g} visible={false}>
      <mesh position={[0, 3.2, 0]}>
        <cylinderGeometry args={[0.7, 1.0, 6.4, 18, 1, true]} />
        <meshBasicMaterial
          ref={mat}
          color="#FFE0A8"
          transparent
          opacity={0.42}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

const VOXEL_N = 14;
export function VoxelBits({ bitsRef }) {
  const inst = useRef();
  const dirs = React.useMemo(
    () =>
      Array.from({ length: VOXEL_N }, (_, i) => {
        const a = (i / VOXEL_N) * Math.PI * 2 + (i % 2) * 0.5;
        const r = 1.5 + (i % 3) * 0.5;
        return { x: Math.cos(a) * r, y: 0.4 + (i % 4) * 0.55, z: Math.sin(a) * r, spin: (i % 5) - 2 };
      }),
    [],
  );
  useFrame(() => {
    const m = inst.current;
    if (!m) return;
    const s = bitsRef.current || 0; // 1 = spread out, 0 = converged onto the avatar
    m.visible = s > 0.02;
    if (s <= 0.02) return;
    const gy = terrainHeight(avatarPos.x, avatarPos.z);
    for (let i = 0; i < VOXEL_N; i += 1) {
      const d = dirs[i];
      _o.position.set(avatarPos.x + d.x * s, gy + 0.9 + d.y * s, avatarPos.z + d.z * s);
      const sc = 0.18 * (0.45 + s * 0.7);
      _o.scale.setScalar(sc);
      _o.rotation.set(s * 3 * d.spin, s * 2.2, s * 1.5);
      _o.updateMatrix();
      m.setMatrixAt(i, _o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={inst} args={[undefined, undefined, VOXEL_N]} frustumCulled={false} visible={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#C9A36B" roughness={0.72} metalness={0} />
    </instancedMesh>
  );
}
