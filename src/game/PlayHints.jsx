/**
 * PlayHints — onboarding for play mode.
 *   • WelcomeCard: a brief goal + controls card shown once on Play.
 *   • ContextHint: a small bar that changes with what you're doing — move when you
 *     land, "uncover"/"dig" when you're standing by a marker.
 */
import React from "react";
import { useGame, dismissWelcome } from "./gameStore";
import { card, primaryBtn, glass, SUBINK } from "./uiKit";

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
          ...card,
          pointerEvents: "auto",
          maxWidth: 320,
          width: "82%",
          padding: "16px 20px 18px",
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, color: "#3A2A20", marginBottom: 5 }}>
          Someone lives here.
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, lineHeight: 1.5, color: "#5A463A" }}>
          Wander and piece together who they are — follow the markers, dig where the
          earth is turned.
        </div>
        <div
          style={{
            margin: "11px 0 0",
            fontSize: 10.5,
            letterSpacing: 0.5,
            color: "#8A7256",
            lineHeight: 1.7,
          }}
        >
          <b>Move</b> arrows &nbsp;·&nbsp; <b>Look</b> drag &nbsp;·&nbsp; <b>Zoom</b> scroll
        </div>
        <button
          onClick={dismissWelcome}
          style={{
            ...primaryBtn,
            marginTop: 13,
            fontSize: 11,
            letterSpacing: 1.5,
            padding: "8px 18px",
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
        ...glass,
        top: 18,
        padding: "8px 16px",
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 600,
        letterSpacing: 0.5,
        color: SUBINK,
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
}
