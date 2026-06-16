// STUB — Phase-2 agent replaces with the pond-reflection (recharge) set-piece.
import React from "react";
import { Discoverable } from "../Discoverable";

export function PondReflection() {
  return (
    <Discoverable
      id="recharge"
      position={[-15, 0, 4]}
      radius={7}
      reveal={{ title: "What recharges me", body: "(placeholder — solitude by the water)" }}
    >
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.2, 24]} />
        <meshBasicMaterial color="#8FD0E0" transparent opacity={0.6} />
      </mesh>
    </Discoverable>
  );
}
