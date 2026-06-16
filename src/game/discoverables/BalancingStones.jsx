// STUB — Phase-2 agent replaces with the balancing-stones (ethos) set-piece.
import React from "react";
import { Discoverable } from "../Discoverable";

export function BalancingStones() {
  return (
    <Discoverable
      id="ethos"
      position={[20, 0, -6]}
      radius={5}
      reveal={{ title: "How I think", body: "(placeholder — my design ethos)" }}
    >
      <group>
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[0.8, 0.5, 0.7]} />
          <meshStandardMaterial color="#9a8f86" roughness={1} flatShading />
        </mesh>
        <mesh position={[0, 0.75, 0]}>
          <boxGeometry args={[0.55, 0.4, 0.5]} />
          <meshStandardMaterial color="#b0a59b" roughness={1} flatShading />
        </mesh>
        <mesh position={[0, 1.1, 0]}>
          <boxGeometry args={[0.35, 0.3, 0.32]} />
          <meshStandardMaterial color="#8a7f76" roughness={1} flatShading />
        </mesh>
      </group>
    </Discoverable>
  );
}
