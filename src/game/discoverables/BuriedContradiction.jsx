// STUB — Phase-2 agent replaces with the buried "contradiction" set-piece.
import React from "react";
import { Discoverable } from "../Discoverable";

export function BuriedContradiction() {
  return (
    <Discoverable
      id="contradiction"
      position={[-8, 0, -20]}
      buried
      radius={5}
      riseFrom={-2}
      reveal={{ title: "Beneath the surface", body: "(placeholder — how I seem vs. how I am)" }}
    >
      <mesh position={[0, 0.5, 0]} rotation={[0.3, 0.6, 0]}>
        <dodecahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial color="#5B6B8C" roughness={0.9} flatShading />
      </mesh>
    </Discoverable>
  );
}
