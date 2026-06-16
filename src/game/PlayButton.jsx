/** PlayButton — drops the avatar into the 3D world / exits play mode. Shows a
 *  small progress count while playing. Only visible in the loaded 3D view. */
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
        position: "fixed",
        bottom: 74,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9000,
        border: "none",
        cursor: "pointer",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: "#fff",
        background: "#E2725B",
        borderRadius: 999,
        padding: "12px 26px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
      }}
    >
      {playing
        ? `Exit · ${discovered.size}${total ? `/${total}` : ""} found${landed ? "" : " · landing…"}`
        : "▶ Play"}
    </button>
  );
}
