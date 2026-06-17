// CameraHud — DOM overlay for CAMERA mode ("Develop the roll"). Owns:
//   • the soft VIEWFINDER vignette + corner frame + "frame it" prompt
//   • CAPTURE on the F key or a HUD shutter button (NOT Space — that's jump)
//   • the white shutter FLASH, then a Polaroid that ejects + DEVELOPS (blurred /
//     dark → sharp) and tucks into the album
//   • the film-roll counter (X / 6), a small stack of developed polaroids, and a
//     gentle "Roll complete" beat → endGame()
//
// Self-gates on gameMode==="camera" && playing. State lives in cameraStore; the
// world layer (CameraMode) feeds it the in-range subject + proximity.
import React, { useEffect, useRef, useState } from "react";
import { useGame, endGame } from "./gameStore";
import {
  useCamera,
  capture,
  resetRoll,
  subjectById,
  TOTAL_SUBJECTS,
} from "./cameraStore";

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const DISPLAY = "'Fraunces', serif";
const ACCENT = "#E2725B";
const CREAM = "#FFFDF7";
const DEVELOP_MS = 1500; // Polaroid blur→sharp duration
const FLASH_MS = 240; // white shutter flash duration
const TUCK_MS = 520; // slide-into-album after developing

export function CameraHud() {
  const { gameMode, playing } = useGame();
  const { captured, inRange, lastCapture } = useCamera();

  // ── (re)play reset: clear the roll whenever a fresh camera run begins ──────────
  const prevPlaying = useRef(false);
  useEffect(() => {
    if (playing && !prevPlaying.current && gameMode === "camera") {
      resetRoll();
    }
    prevPlaying.current = playing;
  }, [playing, gameMode]);

  // ── flash + developing Polaroid lifecycle (driven by lastCapture one-shots) ────
  const [flashKey, setFlashKey] = useState(0);
  const [devCard, setDevCard] = useState(null); // { caption, key, phase }
  const flashTimer = useRef(null);
  const devTimer = useRef(null);
  const tuckTimer = useRef(null);

  useEffect(() => {
    if (!lastCapture) return;
    // white flash
    setFlashKey(lastCapture.key);
    // developing card: ejects + sharpens, then tucks away
    setDevCard({ caption: lastCapture.caption, key: lastCapture.key, phase: "develop" });
    clearTimeout(devTimer.current);
    clearTimeout(tuckTimer.current);
    devTimer.current = setTimeout(() => {
      setDevCard((c) => (c && c.key === lastCapture.key ? { ...c, phase: "tuck" } : c));
      tuckTimer.current = setTimeout(() => {
        setDevCard((c) => (c && c.key === lastCapture.key ? null : c));
      }, TUCK_MS);
    }, DEVELOP_MS + 360);
    return () => {
      clearTimeout(devTimer.current);
      clearTimeout(tuckTimer.current);
    };
  }, [lastCapture]);

  // clear flash key after its animation so re-capture can retrigger
  useEffect(() => {
    if (!flashKey) return;
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashKey(0), FLASH_MS + 60);
    return () => clearTimeout(flashTimer.current);
  }, [flashKey]);

  // ── F-key capture (Space is reserved for jump — never bind it) ─────────────────
  const inRangeRef = useRef(inRange);
  inRangeRef.current = inRange;
  const activeRef = useRef(gameMode === "camera" && playing);
  activeRef.current = gameMode === "camera" && playing;
  useEffect(() => {
    const onKey = (e) => {
      if (!activeRef.current) return;
      if (e.key === "f" || e.key === "F") {
        if (inRangeRef.current) {
          e.preventDefault();
          capture(inRangeRef.current);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── reset transient HUD when leaving play ──────────────────────────────────────
  useEffect(() => {
    if (!playing) {
      clearTimeout(devTimer.current);
      clearTimeout(tuckTimer.current);
      clearTimeout(flashTimer.current);
      setDevCard(null);
      setFlashKey(0);
    }
  }, [playing]);

  // Self-gate: only render in camera mode while playing.
  if (gameMode !== "camera" || !playing) return null;

  const count = captured.size;
  const complete = count >= TOTAL_SUBJECTS;
  const framed = inRange ? subjectById(inRange) : null;

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
        @keyframes camFlash {
          0%   { opacity: 0; }
          12%  { opacity: 0.92; }
          100% { opacity: 0; }
        }
        @keyframes camEject {
          0%   { transform: translate(-50%, 120%) rotate(-2deg); opacity: 0; }
          55%  { transform: translate(-50%, -6%) rotate(1deg); opacity: 1; }
          100% { transform: translate(-50%, 0) rotate(0deg); opacity: 1; }
        }
        @keyframes camTuck {
          0%   { transform: translate(-50%, 0) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translate(-86%, 36vh) rotate(-8deg) scale(0.34); opacity: 0; }
        }
        @keyframes camDevelop {
          0%   { filter: blur(10px) brightness(0.35) saturate(0.4); }
          100% { filter: blur(0px) brightness(1) saturate(1); }
        }
        @keyframes camPromptIn {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes camFrameBreathe {
          0%, 100% { opacity: 0.85; }
          50%      { opacity: 1; }
        }
        @keyframes camCompleteIn {
          from { opacity: 0; transform: translate(-50%, 14px) scale(0.94); }
          to   { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
      `}</style>

      {/* ── VIEWFINDER vignette + corner frame (soft; only when framing) ───────── */}
      {framed && !complete && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            animation: "camFrameBreathe 2.4s ease-in-out infinite",
          }}
        >
          {/* subtle darken at edges */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              boxShadow: "inset 0 0 180px 60px rgba(20,12,8,0.34)",
            }}
          />
          {/* viewfinder corner brackets */}
          {[
            { top: "8%", left: "8%", brd: "border-top:2px solid;border-left:2px solid;" },
            { top: "8%", right: "8%", brd: "border-top:2px solid;border-right:2px solid;" },
            { bottom: "8%", left: "8%", brd: "border-bottom:2px solid;border-left:2px solid;" },
            { bottom: "8%", right: "8%", brd: "border-bottom:2px solid;border-right:2px solid;" },
          ].map((c, i) => (
            <span
              key={i}
              style={{
                position: "absolute",
                width: 38,
                height: 38,
                top: c.top,
                bottom: c.bottom,
                left: c.left,
                right: c.right,
                borderColor: "rgba(255,253,247,0.85)",
                borderTop: c.brd.includes("border-top") ? "2px solid rgba(255,253,247,0.85)" : "none",
                borderBottom: c.brd.includes("border-bottom") ? "2px solid rgba(255,253,247,0.85)" : "none",
                borderLeft: c.brd.includes("border-left") ? "2px solid rgba(255,253,247,0.85)" : "none",
                borderRight: c.brd.includes("border-right") ? "2px solid rgba(255,253,247,0.85)" : "none",
              }}
            />
          ))}
          {/* center focus reticle */}
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 54,
              height: 54,
              transform: "translate(-50%, -50%)",
              border: "1.5px solid rgba(255,253,247,0.55)",
              borderRadius: 6,
            }}
          />
        </div>
      )}

      {/* ── "frame it" prompt + shutter button ────────────────────────────────── */}
      {framed && !complete && (
        <div
          style={{
            position: "absolute",
            bottom: 88,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            pointerEvents: "auto",
            animation: "camPromptIn 0.28s ease both",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 999,
              background: "rgba(255,253,247,0.86)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              fontFamily: MONO,
            }}
          >
            <span style={{ fontSize: 14 }}>📷</span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: ACCENT }}>
              PRESS F
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#7A6657" }}>
              to capture · {framed.hint}
            </span>
          </div>
          <button
            onClick={() => inRange && capture(inRange)}
            aria-label="Capture photo"
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: `3px solid ${CREAM}`,
              background: ACCENT,
              boxShadow: "0 6px 18px rgba(0,0,0,0.24)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: `2px solid ${CREAM}`,
                background: "rgba(255,253,247,0.25)",
              }}
            />
          </button>
        </div>
      )}

      {/* ── film-roll counter + developed-photo stack (top-left) ──────────────── */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 13px",
            borderRadius: 999,
            background: "rgba(255,253,247,0.86)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.14)",
            fontFamily: MONO,
            width: "fit-content",
          }}
        >
          <span style={{ fontSize: 14 }}>🎞️</span>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: ACCENT }}>
            {count} / {TOTAL_SUBJECTS}
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "#9A8A7A" }}>
            ROLL
          </span>
        </div>
        {/* tiny stack of developed polaroids */}
        {count > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxWidth: 150 }}>
            {Array.from(captured).map((id, i) => (
              <div
                key={id}
                title={subjectById(id)?.caption || ""}
                style={{
                  width: 30,
                  height: 36,
                  background: CREAM,
                  padding: 3,
                  borderRadius: 2,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                  transform: `rotate(${(i % 2 ? 1 : -1) * (2 + (i % 3))}deg)`,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: 22,
                    borderRadius: 1,
                    background: "linear-gradient(135deg, #E8C9A8, #C98E63)",
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── white shutter flash ───────────────────────────────────────────────── */}
      {flashKey > 0 && (
        <div
          key={flashKey}
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "#fff",
            animation: `camFlash ${FLASH_MS}ms ease-out forwards`,
          }}
        />
      )}

      {/* ── developing Polaroid (ejects from bottom, sharpens, tucks to album) ─── */}
      {devCard && (
        <div
          key={`dev-${devCard.key}`}
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            width: 220,
            transform: "translate(-50%, 0)",
            animation:
              devCard.phase === "tuck"
                ? `camTuck ${TUCK_MS}ms cubic-bezier(0.6,0,0.8,0.4) forwards`
                : "camEject 0.62s cubic-bezier(0.34,1.4,0.6,1) both",
          }}
        >
          <div
            style={{
              background: CREAM,
              padding: "12px 12px 34px",
              borderRadius: 4,
              boxShadow: "0 18px 44px rgba(0,0,0,0.32)",
            }}
          >
            <div
              style={{
                width: "100%",
                height: 150,
                borderRadius: 2,
                background:
                  "linear-gradient(135deg, #F2C879 0%, #E2725B 45%, #8C5A6B 100%)",
                animation:
                  devCard.phase === "develop"
                    ? `camDevelop ${DEVELOP_MS}ms ease-out forwards`
                    : "none",
              }}
            />
            <div
              style={{
                marginTop: 10,
                fontFamily: DISPLAY,
                fontSize: 14,
                fontStyle: "italic",
                color: "#3A2A20",
                textAlign: "center",
                lineHeight: 1.3,
              }}
            >
              {devCard.caption}
            </div>
          </div>
        </div>
      )}

      {/* ── "Roll complete" beat → endGame() ──────────────────────────────────── */}
      {complete && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "auto",
            textAlign: "center",
            padding: "26px 30px",
            borderRadius: 16,
            background: "rgba(255,253,247,0.94)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
            animation: "camCompleteIn 0.5s cubic-bezier(0.34,1.4,0.6,1) both",
            maxWidth: "86vw",
          }}
        >
          <div style={{ fontSize: 30, marginBottom: 6 }}>🎞️</div>
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: 26,
              fontWeight: 600,
              color: "#2E2018",
              marginBottom: 6,
            }}
          >
            Roll complete
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 12,
              color: "#7A6657",
              marginBottom: 18,
              letterSpacing: 0.5,
            }}
          >
            All {TOTAL_SUBJECTS} moments developed.
          </div>
          <button
            onClick={() => endGame()}
            style={{
              fontFamily: MONO,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.5,
              color: CREAM,
              background: ACCENT,
              border: "none",
              padding: "11px 22px",
              borderRadius: 999,
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(226,114,91,0.4)",
            }}
          >
            CLOSE THE ALBUM
          </button>
        </div>
      )}
    </div>
  );
}
