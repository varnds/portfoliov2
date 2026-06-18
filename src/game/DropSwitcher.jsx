/** Pick the avatar's entrance animation. Renders in-flow as a labeled row in the
 *  left control rail. Takes effect on the next (re)start / Replay. */
import React from "react";
import { useGame, setDropStyle } from "./gameStore";
import { RAIL_LABEL, RAIL_ROW, railChip } from "./railStyles";

const DROPS = [
  { id: "bounce", label: "Bounce" },
  { id: "parachute", label: "Chute" },
  { id: "comet", label: "Comet" },
  { id: "pop", label: "Pop" },
];

export function DropSwitcher({ visible }) {
  const { dropStyle } = useGame();
  if (!visible) return null;
  return (
    <div>
      <div style={RAIL_LABEL}>Drop-in</div>
      <div style={RAIL_ROW}>
        {DROPS.map((d) => (
          <button key={d.id} onClick={() => setDropStyle(d.id)} style={railChip(d.id === dropStyle)}>
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}
