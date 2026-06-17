// ChaseHud — DOM overlay for chase mode. A light chase cue: a "RUN!" pill, a
// faint red edge-vignette, and a lives indicator (♥♥♥). The grabbed-artifact
// fact is now presented by the pausing RevealCard modal, so this no longer
// double-presents it. Self-gates on chase mode + an active (un-won, un-dead)
// run, so it never shows in socks/camera modes or at the finale / caught screen.
// Style mirrors PlayButton / CameraSwitcher (IBM Plex Mono labels, warm cream
// pills, terracotta #E2725B accent, soft shadows).
import React from "react";
import { useGame } from "./gameStore";

const ACCENT = "#E2725B";
const MAX_HITS = 3;

export function ChaseHud() {
  const { gameMode, playing, won, dead, hits } = useGame();

  // Self-gate: chase-only, and invisible outside an active run (gone at the
  // finale and on the caught screen, where DeathOverlay takes over).
  if (gameMode !== "chase" || !playing || won || dead) return null;

  const livesLeft = Math.max(0, MAX_HITS - hits);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9200,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes chaseRunPulse {
          0%, 100% { opacity: 0.85; transform: translateX(-50%) scale(1); }
          50%      { opacity: 1; transform: translateX(-50%) scale(1.05); }
        }
        @keyframes chaseVignette {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 0.85; }
        }
      `}</style>

      {/* Faint red edge-vignette — the chase is on. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          boxShadow: "inset 0 0 130px 30px rgba(226,114,91,0.32)",
          animation: "chaseVignette 2.6s ease-in-out infinite",
        }}
      />

      {/* "RUN!" pill — top-center, complementary to PlayButton's count. */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: "50%",
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "7px 14px",
          borderRadius: 999,
          background: "rgba(255,253,247,0.82)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow: "0 6px 20px rgba(0,0,0,0.16)",
          animation: "chaseRunPulse 1.1s ease-in-out infinite",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: ACCENT,
            boxShadow: `0 0 8px ${ACCENT}`,
          }}
        />
        <span
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2,
            color: ACCENT,
          }}
        >
          RUN!
        </span>
        <span
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
            color: "#9A8A7A",
          }}
        >
          keep moving
        </span>
      </div>

      {/* Lives indicator — top-right hearts + a plain-words count. */}
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 14px",
          borderRadius: 999,
          background: "rgba(255,253,247,0.82)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow: "0 6px 20px rgba(0,0,0,0.16)",
        }}
      >
        <span
          aria-hidden
          style={{ fontSize: 14, letterSpacing: 2, lineHeight: 1 }}
        >
          <span style={{ color: ACCENT }}>{"♥".repeat(livesLeft)}</span>
          <span style={{ color: ACCENT, opacity: 0.28 }}>{"♥".repeat(MAX_HITS - livesLeft)}</span>
        </span>
        <span
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
            color: "#9A8A7A",
          }}
        >
          {livesLeft === 1 ? "1 life left" : `${livesLeft} lives left`}
        </span>
      </div>
    </div>
  );
}
