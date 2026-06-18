// DropEffects — in-world flourishes for the avatar entrance styles:
//   • DropBurst      — a one-shot particle burst at the landing spot. Three flavours
//                      set by the parent's kindRef before it bumps seqRef:
//                      "dust" (small puff — bounce), "blast" (wide low shockwave —
//                      comet impact), "sparkle" (rising twinkles — parachute / pop).
//   • ParachuteCanopy — a swaying chute above the avatar during the "parachute" drop.
//   • CometStreak     — a glowing trail above the avatar during the comet plunge.
// All read the live avatarPos and run off refs in useFrame (no re-renders, no
// per-frame allocations).
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { avatarPos } from "./gameStore";
import { terrainHeight } from "../scene3d/coords";

const N = 18;
const _o = new THREE.Object3D();
const DUST = new THREE.Color("#C9A36B");
const SPARK = new THREE.Color("#FFE3A0");
const DUR = 0.7;

// per-kind burst shape
const KINDS = {
  dust: { color: DUST, spd: 0.8, up: 0.55, size: 0.14, arc: 0.9, fade: false },
  blast: { color: DUST, spd: 1.9, up: 0.25, size: 0.2, arc: 0.4, fade: false },
  sparkle: { color: SPARK, spd: 0.55, up: 1.3, size: 0.085, arc: 1.4, fade: true },
};

export function DropBurst({ seqRef, kindRef }) {
  const inst = useRef();
  const lastSeq = useRef(0);
  const origin = useRef(new THREE.Vector3());
  const cfg = useRef(KINDS.dust);
  const parts = useRef(
    Array.from({ length: N }, (_, i) => ({ a: (i / N) * Math.PI * 2, spd: 1, up: 1, life: 0 }))
  );

  useFrame((_, dt) => {
    const m = inst.current;
    if (!m) return;
    const d = Math.min(dt, 0.05);

    if (seqRef.current !== lastSeq.current) {
      lastSeq.current = seqRef.current;
      const c = KINDS[kindRef.current] || KINDS.dust;
      cfg.current = c;
      origin.current.set(avatarPos.x, terrainHeight(avatarPos.x, avatarPos.z) + 0.12, avatarPos.z);
      if (m.material) m.material.color.copy(c.color);
      parts.current.forEach((p, i) => {
        p.a = (i / N) * Math.PI * 2 + (i % 3) * 0.3;
        p.spd = c.spd * (0.7 + (i % 5) * 0.12);
        p.up = c.up * (0.6 + (i % 4) * 0.2);
        p.life = DUR;
      });
    }

    const c = cfg.current;
    let any = false;
    for (let i = 0; i < N; i += 1) {
      const p = parts.current[i];
      if (p.life <= 0) {
        _o.position.set(0, -999, 0);
        _o.scale.setScalar(0.0001);
        _o.updateMatrix();
        m.setMatrixAt(i, _o.matrix);
        continue;
      }
      any = true;
      p.life = Math.max(0, p.life - d);
      const t = 1 - p.life / DUR; // 0→1
      const r = p.spd * t;
      _o.position.set(
        origin.current.x + Math.cos(p.a) * r,
        origin.current.y + p.up * Math.sin(t * Math.PI) * c.arc,
        origin.current.z + Math.sin(p.a) * r
      );
      const grow = c.fade ? 1 - t * 0.65 : Math.sin(t * Math.PI);
      _o.scale.setScalar(Math.max(0.001, c.size * grow));
      _o.updateMatrix();
      m.setMatrixAt(i, _o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    m.visible = any;
  });

  return (
    <instancedMesh ref={inst} args={[undefined, undefined, N]} frustumCulled={false} visible={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial color={DUST} roughness={0.9} metalness={0} transparent opacity={0.92} />
    </instancedMesh>
  );
}

export function ParachuteCanopy({ canopyRef }) {
  const g = useRef();
  useFrame((st) => {
    const grp = g.current;
    if (!grp) return;
    const s = canopyRef.current || 0; // 0..1
    grp.visible = s > 0.01;
    if (s <= 0.01) return;
    const t = st.clock.elapsedTime;
    grp.position.set(avatarPos.x + Math.sin(t * 2.1) * 0.18, avatarPos.y + 2.0, avatarPos.z);
    grp.rotation.z = Math.sin(t * 2.1) * 0.16;
    grp.scale.setScalar(s);
  });
  return (
    <group ref={g} visible={false}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <coneGeometry args={[0.95, 0.55, 14, 1, true]} />
        <meshStandardMaterial color="#E2725B" roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <torusGeometry args={[0.9, 0.04, 6, 18]} />
        <meshStandardMaterial color="#C45B45" roughness={0.85} />
      </mesh>
      {[-0.8, -0.28, 0.28, 0.8].map((x, i) => (
        <mesh key={i} position={[x, -0.45, 0]} rotation={[0, 0, -x * 0.5]}>
          <cylinderGeometry args={[0.012, 0.012, 1.5, 5]} />
          <meshStandardMaterial color="#8A7256" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export function CometStreak({ streakRef }) {
  const g = useRef();
  const mat = useRef();
  useFrame(() => {
    const grp = g.current;
    if (!grp) return;
    const s = streakRef.current || 0; // 0..1
    grp.visible = s > 0.02;
    if (s <= 0.02) return;
    grp.position.set(avatarPos.x, avatarPos.y + 1.3, avatarPos.z);
    grp.scale.set(1, 1 + s * 2.4, 1); // stretch the trail upward
    if (mat.current) mat.current.opacity = 0.55 * s;
  });
  return (
    <group ref={g} visible={false}>
      {/* a warm tapering flame trailing UP from the falling body */}
      <mesh position={[0, 1.0, 0]}>
        <coneGeometry args={[0.3, 2.2, 8, 1, true]} />
        <meshBasicMaterial ref={mat} color="#FFCE85" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}
