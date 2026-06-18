/** PlayButton — drops the avatar into the 3D world / exits play mode. Shows a
 *  small progress count while playing. Renders in-flow inside the left control
 *  rail (App.jsx), as the primary action at the top of the card. */
import React from "react";
import { useGame, startGame, endGame, totalCount } from "./gameStore";

export function PlayButton({ visible }) {
  const { playing, discovered, landed } = useGame();
  if (!visible) return null;
  const total = totalCount();
  return (
    <button
      onClick={() => (playing ? endGame() : startGame())}
      style={{
        width: "100%",
        border: "none",
        cursor: "pointer",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        color: "#fff",
        background: "#E2725B",
        borderRadius: 9,
        padding: "8px 10px",
        boxShadow: "0 5px 14px rgba(226,114,91,0.28)",
      }}
    >
      {playing
        ? `${landed ? "Exit" : "Landing…"} · ${discovered.size}${total ? `/${total}` : ""}`
        : "▶ Play"}
    </button>
  );
}
