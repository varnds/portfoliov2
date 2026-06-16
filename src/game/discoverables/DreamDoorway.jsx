// STUB — Phase-2 agent replaces with the lone-doorway (dream) set-piece.
import React from "react";
import { Discoverable } from "../Discoverable";

export function DreamDoorway() {
  return (
    <Discoverable
      id="dream"
      position={[12, 0, -16]}
      rotationY={-0.6}
      radius={6}
      reveal={{ title: "What's next", body: "(placeholder — a door to the future)" }}
    >
      <group>
        <mesh position={[-0.9, 1.6, 0]}>
          <boxGeometry args={[0.25, 3.2, 0.25]} />
          <meshStandardMaterial color="#7A5435" roughness={1} flatShading />
        </mesh>
        <mesh position={[0.9, 1.6, 0]}>
          <boxGeometry args={[0.25, 3.2, 0.25]} />
          <meshStandardMaterial color="#7A5435" roughness={1} flatShading />
        </mesh>
        <mesh position={[0, 3.3, 0]}>
          <boxGeometry args={[2.05, 0.25, 0.25]} />
          <meshStandardMaterial color="#7A5435" roughness={1} flatShading />
        </mesh>
      </group>
    </Discoverable>
  );
}
