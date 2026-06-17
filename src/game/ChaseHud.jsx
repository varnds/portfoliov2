// ChaseHud — DOM overlay for chase mode. Presents a grabbed artifact as a
// NON-BLOCKING celebratory "fact flash" (auto-dismisses, never pauses the run),
// plus a light chase cue: a "RUN!" pill and a faint red edge-vignette. Renders
// nothing unless we're actively playing and haven't won yet, so it vanishes at
// the finale. Style language mirrors PlayButton / CameraSwitcher (IBM Plex Mono
// labels, warm cream pills, terracotta #E2725B accent, soft shadows).
import React, { useEffect, useRef, useState } from "react";
import { useGame, closeReveal } from "./gameStore";

const FLASH_MS = 2400; // how long a grabbed-fact toast stays before auto-dismiss
const ACCENT = "#E2725B";

export function ChaseHud() {
  const { playing, won, activeReveal } = useGame();

  // Local copy of the fact so the toast can finish its exit animation even
  // after the store's activeReveal has been cleared by closeReveal().
  const [flash, setFlash] = useState(null);
  const dismissTimer = useRef(null);
  const clearTimer = useRef(null);
  const seq = useRef(0); // bump per grab so re-grabbing retriggers the animation

  useEffect(() => {
    if (!activeReveal) return;
    // A new artifact was grabbed — show it, then auto-dismiss without pausing.
    seq.current += 1;
    setFlash({ ...activeReveal, key: seq.current });
    clearTimeout(dismissTimer.current);
    clearTimeout(clearTimer.current);
    dismissTimer.current = setTimeout(() => {
      closeReveal(); // clear store state (single source of truth)
      // keep the toast on screen briefly for its fade-out, then unmount
      clearTimer.current = setTimeout(() => setFlash(null), 320);
    }, FLASH_MS);
    return () => {
      clearTimeout(dismissTimer.current);
      clearTimeout(clearTimer.current);
    };
  }, [activeReveal]);

  // Drop everything when we leave play / win — nothing lingers into the finale.
  useEffect(() => {
    if (!playing || won) {
      clearTimeout(dismissTimer.current);
      clearTimeout(clearTimer.current);
      setFlash(null);
    }
  }, [playing, won]);

  // Self-gate: invisible outside an active run.
  if (!playing || won) return null;

  const dismissing = flash && !activeReveal; // store cleared but toast exiting

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
        @keyframes chaseFlashIn {
          0%   { opacity: 0; transform: translateX(-50%) translateY(-14px) scale(0.82); }
          55%  { opacity: 1; transform: translateX(-50%) translateY(4px) scale(1.04); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes chaseFlashOut {
          from { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
          to   { opacity: 0; transform: translateX(-50%) translateY(-10px) scale(0.94); }
        }
        @keyframes chaseConfetti {
          0%   { opacity: 0; transform: translateY(0) scale(0.4) rotate(0deg); }
          25%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-26px) scale(1) rotate(160deg); }
        }
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

      {/* Non-blocking fact flash — celebratory pop near top-center. */}
      {flash && (
        <div
          key={flash.key}
          style={{
            position: "absolute",
            top: 70,
            left: "50%",
            width: 340,
            maxWidth: "84vw",
            transform: "translateX(-50%)",
            animation: dismissing
              ? "chaseFlashOut 0.3s ease forwards"
              : "chaseFlashIn 0.42s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          {/* lightweight CSS confetti accents */}
          {!dismissing &&
            CONFETTI.map((c, i) => (
              <span
                key={i}
                aria-hidden
                style={{
                  position: "absolute",
                  top: 2,
                  left: c.left,
                  width: c.size,
                  height: c.size,
                  borderRadius: c.round ? "50%" : 2,
                  background: c.color,
                  animation: `chaseConfetti 1s ease-out ${c.delay}s both`,
                }}
              />
            ))}

          <div
            style={{
              position: "relative",
              padding: "13px 18px",
              borderRadius: 14,
              background: "rgba(255,253,247,0.82)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: `1px solid rgba(226,114,91,0.35)`,
              boxShadow: "0 14px 34px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: ACCENT,
                marginBottom: 5,
              }}
            >
              ✦ Found · {flash.title || "A fragment of me"}
            </div>
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 13,
                lineHeight: 1.5,
                color: "#3A2A20",
              }}
            >
              {flash.body || "(content coming soon)"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Static confetti specks — purely decorative, kept light.
const CONFETTI = [
  { left: "12%", size: 6, color: "#E2725B", delay: 0.02, round: true },
  { left: "30%", size: 5, color: "#F2C14E", delay: 0.1, round: false },
  { left: "52%", size: 7, color: "#7BA05B", delay: 0.04, round: true },
  { left: "70%", size: 5, color: "#E2725B", delay: 0.14, round: false },
  { left: "88%", size: 6, color: "#F2C14E", delay: 0.08, round: true },
];
