// AboutOverlay — DOM reward beat for socks mode. Shown once all 5 socks land in
// the basket (sockStore `done`). A warm "About Varna" reveal that fades in, then
// hands back to the world via endGame(). Matches the FinaleGallery aesthetic:
// cream scrim, blur, terracotta accent, CSS-only animation.
import React from "react";
import { useGame, endGame } from "./gameStore";
import { useSockGame } from "./sockStore";

const ACCENT = "#E2725B";
const INK = "#3A2A20";
const SUBINK = "#5A463A";

// Placeholder about-me copy — swap with real bio later.
const PARAGRAPHS = [
  "I'm Varna — a designer-developer who likes building small worlds you can wander into. Most of my work lives at the seam where playful interaction meets careful craft.",
  "I care about the texture of an experience: the weight of a transition, the warmth of a palette, the little moment of delight when something responds the way you hoped it would.",
  "When I'm not arranging pixels (or stray socks), you'll find me chasing good light, slow coffee, and the next idea worth prototyping.",
];

export function AboutOverlay() {
  const { gameMode, playing } = useGame();
  const { done } = useSockGame();
  // require `playing` so the overlay can't linger over the hero after endGame
  if (gameMode !== "socks" || !playing || !done) return null;

  return (
    <div
      role="dialog"
      aria-label="About Varna"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9800,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        padding: "clamp(28px, 6vh, 72px) 20px",
        background:
          "radial-gradient(120% 90% at 50% 0%, rgba(255,253,247,0.94), rgba(245,233,214,0.92))",
        backdropFilter: "blur(14px) saturate(1.05)",
        WebkitBackdropFilter: "blur(14px) saturate(1.05)",
        animation: "aboutScrimIn 0.7s ease both",
        pointerEvents: "auto",
      }}
    >
      <style>{`
        @keyframes aboutScrimIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes aboutHeadIn {
          from { opacity: 0; transform: translateY(14px); filter: blur(6px); }
          to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
        }
        @keyframes aboutBodyIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .about-pill { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .about-pill:hover { transform: translateY(-2px); }
        .about-pill:active { transform: translateY(0); }
        @media (prefers-reduced-motion: reduce) {
          .about-anim { animation-duration: 0.001s !important; animation-delay: 0s !important; }
        }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 620,
          textAlign: "center",
        }}
      >
        <div
          className="about-anim"
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: ACCENT,
            marginBottom: 14,
            animation: "aboutHeadIn 0.8s ease both",
          }}
        >
          🧺 All socks home — thanks for the help
        </div>

        <h1
          className="about-anim"
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "clamp(34px, 6vw, 56px)",
            lineHeight: 1.05,
            color: INK,
            margin: "0 0 22px",
            fontWeight: 600,
            animation: "aboutHeadIn 0.85s ease both",
            animationDelay: "0.08s",
          }}
        >
          About Varna
        </h1>

        {PARAGRAPHS.map((p, i) => (
          <p
            key={i}
            className="about-anim"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 14.5,
              lineHeight: 1.7,
              color: SUBINK,
              margin: "0 auto 16px",
              maxWidth: 540,
              opacity: 0,
              animation: "aboutBodyIn 0.6s ease both",
              animationDelay: `${0.4 + i * 0.14}s`,
            }}
          >
            {p}
          </p>
        ))}

        <p
          className="about-anim"
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            fontStyle: "italic",
            letterSpacing: 0.5,
            color: "#B9A893",
            margin: "8px auto 26px",
            opacity: 0,
            animation: "aboutBodyIn 0.6s ease both",
            animationDelay: `${0.4 + PARAGRAPHS.length * 0.14}s`,
          }}
        >
          (placeholder copy — real about-me text coming soon)
        </p>

        <button
          className="about-pill about-anim"
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
            padding: "13px 28px",
            boxShadow: "0 10px 26px rgba(226,114,91,0.34)",
            opacity: 0,
            animation: "aboutBodyIn 0.7s ease both",
            animationDelay: `${0.5 + PARAGRAPHS.length * 0.14}s`,
          }}
        >
          ← Back to the world
        </button>
      </div>
    </div>
  );
}
