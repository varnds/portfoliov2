// PatchHud — DOM overlay for PATCHWORK mode: a quiet "X of N patches found" tally
// during the long GATHER beat (no waypoints, no "go here" — just a warm tally), the
// per-phase action prompts + keys that drive wash & dry (load → hold-to-wash →
// hang → hold-to-fan), the progress bars, and a warm completion banner once the
// mended garment is washed and hung out to dry.
//
// State machine lives in patchStore.js — this layer only prompts + drives input.
// The in-world layer (PatchWork.jsx) reads `holding` and fills washP/dryP each
// frame; here we just call startWashing/startDrying and toggle holding via S / F.
//
// Self-gates on gameMode === "patch" && playing && landed (exactly like WashHud
// gates on landed). pointerEvents: none on the wrapper so the 3D world stays
// draggable; nothing here needs pointer events.
import React, { useEffect, useRef } from "react";
import { useGame, endGame } from "./gameStore";
import {
  usePatch,
  startWashing,
  startDrying,
  setHolding,
} from "./patchStore";

const ACCENT = "#E2725B";
const INK = "#3A2A20";
const SUBINK = "#5A463A";
const GOLD = "#E7B36A";

// Warm, non-instructional captions per phase. Never "walk to X" during gather —
// just a quiet invitation to keep wandering.
const PATCH_CAPTIONS = {
  gather: "Somewhere out here, a garment is waiting to be pieced back together.",
  toWasher: "It's whole — now wash it.",
  washing: "Hold S to wash.",
  toPeg: "Hang it on the line.",
  drying: "Hold F to fan it dry.",
};

// The orange-bird FACE icon — copied from WashHud so the caption reads as the
// same component across both modes.
function BirdFace() {
  return (
    <svg aria-hidden width="30" height="30" viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
      <circle cx="9" cy="10" r="7" fill="#F97316" />
      <circle cx="7.8" cy="11.4" r="4" fill="#FCD9A8" />
      <circle cx="10.3" cy="8.2" r="1.35" fill="#1A1208" />
      <circle cx="10.75" cy="7.8" r="0.42" fill="#FFFFFF" />
      <polygon points="15.4,9.2 19.4,10.1 15.4,11.3" fill="#1A1208" />
    </svg>
  );
}

export function PatchHud() {
  const { gameMode, playing, landed } = useGame();
  const { phase, found, total, washP, dryP, nearWasher, nearPeg } = usePatch();

  // Live mirror of the gate so the global key listener can early-out without
  // re-binding on every store change.
  const activeRef = useRef(false);
  activeRef.current = gameMode === "patch" && playing;

  // Which hold-key (s/f) is currently down, so auto-repeat doesn't thrash
  // setHolding (keydown fires repeatedly while a key is held).
  const holdKeyRef = useRef(null);

  // Latest phase / proximity for the key handler (avoids re-binding listeners).
  const ctx = useRef({ phase, nearWasher, nearPeg });
  ctx.current = { phase, nearWasher, nearPeg };

  // ── Per-action key handling: L load · S(hold) wash · H hang · F(hold) fan ──
  // L/H are single presses; S/F are press-and-hold. Guarded on the live gate,
  // cleaned up on unmount / when leaving play.
  useEffect(() => {
    const keyOf = (e) => (e.key || "").toLowerCase();

    const onDown = (e) => {
      if (!activeRef.current) return;
      const { phase: ph, nearWasher: nw, nearPeg: np } = ctx.current;
      const k = keyOf(e);

      // press actions (one-shot; ignore auto-repeat)
      if (k === "l" && ph === "toWasher" && nw) { e.preventDefault(); if (!e.repeat) startWashing(); return; }
      if (k === "h" && ph === "toPeg" && np) { e.preventDefault(); if (!e.repeat) startDrying(); return; }

      // hold actions — S washes (washing), F fans (drying)
      const isHoldKey = (k === "s" && ph === "washing") || (k === "f" && ph === "drying");
      if (isHoldKey) {
        e.preventDefault();
        if (e.repeat || holdKeyRef.current) return;
        holdKeyRef.current = k;
        setHolding(true);
      }
    };

    const onUp = (e) => {
      const k = keyOf(e);
      if (holdKeyRef.current && k === holdKeyRef.current) {
        holdKeyRef.current = null;
        setHolding(false);
      }
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      holdKeyRef.current = null;
      setHolding(false);
    };
  }, []);

  // Safety: release the hold if we leave play while a hold-key is still down.
  useEffect(() => {
    if (!activeRef.current && holdKeyRef.current) {
      holdKeyRef.current = null;
      setHolding(false);
    }
  }, [gameMode, playing]);
  useEffect(() => {
    if (phase !== "washing" && phase !== "drying") setHolding(false);
  }, [phase]);

  // Don't narrate until the avatar has actually SPAWNED (landed) — same gate as
  // WashHud, so prompts never show over the welcome modal before you exist.
  if (gameMode !== "patch" || !playing || !landed) return null;

  const isHold = phase === "washing" || phase === "drying";
  const progress = phase === "washing" ? washP : dryP;
  const progressLabel = phase === "washing" ? "WASH" : "DRY";

  // The "garment is whole!" beat: the moment the last patch lands, phase flips to
  // toWasher — celebrate the assembly before the wash prompt settles in.
  const caption = PATCH_CAPTIONS[phase];

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
        @keyframes patchPromptIn {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes patchTallyIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes patchCountPulse {
          0%   { transform: scale(1); color: ${INK}; }
          40%  { transform: scale(1.35); color: ${ACCENT}; }
          100% { transform: scale(1); color: ${INK}; }
        }
        @keyframes patchBannerIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-16px) scale(0.96); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes patchScrimIn { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .patch-anim { animation-duration: 0.001s !important; animation-delay: 0s !important; }
        }
      `}</style>

      {/* ── GATHER tally (top-center): a quiet "X of N patches found". No directions,
          no waypoints — just a warm running count. The number pulses each time it
          climbs (keyed on `found`). ── */}
      {phase === "gather" && (
        <div
          className="patch-anim"
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            top: 40,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 20px",
            borderRadius: 999,
            background: "rgba(255,253,247,0.94)",
            border: `1.5px solid ${ACCENT}`,
            boxShadow: "0 8px 22px rgba(58,42,32,0.28)",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 15,
            color: SUBINK,
            animation: "patchTallyIn 0.5s ease both",
          }}
        >
          <BirdFace />
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
            <span
              key={found}
              style={{
                display: "inline-block",
                fontWeight: 700,
                fontSize: 18,
                color: INK,
                animation: "patchCountPulse 0.5s cubic-bezier(0.2,0.7,0.3,1) both",
              }}
            >
              {found}
            </span>
            <span>of {total} patches found</span>
          </span>
        </div>
      )}

      {/* ── "The garment is whole!" beat (top-center, golden) the moment the last
          patch lands and we flip into toWasher. ── */}
      {phase === "toWasher" && (
        <div
          className="patch-anim"
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
            animation: "patchBannerIn 0.55s cubic-bezier(0.2,0.7,0.3,1) both",
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
            🧵 Every patch in place
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
            The garment is whole!
          </div>
        </div>
      )}

      {/* ── Bottom-center caption (frosted card with the bird face) — the same look
          as WashHud's bottom caption. Shown for every active phase except `done`. ── */}
      {phase !== "done" && caption && (
        <div
          key={phase}
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            bottom: 70,
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: "min(560px, 88vw)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            borderRadius: 14,
            background: "rgba(255,253,247,0.94)",
            border: `1.5px solid ${ACCENT}`,
            boxShadow: "0 8px 22px rgba(58,42,32,0.28)",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 14,
            lineHeight: 1.4,
            color: INK,
            textAlign: "center",
            animation: "patchPromptIn 0.4s ease both",
          }}
        >
          <BirdFace />
          <span>{caption}</span>
        </div>
      )}

      {/* ── Key prompt pill (bottom, under the caption): "press L to load" /
          "press H" only when actually in range. ── */}
      {phase === "toWasher" && nearWasher && (
        <KeyPrompt keyLabel="L" text="to load the washer" />
      )}
      {phase === "toPeg" && nearPeg && (
        <KeyPrompt keyLabel="H" text="to hang it on the line" />
      )}

      {/* ── Wash / dry progress bar (bottom-center). ── */}
      {isHold && (
        <div
          key={`prog-${phase}`}
          className="patch-anim"
          style={{
            position: "absolute",
            bottom: 40,
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(260px, 70vw)",
            height: 12,
            borderRadius: 999,
            background: "rgba(255,253,247,0.9)",
            boxShadow: "0 4px 14px rgba(58,42,32,0.16)",
            overflow: "hidden",
            animation: "patchPromptIn 0.36s ease both",
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

      {/* ── Completion banner ── */}
      {phase === "done" && <DoneBanner />}
    </div>
  );
}

// A small key-cap prompt that sits just above the bottom caption.
function KeyPrompt({ keyLabel, text }) {
  return (
    <div
      className="patch-anim"
      style={{
        position: "absolute",
        bottom: 124,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "7px 14px",
        borderRadius: 999,
        background: "rgba(255,253,247,0.94)",
        border: `1.5px solid ${ACCENT}`,
        boxShadow: "0 6px 18px rgba(58,42,32,0.22)",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 13,
        color: INK,
        animation: "patchPromptIn 0.32s ease both",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 22,
          height: 22,
          padding: "0 5px",
          borderRadius: 6,
          background: ACCENT,
          color: "#fff",
          fontWeight: 700,
          fontSize: 12,
          boxShadow: "0 2px 0 rgba(160,70,52,0.7)",
        }}
      >
        {keyLabel}
      </span>
      <span>{text}</span>
    </div>
  );
}

// Warm completion banner once the mended garment is washed and hung out to dry.
function DoneBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="patch-anim"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9800,
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(28px, 6vh, 72px) 20px",
        background:
          "radial-gradient(120% 90% at 50% 0%, rgba(255,253,247,0.94), rgba(245,233,214,0.92))",
        backdropFilter: "blur(14px) saturate(1.05)",
        WebkitBackdropFilter: "blur(14px) saturate(1.05)",
        animation: "patchScrimIn 0.7s ease both",
        fontFamily: "'IBM Plex Mono', monospace",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: ACCENT,
          marginBottom: 14,
        }}
      >
        🧺 Patchwork complete
      </div>
      <h1
        style={{
          fontFamily: "'Fraunces', serif",
          fontSize: "clamp(28px, 5vw, 48px)",
          lineHeight: 1.08,
          color: INK,
          margin: "0 0 22px",
          fontWeight: 600,
          maxWidth: 560,
        }}
      >
        Mended, washed, and hung out to dry.
      </h1>
      <p
        style={{
          fontSize: 14.5,
          lineHeight: 1.7,
          color: SUBINK,
          margin: "0 auto 26px",
          maxWidth: 480,
        }}
      >
        Every scattered patch found its way home. The garment is whole again —
        a little worn, a little wandered, and all the better for it.
      </p>
      <button
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
        }}
      >
        ← Back
      </button>
    </div>
  );
}
