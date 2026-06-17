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
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        color: "#fff",
        background: "#E2725B",
        borderRadius: 10,
        padding: "10px 12px",
        boxShadow: "0 6px 16px rgba(226,114,91,0.3)",
      }}
    >
      {playing
        ? `Exit · ${discovered.size}${total ? `/${total}` : ""} found${landed ? "" : " · landing…"}`
        : "▶ Play"}
    </button>
  );
}
