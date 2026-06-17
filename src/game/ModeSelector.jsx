/** ModeSelector — pick which game to play: Chase / Socks / Camera. Switching
 *  mode while playing drops back to the hero so ▶ Play relaunches in that mode. */
import React from "react";
import { useGame, setGameMode, endGame } from "./gameStore";

const MODES = [
  { id: "chase", label: "🧟 Chase" },
  { id: "socks", label: "🧦 Socks" },
  { id: "camera", label: "📷 Camera" },
  { id: "wash", label: "🧺 Wash Day" },
];

export function ModeSelector({ visible }) {
  const { gameMode, playing } = useGame();
  if (!visible) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: 20,
        bottom: 196,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "6px 8px",
        borderRadius: 999,
        background: "rgba(255,253,247,0.82)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "0 6px 20px rgba(0,0,0,0.14)",
      }}
    >
      <span
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1,
          color: "#9A8A7A",
          padding: "0 2px",
        }}
      >
        GAME
      </span>
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
            style={{
              border: active ? "1px solid #E2725B" : "1px solid transparent",
              cursor: "pointer",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              fontWeight: 700,
              padding: "5px 9px",
              borderRadius: 999,
              color: active ? "#fff" : "#5A463A",
              background: active ? "#E2725B" : "rgba(0,0,0,0.04)",
              transition: "background 0.2s ease, color 0.2s ease",
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
