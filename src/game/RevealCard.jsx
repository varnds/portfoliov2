/**
 * RevealCard — the fragment shown when a discoverable is uncovered.
 *
 * In CHASE mode this is the pause-to-read presentation: discovering an artifact
 * freezes the chase (setPaused(true)) and this shows as a READABLE, centered
 * modal so the player can actually read about Varna while the zombie holds.
 * Dismissing ("Continue") clears the reveal and unfreezes the chase.
 *
 * Outside chase mode it stays null while playing (the other modes present grabs
 * their own way), and renders the small docked panel otherwise.
 */
import React, { useEffect } from "react";
import { useGame, closeReveal, setPaused } from "./gameStore";

const ACCENT = "#E2725B";

export function RevealCard() {
  const { activeReveal, playing, gameMode } = useGame();
  const isChase = gameMode === "chase";

  // Pause-to-read: while a reveal is open during a chase run, freeze the world.
  // Unfreeze whenever the reveal clears (Continue, or the run ends).
  useEffect(() => {
    if (isChase && playing && activeReveal) {
      setPaused(true);
      return () => setPaused(false);
    }
  }, [isChase, playing, activeReveal]);

  if (!activeReveal) return null;

  const dismiss = () => {
    closeReveal();
    if (isChase) setPaused(false);
  };

  const { title, body } = activeReveal;

  // ── CHASE: centered, blocking, readable modal (the pausing presentation). ──
  if (isChase && playing) {
    return (
      <div
        role="dialog"
        aria-label={title || "A fragment of me"}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          background:
            "radial-gradient(120% 90% at 50% 30%, rgba(255,253,247,0.82), rgba(245,233,214,0.8))",
          backdropFilter: "blur(10px) saturate(1.04)",
          WebkitBackdropFilter: "blur(10px) saturate(1.04)",
          animation: "revealScrimIn 0.4s ease both",
          pointerEvents: "auto",
        }}
      >
        <style>{`
          @keyframes revealScrimIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes revealCardIn {
            from { opacity: 0; transform: translateY(16px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0)    scale(1); }
          }
          .reveal-pill { transition: transform 0.18s ease, box-shadow 0.18s ease; }
          .reveal-pill:hover { transform: translateY(-2px); }
          .reveal-pill:active { transform: translateY(0); }
        `}</style>
        <div
          style={{
            position: "relative",
            maxWidth: 460,
            width: "100%",
            background: "#FFFDF7",
            borderRadius: 18,
            padding: "30px 32px 28px",
            boxShadow: "0 22px 54px rgba(58,42,32,0.22)",
            border: "1px solid rgba(226,114,91,0.16)",
            animation: "revealCardIn 0.5s cubic-bezier(0.2,0.7,0.3,1) both",
          }}
        >
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: ACCENT,
              marginBottom: 10,
            }}
          >
            ✦ You found a fragment
          </div>
          <div
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 26,
              lineHeight: 1.15,
              color: "#3A2A20",
              marginBottom: 12,
            }}
          >
            {title || "A fragment of me"}
          </div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 14,
              lineHeight: 1.65,
              color: "#5A463A",
              marginBottom: 24,
            }}
          >
            {body || "(content coming soon)"}
          </div>
          <button
            className="reveal-pill"
            onClick={dismiss}
            style={{
              border: "none",
              cursor: "pointer",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#fff",
              background: ACCENT,
              borderRadius: 999,
              padding: "12px 28px",
              boxShadow: "0 10px 26px rgba(226,114,91,0.34)",
            }}
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // Outside chase: stay out of the way while playing other modes.
  if (playing) return null;

  // ── Non-playing: small docked panel, no backdrop. ──
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
        onClick={dismiss}
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
        onClick={dismiss}
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
