// STUB — Phase-2 agent replaces with the beacon (inspiration) set-piece.
import React from "react";
import { Discoverable } from "../Discoverable";

export function Beacon() {
  return (
    <Discoverable
      id="inspiration"
      position={[30, 0, -30]}
      radius={7}
      reveal={{ title: "What I look up to", body: "(placeholder — who lit the way)" }}
    >
      <group>
        <mesh position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.3, 0.45, 3, 8]} />
          <meshStandardMaterial color="#9A8C7A" roughness={1} flatShading />
        </mesh>
        <mesh position={[0, 3.2, 0]}>
          <sphereGeometry args={[0.45, 14, 12]} />
          <meshBasicMaterial color="#FFE6A8" toneMapped={false} />
        </mesh>
      </group>
    </Discoverable>
  );
}
