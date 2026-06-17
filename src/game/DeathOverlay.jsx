// DeathOverlay — DOM overlay shown when the chase player has been caught 3 times
// (`dead`): a warm "Caught!" beat with a "Try again" button that drops back to
// the hero (endGame), where ▶ Play relaunches. Self-gates on chase mode so it
// never shows in socks/camera modes. Style mirrors the app HUD (IBM Plex Mono
// labels, cream pills, terracotta accent, Fraunces headline).
import React from "react";
import { useGame, endGame } from "./gameStore";

const ACCENT = "#E2725B";
const INK = "#3A2A20";
const SUBINK = "#5A463A";

export function DeathOverlay() {
  const { gameMode, playing, dead } = useGame();
  if (gameMode !== "chase" || !playing || !dead) return null;

  return (
    <div
      role="dialog"
      aria-label="Caught"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background:
          "radial-gradient(120% 90% at 50% 30%, rgba(255,253,247,0.9), rgba(245,233,214,0.88))",
        backdropFilter: "blur(12px) saturate(1.04)",
        WebkitBackdropFilter: "blur(12px) saturate(1.04)",
        animation: "deathScrimIn 0.5s ease both",
        pointerEvents: "auto",
      }}
    >
      <style>{`
        @keyframes deathScrimIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes deathCardIn {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes deathWobble {
          0%, 100% { transform: rotate(-5deg); }
          50%      { transform: rotate(5deg); }
        }
        .death-pill { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .death-pill:hover { transform: translateY(-2px); }
        .death-pill:active { transform: translateY(0); }
      `}</style>

      <div
        style={{
          textAlign: "center",
          maxWidth: 420,
          background: "#FFFDF7",
          borderRadius: 18,
          padding: "34px 32px 30px",
          boxShadow: "0 22px 54px rgba(58,42,32,0.22)",
          border: "1px solid rgba(226,114,91,0.16)",
          animation: "deathCardIn 0.55s cubic-bezier(0.2,0.7,0.3,1) both",
        }}
      >
        <div
          aria-hidden
          style={{
            fontSize: 52,
            lineHeight: 1,
            marginBottom: 14,
            display: "inline-block",
            animation: "deathWobble 1.4s ease-in-out infinite",
          }}
        >
          🧟
        </div>
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: ACCENT,
            marginBottom: 10,
          }}
        >
          Game over
        </div>
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "clamp(28px, 6vw, 40px)",
            lineHeight: 1.1,
            color: INK,
            margin: "0 0 10px",
            fontWeight: 600,
          }}
        >
          Caught!
        </h1>
        <p
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 13.5,
            lineHeight: 1.6,
            color: SUBINK,
            margin: "0 0 24px",
          }}
        >
          The shambler got you three times. No worries — dust off and have
          another go.
        </p>
        <button
          className="death-pill"
          onClick={endGame}
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
          ↺ Try again
        </button>
      </div>
    </div>
  );
}
