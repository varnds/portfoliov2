/**
 * PlayHints — onboarding for play mode.
 *   • WelcomeCard: a brief goal + controls card shown once on Play.
 *   • ContextHint: a small bar that changes with what you're doing — move when you
 *     land, "uncover"/"dig" when you're standing by a marker.
 */
import React from "react";
import { useGame, dismissWelcome } from "./gameStore";

const wrap = {
  position: "fixed",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 9300,
  fontFamily: "'IBM Plex Mono', monospace",
};

export function WelcomeCard() {
  const { playing, welcomeSeen } = useGame();
  if (!playing || welcomeSeen) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9400,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        // anchor the card LOW and keep the scrim light so your character (who
        // drops in centre-screen) stays visible instead of hidden behind the card
        paddingBottom: "8vh",
        background: "rgba(20,12,8,0.14)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          maxWidth: 440,
          width: "86%",
          background: "#FFFDF7",
          borderRadius: 16,
          padding: "26px 32px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, color: "#3A2A20", marginBottom: 10 }}>
          Someone lives here.
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, lineHeight: 1.6, color: "#5A463A" }}>
          Wander and piece together who they are — follow the glowing markers, and
          dig where the earth is turned.
        </div>
        <div
          style={{
            margin: "16px 0 4px",
            fontSize: 12,
            letterSpacing: 1,
            color: "#8A7256",
            lineHeight: 1.8,
          }}
        >
          <b>Move</b> arrow keys &nbsp;·&nbsp; <b>Look</b> drag<br />
          <b>Zoom</b> scroll &nbsp;·&nbsp; <b>Uncover</b> click the marker
        </div>
        <button
          onClick={dismissWelcome}
          style={{
            marginTop: 18,
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#fff",
            background: "#E2725B",
            borderRadius: 999,
            padding: "10px 22px",
          }}
        >
          Start exploring
        </button>
      </div>
    </div>
  );
}

export function ContextHint() {
  const { playing, welcomeSeen, landed, nearTarget, activeReveal } = useGame();
  if (!playing || !welcomeSeen || !landed || activeReveal) return null;

  // No generic movement banner — it crowded the top of the screen (and was stale:
  // movement is arrow-keys-only now). Only show a contextual prompt when you're
  // actually standing by something to interact with.
  let text = null;
  if (nearTarget) {
    text = nearTarget.buried ? "⛏  Click the mound to dig it up" : "✦  Click the glowing marker to uncover";
  }
  if (!text) return null;

  return (
    <div
      style={{
        ...wrap,
        top: 18,
        padding: "9px 18px",
        borderRadius: 999,
        background: "rgba(255,253,247,0.86)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "0 6px 20px rgba(0,0,0,0.14)",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 0.5,
        color: "#5A463A",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
}
