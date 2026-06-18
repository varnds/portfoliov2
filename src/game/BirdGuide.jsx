// BirdGuide — the SAME deep-orange bird that flies around the world (OrangeBird),
// now acting as a COMPANION guide for Wash Day. It LEADS the way: it flies out
// ahead of the player toward the current objective, hovering a bit above head
// height (so it guides clearly without sitting in your face or on the ground).
// Once you arrive it hovers over the spot; on a new objective it reaches further
// ahead for a beat to show the direction.
//
// Targets per phase come from WashDay (targetRef, a live THREE.Vector3):
//   seek→ground denim, carryDirty→washing machine, washing→machine, carryWet→peg,
//   drying→peg, done→victory loop near the line.
//
// Props:
//   • phase      — current wash phase (drives the spoken beat + the point-dart).
//   • targetRef  — ref holding a THREE.Vector3 of the spot to point you toward.
//   • celebrate  — true during the ~2.5s line-complete beat (victory loop).
//
// Scratch vectors are reused; nothing is allocated per frame.
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { WASH_BEATS } from "./washStory";
import { avatarPos, avatarActive, useGame } from "./gameStore";
import { terrainHeight } from "../scene3d/coords";
import { OrangeBirdShape } from "../scene3d/birdShape";

const ACCENT = "#E2725B";
const INK = "#3A2A20";
const CREAM = "rgba(255,253,247,0.94)";

// The bird GUIDES from out in front: how far ahead of you it flies toward the
// current objective, and how high it hovers (a bit above head height so it leads
// clearly without sitting in your face).
const LEAD = 3.0; // world units ahead, toward the objective
const GUIDE_H = 2.7; // hover height above the ground at the lead spot

// On a new objective the bird reaches further ahead to show the way, then settles.
const POINT_REACH = 4.2; // world units toward the target during the point beat
const POINT_DUR = 1.3; // seconds of the point beat

// Reusable scratch (no per-frame allocations).
const _goal = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _park = new THREE.Vector3();

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
  const lastPhase = useRef(phase); // detect a new objective → point-dart + flourish
  const flourish = useRef(0); // seconds left of an excited spin+hop on a new leg
  const point = useRef(0); // seconds left of the "dart toward target then return"
  const wasActive = useRef(false); // detect the spawn (avatarActive rising edge)
  const greet = useRef(0); // seconds left of the "hello, right beside you" beat at spawn

  // Derived player heading (we don't get it from the store): a smoothed unit
  // vector of where the player is moving, held steady while they stand still.
  const headX = useRef(0); // default heading points +Z (cos=0, sin=1)
  const headZ = useRef(1);
  const lastAX = useRef(avatarPos.x);
  const lastAZ = useRef(avatarPos.z);

  const line = useMemo(() => WASH_BEATS[phase] || "", [phase]);
  // drei <Html> doesn't auto-hide when its 3D parent is invisible, so gate the
  // bubble's RENDER on `landed` — otherwise the bird's words show before you spawn.
  const { landed } = useGame();

  useFrame((st, dt) => {
    const g = root.current;
    if (!g) return;
    const t = st.clock.elapsedTime;
    const d = dt > 0 ? dt : 1 / 60; // guard against a zero/NaN dt

    const target = targetRef?.current;
    // Don't appear until the avatar has actually SPAWNED (landed). Otherwise the
    // bird is hovering in an empty scene over the welcome modal, before you exist.
    if (!target || !avatarActive) {
      g.visible = false;
      wasActive.current = false;
      return;
    }
    g.visible = true;

    // On spawn (avatarActive rising edge): the bird appears RIGHT BESIDE you for a
    // friendly hello, then eases out to lead the way.
    if (!wasActive.current) {
      wasActive.current = true;
      greet.current = 1.6;
      posRef.current = null; // re-place beside the player, don't fly in from afar
    }
    greet.current = Math.max(0, greet.current - d);
    const greeting = greet.current > 0 ? greet.current / 1.6 : 0; // 1→0

    const a = avatarPos; // live player position

    // ── Derive a smoothed player heading from movement (velocity) ───────────────
    // Only update when the player actually moved this frame; otherwise keep the
    // last heading so the bird parks behind a STILL player without spinning.
    const vx = a.x - lastAX.current;
    const vz = a.z - lastAZ.current;
    lastAX.current = a.x;
    lastAZ.current = a.z;
    const speed = Math.hypot(vx, vz);
    if (speed > 1e-4) {
      const nx = vx / speed;
      const nz = vz / speed;
      // Smooth toward the instantaneous heading; faster when moving briskly.
      const hk = Math.min(1, d * 6);
      headX.current += (nx - headX.current) * hk;
      headZ.current += (nz - headZ.current) * hk;
      const hl = Math.hypot(headX.current, headZ.current) || 1;
      headX.current /= hl; // renormalise so the heading stays a unit vector
      headZ.current /= hl;
    }
    const hX = headX.current;
    const hZ = headZ.current;

    // Direction from player toward the current objective (for the point-dart + facing).
    const tdx = target.x - a.x;
    const tdz = target.z - a.z;
    const tdist = Math.hypot(tdx, tdz) || 0.0001;
    const tux = tdx / tdist;
    const tuz = tdz / tdist;

    // ── On a NEW objective: dart toward the target to point the way, then return ─
    if (lastPhase.current !== phase) {
      lastPhase.current = phase;
      flourish.current = 1.2; // excited little spin + hop
      point.current = POINT_DUR; // dart toward the goal, then drift back behind you
    }
    flourish.current = Math.max(0, flourish.current - d);
    point.current = Math.max(0, point.current - d);
    const fl = flourish.current > 0 ? flourish.current / 1.2 : 0; // 1→0 over the flourish
    // Point amount eases 0→1→0 (out toward target and back) over POINT_DUR.
    const pt = point.current > 0 ? Math.sin((1 - point.current / POINT_DUR) * Math.PI) : 0;

    // ── The bird GUIDES: it flies out AHEAD of the player toward the current
    // objective, leading the way — capped so it never overshoots the target (once
    // you arrive it hovers over the spot). On a new objective it reaches a little
    // further ahead (the point beat) to clearly show the direction.
    let baseX, baseZ;
    if (celebrate) {
      baseX = target.x;
      baseZ = target.z;
    } else {
      const reach = Math.min(LEAD + (POINT_REACH - LEAD) * pt, tdist);
      const leadX = a.x + tux * reach;
      const leadZ = a.z + tuz * reach;
      if (greeting > 0) {
        // greet spot: right beside the player (a step to the side + slightly toward
        // the goal), then blend out to the lead spot as the hello fades.
        const helloX = a.x + tux * 0.5 - tuz * 1.1;
        const helloZ = a.z + tuz * 0.5 + tux * 1.1;
        baseX = leadX + (helloX - leadX) * greeting;
        baseZ = leadZ + (helloZ - leadZ) * greeting;
      } else {
        baseX = leadX;
        baseZ = leadZ;
      }
    }

    // Hover a fixed height above the GROUND at the lead spot (not the avatar's Y,
    // which is high mid sky-drop) — a bit ABOVE head height so it leads clearly
    // without sitting in your face, and never sinks into the terrain.
    const baseY = celebrate ? target.y : terrainHeight(baseX, baseZ);
    const hoverY = celebrate ? 2.6 : GUIDE_H;
    const circleR = celebrate ? 1.4 : 0.22; // tight bob while following; wide victory loop
    const circleSpd = celebrate ? 2.6 : 1.3;
    // Livelier bob (two frequencies) + a single up-hop during the flourish.
    const bob = Math.sin(t * 2.4) * 0.14 + Math.sin(t * 5.0) * 0.05;
    const hop = fl > 0 ? Math.sin((1 - fl) * Math.PI) * 0.45 : 0;
    _goal.set(
      baseX + Math.cos(t * circleSpd) * circleR,
      baseY + hoverY + bob + hop,
      baseZ + Math.sin(t * circleSpd) * circleR
    );

    if (!posRef.current) posRef.current = _goal.clone();
    const pos = posRef.current;
    _prev.copy(pos);
    // Ease toward the goal — smooth follow, a touch snappier during the point-dart.
    const k = Math.min(1, d * (celebrate ? 2.6 : pt > 0.05 ? 3.4 : 2.2));
    pos.lerp(_goal, k);
    g.position.copy(pos);

    // Face the way it's flying (local forward is +X → atan2(-dz, dx)). While pointing
    // it looks toward the target; otherwise it looks roughly the player's way.
    const mdx = pos.x - _prev.x;
    const mdz = pos.z - _prev.z;
    let faceYaw = g.rotation.y;
    if (pt > 0.1) {
      faceYaw = Math.atan2(-tuz, tux); // look at the objective while pointing
    } else if (mdx * mdx + mdz * mdz > 1e-6) {
      faceYaw = Math.atan2(-mdz, mdx);
    } else if (speed > 1e-4) {
      faceYaw = Math.atan2(-hZ, hX); // otherwise look where the player is heading
    }
    // A happy full twirl at the start of each leg (one spin over the flourish).
    g.rotation.y = faceYaw + (fl > 0 ? (1 - fl) * Math.PI * 2 : 0);
    // Lively banking roll, tipped harder during the flourish + celebration.
    g.rotation.z = Math.sin(t * 1.3) * 0.2 + fl * 0.5 + (celebrate ? 0.35 : 0);

    // wing flap — quick and eager; flutters even faster during the flourish/point.
    const flapSpd = celebrate ? 24 : fl > 0 || pt > 0.2 ? 28 : 15;
    const flap = Math.sin(t * flapSpd) * 0.8 + 0.25;
    if (wingL.current) wingL.current.rotation.z = flap;
    if (wingR.current) wingR.current.rotation.z = -flap;
  });

  return (
    <group ref={root}>
      <group scale={0.42}>
        <OrangeBirdShape wingL={wingL} wingR={wingR} />
      </group>
      {/* only once you've spawned, and not during the celebration loop (HUD banner takes over) */}
      {landed && !celebrate && <SpeechBubble text={line} />}
    </group>
  );
}
