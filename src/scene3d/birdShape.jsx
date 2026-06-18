// The deep-orange bird body, shared by the ambient OrangeBird (Props.jsx) and the
// Wash Day BirdGuide so they are visibly the SAME bird. Local forward is +X (the
// beak points along +X); callers face it with rotation.y = atan2(-dz, dx).
import React from "react";

export function OrangeBirdShape({ wingL, wingR }) {
  return (
    <>
      {/* body */}
      <mesh castShadow>
        <sphereGeometry args={[0.5, 16, 14]} />
        <meshStandardMaterial color="#EA580C" roughness={0.85} />
      </mesh>
      {/* belly */}
      <mesh position={[0.16, -0.16, 0]} scale={[0.85, 0.8, 0.95]}>
        <sphereGeometry args={[0.42, 16, 14]} />
        <meshStandardMaterial color="#FCD9A8" roughness={0.9} />
      </mesh>
      {/* head */}
      <mesh position={[0.46, 0.28, 0]} castShadow>
        <sphereGeometry args={[0.3, 14, 12]} />
        <meshStandardMaterial color="#F97316" roughness={0.82} />
      </mesh>
      {/* beak (+X) — black */}
      <mesh position={[0.74, 0.26, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.08, 0.22, 8]} />
        <meshStandardMaterial color="#1A1208" roughness={0.6} />
      </mesh>
      {/* eyes */}
      <mesh position={[0.56, 0.36, 0.14]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#1A1208" roughness={0.4} />
      </mesh>
      <mesh position={[0.56, 0.36, -0.14]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#1A1208" roughness={0.4} />
      </mesh>
      {/* tail */}
      <mesh position={[-0.5, 0.05, 0]} rotation={[0, 0, 0.5]} castShadow>
        <coneGeometry args={[0.22, 0.7, 6]} />
        <meshStandardMaterial color="#C2410C" roughness={0.85} />
      </mesh>
      {/* wings (flap via the passed refs) */}
      <group ref={wingL} position={[0, 0.18, 0.12]}>
        <mesh position={[0, 0, 0.36]} rotation={[0.3, 0, 0]} castShadow>
          <boxGeometry args={[0.5, 0.05, 0.66]} />
          <meshStandardMaterial color="#D9480F" roughness={0.85} />
        </mesh>
      </group>
      <group ref={wingR} position={[0, 0.18, -0.12]}>
        <mesh position={[0, 0, -0.36]} rotation={[-0.3, 0, 0]} castShadow>
          <boxGeometry args={[0.5, 0.05, 0.66]} />
          <meshStandardMaterial color="#D9480F" roughness={0.85} />
        </mesh>
      </group>
    </>
  );
}
