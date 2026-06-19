/** ModeSelector — pick which game to play: Chase / Socks / Camera / Wash Day.
 *  Switching mode while playing drops back to the hero so ▶ Play relaunches in
 *  that mode. Renders in-flow as a labeled row inside the left control rail. */
import React from "react";
import { useGame, setGameMode, endGame } from "./gameStore";
import { RAIL_LABEL, RAIL_ROW, railChip } from "./railStyles";

const MODES = [
  { id: "chase", label: "🧟 Chase" },
  { id: "socks", label: "🧦 Socks" },
  { id: "camera", label: "📷 Camera" },
  { id: "wash", label: "🧺 Wash Day" },
  { id: "patch", label: "🧵 Patchwork" },
];

export function ModeSelector({ visible }) {
  const { gameMode, playing } = useGame();
  if (!visible) return null;
  return (
    <div>
      <div style={RAIL_LABEL}>Game</div>
      <div style={RAIL_ROW}>
        {MODES.map((m) => {
          const active = m.id === gameMode;
          return (
            <button
              key={m.id}
              onClick={() => {
                if (m.id === gameMode) return;
                if (playing) endGame(); // back to hero; ▶ Play relaunches in the new mode
                setGameMode(m.id);
              }}
              style={railChip(active)}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
