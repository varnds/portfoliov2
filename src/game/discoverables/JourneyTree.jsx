// STUB — Phase-2 agent replaces this with the exposed-root "Journey Tree".
import React from "react";
import { Discoverable } from "../Discoverable";

export function JourneyTree() {
  return (
    <Discoverable
      id="roots"
      position={[-26, 0, -12]}
      buried
      radius={6}
      riseFrom={-2.5}
      reveal={{ title: "My roots & journey", body: "(placeholder — where I come from)" }}
    >
      <group>
        <mesh position={[0, 1, 0]}>
          <cylinderGeometry args={[0.18, 0.3, 2, 8]} />
          <meshStandardMaterial color="#6b4a32" roughness={1} flatShading />
        </mesh>
        <mesh position={[0, 2.1, 0]}>
          <icosahedronGeometry args={[0.95, 0]} />
          <meshStandardMaterial color="#C2410C" roughness={1} flatShading />
        </mesh>
      </group>
    </Discoverable>
  );
}
