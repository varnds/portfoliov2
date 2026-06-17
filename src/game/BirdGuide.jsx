// BirdGuide — a small ORANGE BIRD that flies to the current Wash Day target and
// speaks the bird's line, replacing the old HUD corner bubble + the floating
// guide arrow. It is the diegetic guide + narrator: it eases toward the target
// for the active phase, bobs/circles over it so the player's eye follows, and
// carries a billboarded SPEECH BUBBLE (drei <Html>) showing WASH_BEATS[phase].
//
// Targets by phase are resolved by WashDay (passed in as `targetRef`, a live
// THREE.Vector3 it updates each frame): seek→ground denim, carryDirty→washer,
// washing→washer, carryWet→peg, drying→peg, done→a victory loop near the line.
//
// Props:
//   • phase      — current wash phase (drives the spoken beat + flight feel).
//   • targetRef  — ref holding a THREE.Vector3 of the spot to fly to.
//   • celebrate  — true during the ~2.5s line-complete beat (victory loop).
//
// Scratch vectors are reused; nothing is allocated per frame.
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { WASH_BEATS } from "./washStory";

const ACCENT = "#E2725B";
const INK = "#3A2A20";
const CREAM = "rgba(255,253,247,0.94)";

// Reusable scratch (no per-frame allocations).
const _goal = new THREE.Vector3();
const _prev = new THREE.Vector3();

// ── The little orange bird body (low-poly, matte) ──────────────────────────────
function BirdBody({ flapRef, wingLRef, wingRRef }) {
  return (
    <group ref={flapRef}>
      {/* body */}
      <mesh castShadow rotation={[0.2, 0, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial color="#F08A3C" roughness={0.85} metalness={0} />
      </mesh>
      {/* belly lighter */}
      <mesh position={[0, -0.04, 0.08]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color="#FBC58A" roughness={0.9} metalness={0} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.12, 0.12]}>
        <sphereGeometry args={[0.11, 12, 12]} />
        <meshStandardMaterial color="#F2933F" roughness={0.85} metalness={0} />
      </mesh>
      {/* beak */}
      <mesh position={[0, 0.11, 0.23]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.04, 0.1, 8]} />
        <meshStandardMaterial color="#E8B23C" roughness={0.7} metalness={0} />
      </mesh>
      {/* eyes */}
      {[-0.05, 0.05].map((x, i) => (
        <mesh key={i} position={[x, 0.15, 0.2]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial color="#241712" roughness={0.5} metalness={0} />
        </mesh>
      ))}
      {/* tail */}
      <mesh position={[0, -0.02, -0.16]} rotation={[0.5, 0, 0]}>
        <coneGeometry args={[0.07, 0.18, 6]} />
        <meshStandardMaterial color="#D9722B" roughness={0.85} metalness={0} />
      </mesh>
      {/* wings (flap) */}
      <group ref={wingLRef} position={[-0.13, 0.02, 0]}>
        <mesh position={[-0.1, 0, 0]} rotation={[0, 0, 0.3]}>
          <boxGeometry args={[0.22, 0.03, 0.13]} />
          <meshStandardMaterial color="#E07A2E" roughness={0.85} metalness={0} />
        </mesh>
      </group>
      <group ref={wingRRef} position={[0.13, 0.02, 0]}>
        <mesh position={[0.1, 0, 0]} rotation={[0, 0, -0.3]}>
          <boxGeometry args={[0.22, 0.03, 0.13]} />
          <meshStandardMaterial color="#E07A2E" roughness={0.85} metalness={0} />
        </mesh>
      </group>
    </group>
  );
}

// ── The speech bubble attached to the bird (drei Html, billboarded) ─────────────
function SpeechBubble({ text }) {
  if (!text) return null;
  return (
    <Html
      position={[0, 0.5, 0]}
      center
      distanceFactor={9}
      occlude={false}
      zIndexRange={[100, 0]}
      style={{ pointerEvents: "none", userSelect: "none" }}
      wrapperClass="bird-bubble-wrapper"
    >
      <div
        // keyed on text so it re-pops on each new beat
        key={text}
        style={{
          position: "relative",
          maxWidth: 230,
          background: CREAM,
          border: `1.5px solid ${ACCENT}`,
          borderRadius: 14,
          padding: "10px 13px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 13,
          lineHeight: 1.4,
          color: INK,
          textAlign: "center",
          boxShadow: "0 8px 22px rgba(58,42,32,0.28)",
          animation: "birdBubbleIn 0.36s cubic-bezier(0.2,0.7,0.3,1) both",
        }}
      >
        <Beat text={text} />
        {/* little tail pointing down to the bird */}
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
  const flap = useRef();
  const wingL = useRef();
  const wingR = useRef();
  // current flown position (smoothed toward the goal); lazily initialized.
  const posRef = useRef(null);

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

    // Hover offset above the target so the bird circles ABOVE it (eye-catching).
    // While celebrating, fly a wider victory loop near the line.
    const circleR = celebrate ? 1.4 : 0.7;
    const circleSpd = celebrate ? 2.6 : 1.1;
    const hoverY = celebrate ? 2.4 : 1.9;
    _goal.set(
      target.x + Math.cos(t * circleSpd) * circleR,
      target.y + hoverY + Math.sin(t * 1.6) * 0.18,
      target.z + Math.sin(t * circleSpd) * circleR
    );

    if (!posRef.current) {
      posRef.current = _goal.clone();
    }
    const pos = posRef.current;
    _prev.copy(pos);
    // smooth re-route: ease toward the goal (snappier while celebrating)
    const k = Math.min(1, dt * (celebrate ? 4.5 : 2.6));
    pos.lerp(_goal, k);
    g.position.copy(pos);

    // face direction of travel
    const dx = pos.x - _prev.x;
    const dz = pos.z - _prev.z;
    if (dx * dx + dz * dz > 1e-6) {
      g.rotation.y = Math.atan2(dx, dz);
    }

    // wing flap + body bob
    const flapAmt = Math.sin(t * (celebrate ? 22 : 14)) * 0.7;
    if (wingL.current) wingL.current.rotation.z = 0.3 + flapAmt;
    if (wingR.current) wingR.current.rotation.z = -0.3 - flapAmt;
    if (flap.current) flap.current.position.y = Math.sin(t * 6) * 0.03;
  });

  return (
    <group ref={root}>
      <BirdBody flapRef={flap} wingLRef={wingL} wingRRef={wingR} />
      {/* hide the bubble during the celebration loop (HUD banner takes over) */}
      {!celebrate && <SpeechBubble text={line} />}
    </group>
  );
}
