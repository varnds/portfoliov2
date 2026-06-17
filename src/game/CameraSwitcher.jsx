/** Toggle the follow-camera behavior live. Renders in-flow as a labeled row
 *  inside the left control rail. */
import React from "react";
import { useGame, setCameraMode } from "./gameStore";
import { RAIL_LABEL, RAIL_ROW, railChip } from "./railStyles";

const MODES = [
  { id: "both", label: "Follow" },
  { id: "free", label: "Free" },
];

export function CameraSwitcher({ visible }) {
  const { cameraMode } = useGame();
  if (!visible) return null;
  return (
    <div>
      <div style={RAIL_LABEL}>Camera</div>
      <div style={RAIL_ROW}>
        {MODES.map((m) => {
          const active = m.id === cameraMode;
          return (
            <button key={m.id} onClick={() => setCameraMode(m.id)} style={railChip(active)}>
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
