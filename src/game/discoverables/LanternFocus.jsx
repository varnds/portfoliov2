// STUB — Phase-2 agent replaces with the lantern (focus) set-piece.
import React from "react";
import { Discoverable } from "../Discoverable";

export function LanternFocus() {
  return (
    <Discoverable
      id="focus"
      position={[8, 0, 4]}
      radius={5}
      reveal={{ title: "Where I focus", body: "(placeholder — clearest after dark)" }}
    >
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[0.4, 0.6, 0.4]} />
        <meshStandardMaterial color="#C28A3A" emissive="#FFE08A" emissiveIntensity={0.6} roughness={0.6} />
      </mesh>
    </Discoverable>
  );
}
