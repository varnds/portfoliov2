/**
 * PlayHints — onboarding for play mode.
 *   • WelcomeCard: a brief goal + controls card shown once on Play.
 *   • ContextHint: a small bar that changes with what you're doing — move when you
 *     land, "uncover"/"dig" when you're standing by a marker.
 */
import React, { useState } from "react";
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
  const [leaving, setLeaving] = useState(false);
  if (!playing) return null;
  if (welcomeSeen && !leaving) return null;

  // On "Start exploring": begin the fade-out AND dismiss (welcomeSeen → the avatar
  // drops in now), so the card disappears as the character drops. Unmount after.
  const start = () => {
    if (leaving) return;
    setLeaving(true);
    dismissWelcome();
    setTimeout(() => setLeaving(false), 460);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // centred now — the avatar waits out of frame until the card fades, so it
        // can sit over the establishing shot without covering the character
        background: leaving ? "rgba(20,12,8,0)" : "rgba(20,12,8,0.20)",
        pointerEvents: "none",
        transition: "background 0.42s ease",
      }}
    >
      <div
        style={{
          ...card,
          pointerEvents: leaving ? "none" : "auto",
          maxWidth: 320,
          width: "82%",
          padding: "16px 20px 18px",
          textAlign: "center",
          opacity: leaving ? 0 : 1,
          transform: leaving ? "translateY(14px) scale(0.96)" : "translateY(0) scale(1)",
          transition: "opacity 0.42s ease, transform 0.42s cubic-bezier(0.4,0,0.2,1)",
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
          onClick={start}
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
