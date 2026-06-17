// BirdGuide — the SAME deep-orange bird that flies around the world (OrangeBird),
// now acting as a COMPANION guide for Wash Day. Instead of hovering at the
// destination, it appears beside you at the start of each leg and then leads
// AHEAD of you toward the current target ("follow me"), so you always know which
// way to walk and the bird stays in front of you, on-screen.
//
// Targets per phase come from WashDay (targetRef, a live THREE.Vector3):
//   seek→ground denim, carryDirty→washtub, washing→washtub, carryWet→peg,
//   drying→peg, done→victory loop near the line.
//
// Props:
//   • phase      — current wash phase (drives the spoken beat + when it re-greets).
//   • targetRef  — ref holding a THREE.Vector3 of the spot to lead you to.
//   • celebrate  — true during the ~2.5s line-complete beat (victory loop).
//
// Scratch vectors are reused; nothing is allocated per frame.
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { WASH_BEATS } from "./washStory";
import { avatarPos } from "./gameStore";
import { terrainHeight } from "../scene3d/coords";
import { OrangeBirdShape } from "../scene3d/birdShape";

const ACCENT = "#E2725B";
const INK = "#3A2A20";
const CREAM = "rgba(255,253,247,0.94)";

// How far ahead of the player the bird hovers while leading (world units).
const LEAD_AHEAD = 3.2;

// Reusable scratch (no per-frame allocations).
const _goal = new THREE.Vector3();
const _prev = new THREE.Vector3();

// ── The speech bubble attached to the bird (drei Html, billboarded) ─────────────
function SpeechBubble({ text }) {
  if (!text) return null;
  return (
    <Html
      position={[0, 1.15, 0]}
      center
      distanceFactor={6}
      occlude={false}
      zIndexRange={[100, 0]}
      style={{ pointerEvents: "none", userSelect: "none" }}
      wrapperClass="bird-bubble-wrapper"
    >
      <div
        key={text}
        style={{
          position: "relative",
          width: 210,
          whiteSpace: "normal",
          wordBreak: "normal",
          overflowWrap: "break-word",
          boxSizing: "border-box",
          background: CREAM,
          border: `1.5px solid ${ACCENT}`,
          borderRadius: 14,
          padding: "10px 14px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 13,
          lineHeight: 1.45,
          color: INK,
          textAlign: "center",
          boxShadow: "0 8px 22px rgba(58,42,32,0.28)",
          animation: "birdBubbleIn 0.36s cubic-bezier(0.2,0.7,0.3,1) both",
        }}
      >
        <Beat text={text} />
        <span
          style={{
            position: "absolute",
            left: "50%",
            bottom: -9,
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "9px solid transparent",
            borderRight: "9px solid transparent",
            borderTop: `10px solid ${ACCENT}`,
          }}
        />
        <span
          style={{
            position: "absolute",
            left: "50%",
            bottom: -6,
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "7px solid transparent",
            borderRight: "7px solid transparent",
            borderTop: "8px solid rgba(255,253,247,0.94)",
          }}
        />
        <style>{`
          @keyframes birdBubbleIn {
            from { opacity: 0; transform: translateY(6px) scale(0.94); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    </Html>
  );
}

// Renders the narration text with *emphasis* spans (terracotta accent).
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

export function BirdGuide({ phase, targetRef, celebrate = false }) {
  const root = useRef();
  const wingL = useRef();
  const wingR = useRef();
  const posRef = useRef(null); // current flown position (smoothed)
  const lastPhase = useRef(phase); // re-greet (start beside player) on phase change

  const line = useMemo(() => WASH_BEATS[phase] || "", [phase]);

  useFrame((st, dt) => {
    const g = root.current;
    if (!g) return;
    const t = st.clock.elapsedTime;

    const target = targetRef?.current;
    if (!target) {
      g.visible = false;
      return;
    }
    g.visible = true;

    const a = avatarPos; // live player position
    const dx = target.x - a.x;
    const dz = target.z - a.z;
    const dist = Math.hypot(dx, dz) || 0.0001;

    // On a NEW leg, snap the bird beside the player so it visibly comes to you and
    // then pulls ahead — "follow me".
    if (lastPhase.current !== phase) {
      lastPhase.current = phase;
      if (posRef.current) posRef.current.set(a.x, a.y + 1.7, a.z);
    }

    // Hover point: lead the player by LEAD_AHEAD toward the target, but never past
    // it — once you arrive, the bird settles right over the spot to mark it.
    const lead = celebrate ? 0 : Math.min(LEAD_AHEAD, dist);
    const baseX = dist > 0.4 ? a.x + (dx / dist) * lead : target.x;
    const baseZ = dist > 0.4 ? a.z + (dz / dist) * lead : target.z;
    const hoverY = celebrate ? 2.4 : 1.7;
    const circleR = celebrate ? 1.4 : 0.32; // tight bob while leading; wide victory loop
    const circleSpd = celebrate ? 2.6 : 1.3;
    // Hover a fixed height above the GROUND at its location (not the avatar's Y —
    // which is high mid sky-drop and would fling the bird into the sky).
    const baseY = celebrate ? target.y : terrainHeight(baseX, baseZ);
    _goal.set(
      baseX + Math.cos(t * circleSpd) * circleR,
      baseY + hoverY + Math.sin(t * 1.6) * 0.16,
      baseZ + Math.sin(t * circleSpd) * circleR
    );

    if (!posRef.current) posRef.current = _goal.clone();
    const pos = posRef.current;
    _prev.copy(pos);
    // Ease toward the goal quickly enough to keep pace ahead of a walking player,
    // but still smooth.
    const k = Math.min(1, dt * (celebrate ? 2.6 : 2.4));
    pos.lerp(_goal, k);
    g.position.copy(pos);

    // Face the way it's flying (local forward is +X → atan2(-dz, dx)); when nearly
    // still, look toward the target so it points the way.
    const mdx = pos.x - _prev.x;
    const mdz = pos.z - _prev.z;
    if (mdx * mdx + mdz * mdz > 1e-6) {
      g.rotation.y = Math.atan2(-mdz, mdx);
    } else if (dist > 0.4) {
      g.rotation.y = Math.atan2(-dz, dx);
    }
    g.rotation.z = Math.sin(t * 0.7) * 0.12 + (celebrate ? 0.35 : 0);

    // wing flap
    const flap = Math.sin(t * (celebrate ? 22 : 12)) * 0.7 + 0.2;
    if (wingL.current) wingL.current.rotation.z = flap;
    if (wingR.current) wingR.current.rotation.z = -flap;
  });

  return (
    <group ref={root}>
      <group scale={0.8}>
        <OrangeBirdShape wingL={wingL} wingR={wingR} />
      </group>
      {/* hide the bubble during the celebration loop (HUD banner takes over) */}
      {!celebrate && <SpeechBubble text={line} />}
    </group>
  );
}
