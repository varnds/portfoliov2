// FinaleGallery — DOM overlay shown when `won` is true: the calm reward beat that
// assembles the collected identity facts into a little portrait, with a CTA that
// hands off to the 2D work / contact. Renders only while `playing && won`.
//
// The reveal is built from CSS only (no animation libs): a warm scrim fades in,
// then each collected truth card animates up one-by-one via a per-card
// `animationDelay` stagger, so the portrait feels like it's assembling itself.
// The CTA hands back to the hero (where the 2D toggle lives) via endGame().
import React from "react";
import { useGame, endGame } from "./gameStore";

const ACCENT = "#E2725B";
const INK = "#3A2A20";
const SUBINK = "#5A463A";

export function FinaleGallery() {
  const { playing, won, truths } = useGame();
  if (!playing || !won) return null;

  const facts = Array.isArray(truths) ? truths : [];
  // Headline + intro land first; cards begin staggering in after that beat.
  const CARD_BASE_DELAY = 0.55;
  const CARD_STEP = 0.12;
  const ctaDelay = CARD_BASE_DELAY + facts.length * CARD_STEP + 0.25;

  return (
    <div
      role="dialog"
      aria-label="You've met the person"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9800,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        padding: "clamp(28px, 6vh, 72px) 20px",
        background:
          "radial-gradient(120% 90% at 50% 0%, rgba(255,253,247,0.92), rgba(245,233,214,0.9))",
        backdropFilter: "blur(14px) saturate(1.05)",
        WebkitBackdropFilter: "blur(14px) saturate(1.05)",
        animation: "finaleScrimIn 0.7s ease both",
        pointerEvents: "auto",
      }}
    >
      <style>{`
        @keyframes finaleScrimIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes finaleHeadIn {
          from { opacity: 0; transform: translateY(14px); filter: blur(6px); }
          to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
        }
        @keyframes finaleCardIn {
          from { opacity: 0; transform: translateY(22px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes finaleCtaIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .finale-card { will-change: transform, opacity; }
        .finale-pill { transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease; }
        .finale-pill:hover { transform: translateY(-2px); }
        .finale-pill:active { transform: translateY(0); }
        @media (prefers-reduced-motion: reduce) {
          .finale-anim { animation-duration: 0.001s !important; animation-delay: 0s !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <header
        className="finale-anim"
        style={{
          textAlign: "center",
          maxWidth: 620,
          animation: "finaleHeadIn 0.8s ease both",
        }}
      >
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: ACCENT,
            marginBottom: 14,
          }}
        >
          ✦ The whole picture
        </div>
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "clamp(30px, 5vw, 48px)",
            lineHeight: 1.08,
            color: INK,
            margin: "0 0 12px",
            fontWeight: 600,
          }}
        >
          Okay — now you know me.
        </h1>
        <p
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 14,
            lineHeight: 1.6,
            color: SUBINK,
            margin: 0,
          }}
        >
          You found every fragment. Here they are, gathered into one little
          portrait.
        </p>
      </header>

      {/* ── Gallery ── */}
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          marginTop: "clamp(26px, 5vh, 44px)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {facts.map((t, i) => (
          <article
            key={t.id ?? i}
            className="finale-card finale-anim"
            style={{
              background: "#FFFDF7",
              borderRadius: 14,
              padding: "18px 20px",
              boxShadow: "0 14px 34px rgba(58,42,32,0.14)",
              border: "1px solid rgba(226,114,91,0.14)",
              transform: `rotate(${(i % 2 ? 1 : -1) * 0.4}deg)`,
              opacity: 0,
              animation: "finaleCardIn 0.6s cubic-bezier(0.2, 0.7, 0.3, 1) both",
              animationDelay: `${CARD_BASE_DELAY + i * CARD_STEP}s`,
            }}
          >
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: ACCENT,
                marginBottom: 8,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </div>
            <div
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 19,
                lineHeight: 1.2,
                color: INK,
                marginBottom: 7,
              }}
            >
              {t.title || "A fragment of me"}
            </div>
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12.5,
                lineHeight: 1.55,
                color: SUBINK,
              }}
            >
              {t.body || ""}
            </div>
          </article>
        ))}
      </div>

      {/* ── Closing CTA ── */}
      <footer
        className="finale-anim"
        style={{
          textAlign: "center",
          maxWidth: 560,
          marginTop: "clamp(32px, 6vh, 56px)",
          paddingBottom: 12,
          opacity: 0,
          animation: "finaleCtaIn 0.7s ease both",
          animationDelay: `${ctaDelay}s`,
        }}
      >
        <p
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "clamp(20px, 3vw, 26px)",
            lineHeight: 1.25,
            color: INK,
            margin: "0 0 8px",
          }}
        >
          You've met the person — now see what I make.
        </p>
        <p
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12.5,
            lineHeight: 1.6,
            color: SUBINK,
            margin: "0 0 22px",
          }}
        >
          This drops you back to the world — tap the <strong>2D</strong> toggle
          for the work, or reach the <strong>WORK</strong> / <strong>CREATIVE
          WORK</strong> / <strong>CONTACT</strong> links below.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "center",
          }}
        >
          <button
            className="finale-pill"
            onClick={endGame}
            style={pillStyle({ primary: true })}
          >
            See the work →
          </button>
          <a
            className="finale-pill"
            href="#contact"
            onClick={endGame}
            style={{ ...pillStyle({ primary: false }), textDecoration: "none" }}
          >
            Contact
          </a>
        </div>

        <button
          onClick={endGame}
          style={{
            marginTop: 20,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "#B9A893",
          }}
        >
          ↺ Replay
        </button>
      </footer>
    </div>
  );
}

// Mirrors the app's primary pill (see PlayButton.jsx): terracotta fill for the
// primary action, a soft outlined variant for the secondary.
function pillStyle({ primary }) {
  return {
    border: primary ? "none" : `1.5px solid ${ACCENT}`,
    cursor: "pointer",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: primary ? "#fff" : ACCENT,
    background: primary ? ACCENT : "#FFFDF7",
    borderRadius: 999,
    padding: "12px 26px",
    boxShadow: primary
      ? "0 10px 26px rgba(226,114,91,0.34)"
      : "0 6px 18px rgba(58,42,32,0.1)",
    display: "inline-flex",
    alignItems: "center",
  };
}
