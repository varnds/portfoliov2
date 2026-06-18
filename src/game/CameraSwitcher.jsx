/** Camera controls in the left rail: MODE (Follow / Free) and a framing DISTANCE
 *  toggle (Near / Far). All exposed as toggles. */
import React from "react";
import { useGame, setCameraMode, setCameraDist } from "./gameStore";
import { RAIL_LABEL, RAIL_ROW, railChip } from "./railStyles";

const MODES = [
  { id: "follow", label: "Follow" },
  { id: "free", label: "Free" },
];
const DISTS = [
  { id: "near", label: "Near" },
  { id: "far", label: "Far" },
];

export function CameraSwitcher({ visible }) {
  const { cameraMode, cameraDist } = useGame();
  if (!visible) return null;
  return (
    <div>
      <div style={RAIL_LABEL}>Camera</div>
      <div style={RAIL_ROW}>
        {MODES.map((m) => (
          <button key={m.id} onClick={() => setCameraMode(m.id)} style={railChip(m.id === cameraMode)}>
            {m.label}
          </button>
        ))}
        {DISTS.map((d) => (
          <button key={d.id} onClick={() => setCameraDist(d.id)} style={railChip(d.id === cameraDist)}>
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}
