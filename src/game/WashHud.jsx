// WashHud — DOM overlay for WASH DAY mode: per-phase action prompts, the F-key /
// button that drives wash & dry (cozy timer + hold-to-spin/fan mini-interaction),
// the progress bars, a brief golden LINE-COMPLETE banner, and the final About
// reveal when the denim is hung clean & dry.
//
// The bird now SPEAKS IN-WORLD (BirdGuide.jsx), so this layer no longer renders
// the old corner 🐦 narration bubble — it only narrates via prompts + drives input.
//
// State machine lives in washStore.js — this layer only prompts + drives input.
// The in-world layer (WashDay.jsx) reads `holding` and fills washP/dryP each
// frame; here we just call startWashing/startDrying and toggle holding via F.
//
// Self-gates on gameMode === "wash" && playing. pointerEvents: none on the wrapper
// so the 3D world stays draggable; only the buttons re-enable pointer events.
import React, { useEffect, useRef, useState } from "react";
import { useGame, endGame } from "./gameStore";
import {
  useWash,
  startWashing,
  startDrying,
  setHolding,
} from "./washStore";
import { LINE_COMPLETE, ABOUT } from "./washStory";

const ACCENT = "#E2725B";
const INK = "#3A2A20";
const SUBINK = "#5A463A";
const GOLD = "#E7B36A";

// Phase prompts that drive the F-key / button (null = no action available).
function promptFor(phase, nearWasher, nearPeg, washP, dryP) {
  if (phase === "carryDirty" && nearWasher) return { prompt: "Press F to load the washer" };
  if (phase === "washing") return { prompt: "HOLD F to spin", isHold: true, progress: washP, progressLabel: "WASH" };
  if (phase === "carryWet" && nearPeg) return { prompt: "Press F to hang it" };
  if (phase === "drying") return { prompt: "HOLD F to fan", isHold: true, progress: dryP, progressLabel: "DRY" };
  return null;
}

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

  // Latest phase / proximity for the key handler (avoids re-binding listeners).
  const ctx = useRef({ phase, nearWasher, nearPeg });
  ctx.current = { phase, nearWasher, nearPeg };

  // Line-complete celebration window: when phase flips to "done" we show a golden
  // banner for ~2.5s, THEN reveal About (P1 #6 — the visual win lands first).
  const [showAbout, setShowAbout] = useState(false);
  useEffect(() => {
    if (phase === "done") {
      setShowAbout(false);
      const id = setTimeout(() => setShowAbout(true), 2500);
      return () => clearTimeout(id);
    }
    setShowAbout(false);
    return undefined;
  }, [phase]);

  // ── Global F-key handling ──────────────────────────────────────────────────
  // F ONLY — never Space (Space is the avatar jump). One keydown/keyup pair,
  // guarded on the live gate, cleaned up on unmount / when leaving play.
  useEffect(() => {
    const isF = (e) => e.code === "KeyF" || e.key === "f" || e.key === "F";

    const onDown = (e) => {
      if (!activeRef.current || !isF(e)) return;
      const { phase: ph, nearWasher: nw, nearPeg: np } = ctx.current;
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

  // Safety: release the hold if we leave play while F is still down.
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

  const p = promptFor(phase, nearWasher, nearPeg, washP, dryP) || {};
  const { prompt = null, isHold = false, progress = 0, progressLabel = "" } = p;

  // Celebration banner shows the moment we hit "done" and before About reveals.
  const celebrating = phase === "done" && !showAbout;

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
        @keyframes washBannerIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-16px) scale(0.96); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        .wash-pill { transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease; }
        .wash-pill:hover { transform: translateY(-2px); }
        .wash-pill:active { transform: translateY(0); }
        @media (prefers-reduced-motion: reduce) {
          .wash-anim { animation-duration: 0.001s !important; animation-delay: 0s !important; }
        }
      `}</style>

      {/* ── LINE-COMPLETE celebration banner (top-center, golden) ── */}
      {celebrating && (
        <div
          className="wash-anim"
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            top: "12%",
            left: "50%",
            transform: "translateX(-50%)",
            textAlign: "center",
            padding: "18px 30px",
            borderRadius: 18,
            background:
              "linear-gradient(135deg, rgba(255,248,232,0.96), rgba(247,222,178,0.94))",
            border: `1.5px solid ${GOLD}`,
            boxShadow: "0 14px 40px rgba(183,144,47,0.34)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            animation: "washBannerIn 0.55s cubic-bezier(0.2,0.7,0.3,1) both",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#B8902F",
              marginBottom: 8,
            }}
          >
            🧺 {LINE_COMPLETE.kicker}
          </div>
          <div
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "clamp(20px, 3.2vw, 30px)",
              fontWeight: 600,
              color: INK,
              lineHeight: 1.1,
            }}
          >
            {LINE_COMPLETE.line}
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

      {/* ── About reveal (after the celebration beat) ── */}
      {showAbout && <AboutReveal />}
    </div>
  );
}

function AboutReveal() {
  return (
    <div
      role="dialog"
      aria-label={ABOUT.eyebrow}
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
          {ABOUT.eyebrow}
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
          {ABOUT.headline}
        </h1>

        {ABOUT.paragraphs.map((para, i) => (
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
            {para}
          </p>
        ))}

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
            animationDelay: `${0.5 + ABOUT.paragraphs.length * 0.14}s`,
            marginTop: 10,
          }}
        >
          ← {ABOUT.cta}
        </button>
      </div>
    </div>
  );
}
