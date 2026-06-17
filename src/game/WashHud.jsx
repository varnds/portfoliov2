// WashHud — DOM overlay for WASH DAY mode: the orange bird's narration beats +
// per-phase prompts, the F-key / button that drives wash & dry (cozy timer +
// hold-to-spin/fan mini-interaction), progress bars, and the final About reveal
// when the jacket is hung clean & dry.
//
// State machine lives in washStore.js — this layer only narrates + drives input.
// The in-world layer (WashDay.jsx) reads `holding` and fills washP/dryP each
// frame; here we just call startWashing/startDrying and toggle holding via F.
//
// Self-gates on gameMode === "wash" && playing. pointerEvents: none on the wrapper
// so the 3D world stays draggable; only the buttons re-enable pointer events.
import React, { useEffect, useRef } from "react";
import { useGame, endGame } from "./gameStore";
import {
  useWash,
  startWashing,
  startDrying,
  setHolding,
} from "./washStore";

const ACCENT = "#E2725B";
const INK = "#3A2A20";
const SUBINK = "#5A463A";
const CREAM = "rgba(255,253,247,0.82)";

// Bird narration — one warm, first-person beat per phase (the orange bird is
// helping Varna get the line dry).
const BEATS = {
  seek: "There it is — my denim jacket. And it's *filthy*. Go grab it!",
  carryDirty: "Got it! Now take it to the washing machine by the tent.",
  washing: "Pop it in — HOLD F to run the wash.",
  carryWet: "Spotless! But soaking. Carry it to the empty peg on the line.",
  drying: "Hang it up — HOLD F to fan it dry in the breeze.",
  done: "Clean, dry, and back on the line. That's the whole story — come meet me.",
};

// Placeholder about-me copy — swap with real bio later.
const ABOUT_PARAGRAPHS = [
  "I'm Varna — a designer-developer who likes building small worlds you can wander into. Most of my work lives at the seam where playful interaction meets careful craft.",
  "I care about the texture of an experience: the weight of a transition, the warmth of a palette, the little moment of delight when something responds the way you hoped it would.",
  "When I'm not arranging pixels (or wringing out denim), you'll find me chasing good light, slow coffee, and the next idea worth prototyping.",
];

export function WashHud() {
  const { gameMode, playing } = useGame();
  const { phase, washP, dryP, nearWasher, nearPeg } = useWash();

  // Live mirror of the gate so the global key listener can early-out without
  // re-binding on every store change.
  const activeRef = useRef(false);
  activeRef.current = gameMode === "wash" && playing;

  // Track whether F is currently held so keyboard auto-repeat doesn't thrash
  // setHolding (keydown fires repeatedly while a key is held).
  const fHeldRef = useRef(false);

  // Latest phase / proximity for the key handler (avoids re-binding listeners
  // every render).
  const ctx = useRef({ phase, nearWasher, nearPeg });
  ctx.current = { phase, nearWasher, nearPeg };

  // ── Global F-key handling ──────────────────────────────────────────────────
  // F ONLY — never Space (Space is the avatar jump). One keydown/keyup pair,
  // guarded on the live gate, cleaned up on unmount / when leaving play.
  useEffect(() => {
    const isF = (e) => e.code === "KeyF" || e.key === "f" || e.key === "F";

    const onDown = (e) => {
      if (!activeRef.current || !isF(e)) return;
      const { phase: ph, nearWasher: nw, nearPeg: np } = ctx.current;
      // ignore OS/browser auto-repeat
      if (e.repeat || fHeldRef.current) {
        if (ph === "washing" || ph === "drying") e.preventDefault();
        return;
      }
      fHeldRef.current = true;

      if (ph === "carryDirty" && nw) {
        e.preventDefault();
        startWashing();
      } else if (ph === "carryWet" && np) {
        e.preventDefault();
        startDrying();
      } else if (ph === "washing" || ph === "drying") {
        e.preventDefault();
        setHolding(true);
      }
    };

    const onUp = (e) => {
      if (!isF(e)) return;
      if (!fHeldRef.current) return;
      fHeldRef.current = false;
      // always release the hold (cheap no-op if not holding)
      setHolding(false);
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      fHeldRef.current = false;
      setHolding(false);
    };
  }, []);

  // Safety: if we leave play (or change phase away from a hold phase) while F is
  // still down, release the hold so it can't get stuck on.
  useEffect(() => {
    if (!activeRef.current && fHeldRef.current) {
      fHeldRef.current = false;
      setHolding(false);
    }
  }, [gameMode, playing]);
  useEffect(() => {
    if (phase !== "washing" && phase !== "drying") setHolding(false);
  }, [phase]);

  if (gameMode !== "wash" || !playing) return null;

  // ── On-screen button: press-and-hold for wash/dry, single press otherwise ──
  const holdStart = (e) => {
    e.preventDefault();
    const ph = ctx.current.phase;
    if (ph === "washing" || ph === "drying") setHolding(true);
  };
  const holdEnd = (e) => {
    e.preventDefault();
    setHolding(false);
  };
  const pressAction = () => {
    const { phase: ph, nearWasher: nw, nearPeg: np } = ctx.current;
    if (ph === "carryDirty" && nw) startWashing();
    else if (ph === "carryWet" && np) startDrying();
  };

  // What the contextual prompt + button should say (null = no action available).
  let prompt = null;
  let isHold = false;
  let progress = 0;
  let progressLabel = "";
  if (phase === "carryDirty" && nearWasher) {
    prompt = "Press F to load the washer";
  } else if (phase === "washing") {
    prompt = "HOLD F to spin";
    isHold = true;
    progress = washP;
    progressLabel = "WASH";
  } else if (phase === "carryWet" && nearPeg) {
    prompt = "Press F to hang it";
  } else if (phase === "drying") {
    prompt = "HOLD F to fan";
    isHold = true;
    progress = dryP;
    progressLabel = "DRY";
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        pointerEvents: "none",
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      <style>{`
        @keyframes washBubbleIn {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes washBob {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50%      { transform: translateY(-4px) rotate(3deg); }
        }
        @keyframes washPromptIn {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes washScrimIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes washHeadIn {
          from { opacity: 0; transform: translateY(14px); filter: blur(6px); }
          to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
        }
        @keyframes washBodyIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .wash-pill { transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease; }
        .wash-pill:hover { transform: translateY(-2px); }
        .wash-pill:active { transform: translateY(0); }
        @media (prefers-reduced-motion: reduce) {
          .wash-anim { animation-duration: 0.001s !important; animation-delay: 0s !important; }
          .wash-bird { animation: none !important; }
        }
      `}</style>

      {/* ── Bird narration (top-left corner) ── */}
      {phase !== "done" && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            maxWidth: "min(340px, 70vw)",
            display: "flex",
            alignItems: "flex-end",
            gap: 10,
          }}
        >
          <div
            className="wash-bird"
            aria-hidden
            style={{
              fontSize: 38,
              lineHeight: 1,
              flex: "0 0 auto",
              filter: "drop-shadow(0 4px 8px rgba(58,42,32,0.25))",
              animation: "washBob 2.4s ease-in-out infinite",
            }}
          >
            🐦
          </div>
          {/* keyed on phase so the bubble re-animates each beat */}
          <div
            key={phase}
            className="wash-anim"
            role="status"
            aria-live="polite"
            style={{
              position: "relative",
              background: CREAM,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              borderRadius: 16,
              borderTopLeftRadius: 4,
              padding: "11px 14px",
              boxShadow: "0 8px 24px rgba(58,42,32,0.16)",
              border: "1px solid rgba(226,114,91,0.16)",
              fontSize: 13,
              lineHeight: 1.45,
              color: INK,
              animation: "washBubbleIn 0.42s cubic-bezier(0.2,0.7,0.3,1) both",
            }}
          >
            <Beat text={BEATS[phase] || ""} />
          </div>
        </div>
      )}

      {/* ── Contextual prompt + progress (bottom-center) ── */}
      {prompt && phase !== "done" && (
        <div
          key={`prompt-${phase}-${isHold}`}
          className="wash-anim"
          style={{
            position: "absolute",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            animation: "washPromptIn 0.36s ease both",
          }}
        >
          {isHold && (
            <div
              style={{
                width: "min(260px, 70vw)",
                height: 12,
                borderRadius: 999,
                background: "rgba(255,253,247,0.9)",
                boxShadow: "0 4px 14px rgba(58,42,32,0.16)",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.round(progress * 100)}%`,
                  background: ACCENT,
                  borderRadius: 999,
                  transition: "width 0.08s linear",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  top: -18,
                  right: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 2,
                  color: SUBINK,
                }}
              >
                {progressLabel} {Math.round(progress * 100)}%
              </span>
            </div>
          )}

          <button
            className="wash-pill"
            onPointerDown={isHold ? holdStart : undefined}
            onPointerUp={isHold ? holdEnd : undefined}
            onPointerLeave={isHold ? holdEnd : undefined}
            onPointerCancel={isHold ? holdEnd : undefined}
            onClick={isHold ? undefined : pressAction}
            style={{
              pointerEvents: "auto",
              border: "none",
              cursor: "pointer",
              touchAction: "none",
              userSelect: "none",
              WebkitUserSelect: "none",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "#fff",
              background: ACCENT,
              borderRadius: 999,
              padding: "12px 22px",
              boxShadow: "0 10px 26px rgba(226,114,91,0.34)",
            }}
          >
            {prompt}
          </button>
        </div>
      )}

      {/* ── About reveal (done) ── */}
      {phase === "done" && <AboutReveal />}
    </div>
  );
}

// Renders the narration text with *emphasis* spans (the seek beat says *filthy*).
function Beat({ text }) {
  const parts = String(text).split(/(\*[^*]+\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("*") && p.endsWith("*") ? (
          <em key={i} style={{ color: ACCENT, fontStyle: "italic" }}>
            {p.slice(1, -1)}
          </em>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

function AboutReveal() {
  return (
    <div
      role="dialog"
      aria-label="About Varna"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9800,
        pointerEvents: "auto",
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
        animation: "washScrimIn 0.7s ease both",
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      <div style={{ width: "100%", maxWidth: 620, textAlign: "center" }}>
        <div
          className="wash-anim"
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: ACCENT,
            marginBottom: 14,
            animation: "washHeadIn 0.8s ease both",
          }}
        >
          🧺 The line is dry — thanks for the help
        </div>

        <h1
          className="wash-anim"
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "clamp(30px, 5.5vw, 52px)",
            lineHeight: 1.06,
            color: INK,
            margin: "0 0 22px",
            fontWeight: 600,
            animation: "washHeadIn 0.85s ease both",
            animationDelay: "0.08s",
          }}
        >
          About Varna — the whole line, finally dry.
        </h1>

        {ABOUT_PARAGRAPHS.map((p, i) => (
          <p
            key={i}
            className="wash-anim"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 14.5,
              lineHeight: 1.7,
              color: SUBINK,
              margin: "0 auto 16px",
              maxWidth: 540,
              opacity: 0,
              animation: "washBodyIn 0.6s ease both",
              animationDelay: `${0.4 + i * 0.14}s`,
            }}
          >
            {p}
          </p>
        ))}

        <p
          className="wash-anim"
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            fontStyle: "italic",
            letterSpacing: 0.5,
            color: "#B9A893",
            margin: "8px auto 26px",
            opacity: 0,
            animation: "washBodyIn 0.6s ease both",
            animationDelay: `${0.4 + ABOUT_PARAGRAPHS.length * 0.14}s`,
          }}
        >
          (placeholder copy — real about-me text coming soon)
        </p>

        <button
          className="wash-pill wash-anim"
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
            animation: "washBodyIn 0.7s ease both",
            animationDelay: `${0.5 + ABOUT_PARAGRAPHS.length * 0.14}s`,
          }}
        >
          ← Back to the world
        </button>
      </div>
    </div>
  );
}
