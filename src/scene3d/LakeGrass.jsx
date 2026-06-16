/**
 * LakeGrass — scatters small grass-tuft GLBs around the pond's organic shoreline.
 * Placement follows pondEdgeRadius(angle) so the grass hugs the irregular
 * waterline, with seeded jitter and small per-tuft scale ("not too big").
 */
import React, { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { GlbScenery } from "./GlbScenery";
import { POND_X, POND_Z, pondEdgeRadius } from "./coords";
import { seededRng } from "./particleUtils";

const URL = "/models/grass_brush.glb";
const COUNT = 24;

function buildPlacements() {
  const out = [];
  for (let i = 0; i < COUNT; i += 1) {
    const angle = (i / COUNT) * Math.PI * 2 + (seededRng(i * 13 + 5) - 0.5) * 0.42;
    const edge = pondEdgeRadius(angle);
    // sit on the bank just OUTSIDE the waterline (so it's on land, not submerged)
    const radialFrac = 1.12 + seededRng(i * 7 + 2) * 0.24; // 1.12–1.36 × edge
    const r = edge * radialFrac;
    out.push({
      key: i,
      x: POND_X + Math.cos(angle) * r,
      z: POND_Z + Math.sin(angle) * r,
      // footprint target (GlbScenery scales by max(x,z) span) — small clumps
      targetSize: 1.0 + seededRng(i * 23 + 9) * 0.5, // 1.0–1.5
      rotationY: seededRng(i * 31 + 3) * Math.PI * 2,
    });
  }
  return out;
}

export function LakeGrass() {
  const items = useMemo(buildPlacements, []);
  return (
    <group name="lake-grass">
      {items.map((it) => (
        <GlbScenery
          key={it.key}
          url={URL}
          mode="full"
          position={[it.x, 0, it.z]}
          targetSize={it.targetSize}
          rotationY={it.rotationY}
          yOffset={-0.08}
        />
      ))}
    </group>
  );
}

useGLTF.preload(URL);
