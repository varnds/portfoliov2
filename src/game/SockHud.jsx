// SockHud — DOM HUD for socks mode: "🧦 X / 5 in basket" + a "carrying: N" hint.
// Self-gates on gameMode/playing. Styled to match PlayButton / CameraSwitcher
// (IBM Plex Mono, cream pills, terracotta accent).
import React from "react";
import { useGame } from "./gameStore";
import { useSockGame, SOCK_GOAL } from "./sockStore";

const ACCENT = "#E2725B";

export function SockHud() {
  const { gameMode, playing } = useGame();
  const { carrying, inBasket } = useSockGame();
  if (gameMode !== "socks" || !playing) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 999,
        background: "rgba(255,253,247,0.86)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "0 6px 20px rgba(0,0,0,0.14)",
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 1,
          color: "#fff",
          background: ACCENT,
          borderRadius: 999,
          padding: "6px 13px",
        }}
      >
        🧦 {inBasket} / {SOCK_GOAL} in basket
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1,
          color: carrying > 0 ? "#5A463A" : "#B9A893",
          background: carrying > 0 ? "rgba(226,114,91,0.12)" : "transparent",
          borderRadius: 999,
          padding: "6px 11px",
          transition: "color 0.2s ease, background 0.2s ease",
        }}
      >
        {carrying > 0
          ? `carrying: ${carrying} → drop at the basket`
          : "find a sock to carry"}
      </span>
    </div>
  );
}
