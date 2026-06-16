// STUB — Phase-2 agent replaces with the buried time-capsule set-piece.
import React from "react";
import { Discoverable } from "../Discoverable";

export function TimeCapsule() {
  return (
    <Discoverable
      id="timecapsule"
      position={[14, 0, 18]}
      buried
      radius={5}
      riseFrom={-1.6}
      reveal={{ title: "A note to myself", body: "(placeholder — an old dream)" }}
    >
      <mesh position={[0, 0.3, 0]} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[0.7, 0.5, 0.5]} />
        <meshStandardMaterial color="#8A6B4A" roughness={0.85} flatShading />
      </mesh>
    </Discoverable>
  );
}
