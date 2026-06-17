/**
 * RevealCard — the fragment shown when a discoverable is uncovered. Docked to the
 * RIGHT as a small panel with NO backdrop, so the 3D scene stays fully visible
 * (and still explorable) behind it instead of being covered by a modal.
 */
import React from "react";
import { useGame, closeReveal } from "./gameStore";

export function RevealCard() {
  const { activeReveal, playing } = useGame();
  // During the chase, ChaseHud presents grabs as a transient, non-blocking
  // flash — so this card must NOT also pop. It only renders outside play.
  if (playing || !activeReveal) return null;
  const { title, body } = activeReveal;
  return (
    <div
      style={{
        position: "fixed",
        right: 18,
        top: "50%",
        transform: "translateY(-50%) rotate(-0.6deg)",
        width: 320,
        maxWidth: "42vw",
        zIndex: 9500,
        background: "#FFFDF7",
        borderRadius: 14,
        padding: "22px 24px",
        boxShadow: "0 18px 44px rgba(0,0,0,0.26)",
        pointerEvents: "auto",
        animation: "revealIn 0.35s ease",
      }}
    >
      <style>{`@keyframes revealIn{from{opacity:0;transform:translateY(-50%) translateX(24px) rotate(-0.6deg)}to{opacity:1;transform:translateY(-50%) translateX(0) rotate(-0.6deg)}}`}</style>
      <button
        onClick={closeReveal}
        aria-label="Close"
        style={{
          position: "absolute",
          top: 10,
          right: 12,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
          color: "#B9A893",
        }}
      >
        ×
      </button>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: "#3A2A20", marginBottom: 8, paddingRight: 14 }}>
        {title || "A fragment of me"}
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13.5, lineHeight: 1.6, color: "#5A463A" }}>
        {body || "(content coming soon)"}
      </div>
      <button
        onClick={closeReveal}
        style={{
          marginTop: 16,
          border: "none",
          cursor: "pointer",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "#fff",
          background: "#E2725B",
          borderRadius: 999,
          padding: "8px 16px",
        }}
      >
        Keep exploring
      </button>
    </div>
  );
}
