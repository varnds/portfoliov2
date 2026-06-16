// Past careers (id="pastcareers") — a little graveyard cluster (two gravestones
// + a half-buried skull) marking the roles I've left behind. Reveals a card like
// the other finds.
import React from "react";
import { Discoverable } from "../Discoverable";
import { GlbModel } from "../GlbModel";

export function PastCareers() {
  return (
    <Discoverable
      id="pastcareers"
      position={[-20, 0, 2]}
      radius={5.5}
      reveal={{ title: "Past careers", body: "(placeholder — roles I've left behind)" }}
    >
      <group>
        {/* main gravestone — rotated 180° to show its carved face */}
        <GlbModel url="/models/gravestone.glb" targetSize={2} rotationY={Math.PI} />
        {/* smaller gravestone behind, turned */}
        <group position={[1.4, 0, -0.7]}>
          <GlbModel url="/models/gravestone.glb" targetSize={1.5} rotationY={0.5} />
        </group>
        {/* skull half-sunk into the ground at the foot, turned 90° */}
        <group position={[-0.8, 0, 0.9]}>
          <GlbModel url="/models/skull.glb" targetSize={0.8} rotationY={Math.PI / 2} yOffset={-0.3} />
        </group>
      </group>
    </Discoverable>
  );
}
