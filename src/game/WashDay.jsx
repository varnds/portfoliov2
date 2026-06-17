// WashDay — WASH DAY mode in-world layer: a charming low-poly washing machine
// near the camp tent, and a muddy DENIM PANEL you find on the ground → carry →
// wash → carry → hang on the empty 6th peg of the clothesline (which completes
// the line and unlocks About Me).
//
// The dirty garment is a flat draping CLOTH PANEL in the exact same visual
// language as the clothesline pieces (buildFlatPanel + a canvas art texture that
// ripples per-vertex, pinned at the top), NOT a boxy 3D jacket. A denim-blue art
// texture (seams + topstitch + rivets) is drawn locally so it reads as "a garment
// that belongs on the line." States:
//   • SEEK  — lying flat/crumpled on the ground, mud-stained, with a soft glow.
//   • CARRY — bobbing above the avatar.
//   • HUNG  — drapes from the 6th peg exactly like the other line garments.
// A mud overlay panel rides on top only while dirty.
//
// Rendered inside the Canvas by GameLayer when gameMode === "wash". All proximity
// + timed-fill work runs in useFrame reading the live `avatarPos` (non-reactive)
// and the wash store; only discrete events (pickUpJacket / phase fills) touch the
// store. Scratch vectors/colors are reused — no per-frame allocations.
//
// Responsibility split (see washStore.js): WashHud owns the F-key/buttons that
// call startWashing/startDrying and toggle `holding`. WashDay only READS `holding`
// and drives addWash/addDry, plus sets nearWasher/nearPeg and calls pickUpJacket.
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { avatarPos, avatarActive, useGame } from "./gameStore";
import {
  terrainHeight,
  postLayout,
  clotheslineEnds,
  clotheslinePoint,
  POND_X,
  POND_Z,
  POND_RADIUS,
} from "../scene3d/coords";
import { buildFlatPanel } from "../scene3d/clothGarment";
import {
  useWash,
  resetWash,
  pickUpJacket,
  setNearWasher,
  setNearPeg,
  addWash,
  addDry,
  WASH_TIME,
  DRY_TIME,
} from "./washStore";
import { BirdGuide } from "./BirdGuide";

// ── World anchors ─────────────────────────────────────────────────────────────
const LEFT_POST = postLayout(70, 470, 130, 0);
const RIGHT_POST = postLayout(970, 470, 130, 0);
const LINE = clotheslineEnds(LEFT_POST, RIGHT_POST);
// Empty 6th peg near the right end. Existing garments span t≈0.15–0.74, so 0.9 is
// well clear of them.
const PEG_T = 0.9;
const PEG_POINT = clotheslinePoint(PEG_T, LINE.L, LINE.R); // [x, y, z] at the rope

// Washing machine near the camp tent (~[14,0,10]); grounded on the terrain.
const WASHER_XZ = [10, 13];
const WASHER_POS = new THREE.Vector3(
  WASHER_XZ[0],
  terrainHeight(WASHER_XZ[0], WASHER_XZ[1]),
  WASHER_XZ[1]
);
// Drop spot for the dirty denim: by the pond edge, away from washer + line.
const SEEK_XZ = (() => {
  const x = POND_X + (POND_RADIUS + 3.0) * Math.cos(-0.5);
  const z = POND_Z + (POND_RADIUS + 3.0) * Math.sin(-0.5);
  return [x, z];
})();
const SEEK_POS = new THREE.Vector3(SEEK_XZ[0], terrainHeight(SEEK_XZ[0], SEEK_XZ[1]), SEEK_XZ[1]);

const PEG_POS = new THREE.Vector3(PEG_POINT[0], PEG_POINT[1], PEG_POINT[2]);

const PICKUP_RANGE = 1.4;
const NEAR_RANGE = 2.2;

// Denim palette across the three states (the canvas art is tinted by lerping the
// material color; the texture itself carries the seam/stitch detail in greys so
// the tint reads cleanly across dirty→wet→clean).
// Washed/faded denim — light + soft so it sits with the cream clothesline palette
// instead of clashing as a dark navy.
const DENIM_DIRTY = new THREE.Color("#8A98A8"); // muted dusty (mud sits on top)
const DENIM_WET = new THREE.Color("#6E8AA6"); // darker when soaked
const DENIM_CLEAN = new THREE.Color("#AFC6DD"); // pale washed denim, fresh + light

// ── Reusable scratch (no per-frame allocations) ────────────────────────────────
const _tmpColor = new THREE.Color();

// ─────────────────────────────────────────────────────────────────────────────
// Denim art texture — drawn once on a transparent canvas, same approach as
// garmentArt.js. A roughly garment-shaped panel (waistband + body) in light grey
// so the material `color` tint controls the denim hue; topstitch in warm thread,
// vertical seams, a couple of rivets and a pocket. Everything outside the shape
// stays transparent so the panel shows only the garment silhouette.
// ─────────────────────────────────────────────────────────────────────────────
function buildDenimTexture() {
  const cw = 360;
  const ch = 460;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, cw, ch);

  // Garment silhouette: a panel with a waistband top, gently flaring body, soft
  // rounded hem — reads as a folded pair of denims / a denim throw.
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(54, 30);
    ctx.lineTo(306, 30);
    ctx.lineTo(318, 120); // shoulder out
    ctx.quadraticCurveTo(330, 300, 300, 430); // right body
    ctx.quadraticCurveTo(180, 458, 60, 430); // hem
    ctx.quadraticCurveTo(30, 300, 42, 120); // left body
    ctx.closePath();
  };

  ctx.save();
  shape();
  ctx.clip();

  // Base fill: light neutral grey so the material tint sets the denim color.
  ctx.fillStyle = "#cfd2d6";
  ctx.fillRect(0, 0, cw, ch);

  // Faint vertical drape shading so flat cloth isn't dead-flat.
  const g = ctx.createLinearGradient(0, 0, cw, 0);
  g.addColorStop(0, "rgba(0,0,0,0.10)");
  g.addColorStop(0.5, "rgba(255,255,255,0.06)");
  g.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ch);

  // Denim woven texture — fine diagonal twill hatch.
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 2;
  for (let k = -ch; k < cw; k += 7) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k + ch, ch);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.05)";
  for (let k = -ch; k < cw; k += 9) {
    ctx.beginPath();
    ctx.moveTo(k + 4, 0);
    ctx.lineTo(k + 4 + ch, ch);
    ctx.stroke();
  }

  // Waistband band across the top.
  ctx.fillStyle = "rgba(0,0,0,0.10)";
  ctx.fillRect(0, 30, cw, 40);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, 30, cw, 6);

  // Warm topstitch thread.
  const stitch = (drawPath, dash = [9, 6]) => {
    ctx.save();
    ctx.setLineDash(dash);
    ctx.lineCap = "round";
    ctx.strokeStyle = "#E7B36A"; // mustard topstitch
    ctx.lineWidth = 3;
    drawPath();
    ctx.stroke();
    ctx.restore();
  };
  // waistband double-stitch
  stitch(() => {
    ctx.beginPath();
    ctx.moveTo(40, 44);
    ctx.lineTo(320, 44);
  });
  stitch(() => {
    ctx.beginPath();
    ctx.moveTo(40, 64);
    ctx.lineTo(320, 64);
  });
  // central front seam
  stitch(() => {
    ctx.beginPath();
    ctx.moveTo(180, 70);
    ctx.lineTo(180, 440);
  });
  // side seams
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 2;
  [80, 280].forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, 72);
    ctx.lineTo(x, 432);
    ctx.stroke();
  });

  // A back pocket with stitched arc.
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.beginPath();
  ctx.moveTo(96, 150);
  ctx.lineTo(156, 150);
  ctx.lineTo(150, 210);
  ctx.lineTo(126, 226);
  ctx.lineTo(102, 210);
  ctx.closePath();
  ctx.fill();
  stitch(() => {
    ctx.beginPath();
    ctx.moveTo(96, 150);
    ctx.lineTo(156, 150);
    ctx.lineTo(150, 210);
    ctx.lineTo(126, 226);
    ctx.lineTo(102, 210);
    ctx.closePath();
  }, [7, 5]);

  ctx.restore(); // end clip

  // Rivets + button (drawn after clip so they sit crisp on the band).
  ctx.fillStyle = "#C9A24B";
  [[60, 78], [300, 78], [126, 150]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  // waistband button
  ctx.fillStyle = "#B8902F";
  ctx.beginPath();
  ctx.arc(180, 50, 8, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  // World height tuned to read like a clothesline piece (line garments ≈ 2.0).
  const hWorld = 1.7;
  return { texture, w: hWorld * (cw / ch), h: hWorld };
}

// Mud overlay texture — irregular brown splotches on a transparent canvas, mapped
// to the SAME panel so it drapes/ripples with the cloth. Shown only while dirty.
function buildMudTexture() {
  const cw = 360;
  const ch = 460;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, cw, ch);
  const blob = (x, y, r, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 7) {
      const rr = r * (0.7 + Math.random() * 0.5);
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr * 0.85;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  };
  blob(140, 300, 60, "rgba(95,64,38,0.92)");
  blob(170, 320, 34, "rgba(72,48,28,0.95)");
  blob(250, 210, 40, "rgba(107,74,43,0.9)");
  blob(110, 150, 26, "rgba(90,61,35,0.88)");
  blob(220, 380, 30, "rgba(80,54,32,0.9)");
  // a few flecks
  ctx.fillStyle = "rgba(70,46,26,0.85)";
  for (let i = 0; i < 18; i += 1) {
    ctx.beginPath();
    ctx.arc(60 + Math.random() * 240, 90 + Math.random() * 340, 3 + Math.random() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// ─────────────────────────────────────────────────────────────────────────────
// DenimPanel — a flat draping cloth panel that ripples per-vertex exactly like
// the clothesline garments. Drives its own look from `state`("dirty"|"wet"|"clean")
// and a `p` 0..1 (washP while washing-bound, dryP while drying) plus `holding` so
// the wash/dry interactions read LIVE off progress.
//   • dirty → dusty tint, mud overlay visible, limp.
//   • wet   → dark saturated, mud gone, sags heavy; as `p`(dryP) rises it lightens
//             toward clean and BILLOWS MORE in the breeze (breezy flap).
//   • clean → bright fresh denim, gentle billow.
// `hung` pins the top at the rope and lets the body hang/billow; otherwise the
// whole panel is positioned by the parent (ground / carried).
// ─────────────────────────────────────────────────────────────────────────────
function DenimPanel({ state, p = 0, holding = false, hung = false, windBoost = 0 }) {
  const meshRef = useRef();
  const mudRef = useRef();
  const denimMat = useRef();
  const mudMat = useRef();

  const art = useMemo(() => buildDenimTexture(), []);
  const mudTex = useMemo(() => buildMudTexture(), []);
  const { geometry, base, vWeight } = useMemo(
    () => buildFlatPanel(art.w, art.h),
    [art.w, art.h]
  );
  // Separate buffer for the mud overlay so both ripple independently but matched.
  const mud = useMemo(() => buildFlatPanel(art.w, art.h), [art.w, art.h]);

  // dispose generated GPU resources on unmount
  useEffect(
    () => () => {
      geometry.dispose();
      mud.geometry.dispose();
      art.texture.dispose();
      mudTex.dispose();
    },
    [geometry, mud.geometry, art.texture, mudTex]
  );

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.getElapsedTime();

    // ── tint by state (lerp wet→clean by p while drying) ──
    if (state === "clean") _tmpColor.copy(DENIM_CLEAN);
    else if (state === "wet") _tmpColor.copy(DENIM_WET).lerp(DENIM_CLEAN, p);
    else _tmpColor.copy(DENIM_DIRTY);
    if (denimMat.current) denimMat.current.color.copy(_tmpColor);

    // mud only while dirty
    if (mudRef.current) mudRef.current.visible = state === "dirty";

    // ── billow amplitude per state (distinct wash vs dry feel) ──
    // dry: as dryP rises the cloth flaps MORE in the breeze (breezy flap).
    // wet (p=0): heavy, barely moves. clean: gentle steady billow.
    let billow;
    if (state === "clean") billow = 0.85;
    else if (state === "wet") billow = 0.18 + p * 1.15; // soaked→dry breezy flap
    else billow = 0.28; // dirty: limp-ish
    // a held-fan boost makes the live drying interaction feel responsive
    billow += windBoost;

    const spd = 1.0;
    const ph = hung ? 2.3 : 0.6;
    const gust = 0.7 + 0.5 * Math.sin(t * 0.6 + ph);
    const arr = mesh.geometry.attributes.position.array;
    const marr = mud.geometry.attributes.position.array;
    const useMud = state === "dirty";

    for (let k = 0; k < vWeight.length; k += 1) {
      const o = k * 3;
      const bx = base[o];
      const by = base[o + 1];
      const w = vWeight[k];
      const amp = w * w; // anchored at top, free at hem
      const flutter =
        Math.sin(bx * 15 + by * 6 + t * 2.4 * spd + ph) * 0.04 +
        Math.sin(by * 11 - t * 1.7 * spd + ph * 1.3) * 0.06 +
        Math.sin(bx * 30 + t * 3.2 * spd + ph) * 0.018;
      const sway = Math.sin(by * 6 + t * 1.2 * spd + ph) * 0.02 * amp;
      const z = flutter * amp * gust * billow;
      arr[o] = bx + sway;
      arr[o + 1] = by;
      arr[o + 2] = z;
      if (useMud) {
        // mud rides just in front of the cloth (tiny offset to avoid z-fight)
        marr[o] = bx + sway;
        marr[o + 1] = by;
        marr[o + 2] = z + 0.004;
      }
    }
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    if (useMud) {
      mud.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          ref={denimMat}
          map={art.texture}
          transparent
          alphaTest={0.5}
          roughness={0.95}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={mudRef} geometry={mud.geometry}>
        <meshStandardMaterial
          ref={mudMat}
          map={mudTex}
          transparent
          alphaTest={0.05}
          roughness={1}
          metalness={0}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Washing machine: front-loader body, round dark porthole that spins (faster with
// washP), little feet, a knob. While washing it shakes and emits rising suds.
// LIVE: drum spins faster + suds build the higher washP, and faster while holding.
// An approach-glow lights up when the carrier nears it.
// ─────────────────────────────────────────────────────────────────────────────
const SUDS_COUNT = 12;
function WashingMachine({ washing, washP, holding, glow, jacketInDrum }) {
  const shell = useRef();
  const drum = useRef();
  const suds = useRef();
  const glowMesh = useRef();
  const glowRef = useRef(0);
  const sudsState = useMemo(
    () =>
      Array.from({ length: SUDS_COUNT }, (_, i) => ({
        t: Math.random(),
        x: (Math.random() - 0.5) * 0.5,
        z: 0.34 + Math.random() * 0.12,
        speed: 0.5 + Math.random() * 0.5,
        phase: i * 0.7,
      })),
    []
  );

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    // liveliness scales with washP and surges while the player holds F
    const hold = holding ? 1 : 0.45;
    const live = washing ? (0.25 + washP * 0.75) * hold : 0;

    if (drum.current)
      drum.current.rotation.z -= dt * (washing ? (3 + washP * 9) * (0.6 + hold * 0.8) : 0);

    if (shell.current) {
      const s = live * 0.025;
      shell.current.position.x = Math.sin(t * 28) * s;
      shell.current.position.y = Math.abs(Math.sin(t * 22)) * s * 0.6;
      shell.current.rotation.z = Math.sin(t * 25 + 1) * s * 0.5;
    }

    if (suds.current) {
      suds.current.visible = washing;
      if (washing) {
        const kids = suds.current.children;
        for (let i = 0; i < kids.length; i++) {
          const b = sudsState[i];
          b.t += dt * b.speed * (0.4 + live);
          if (b.t > 1) {
            b.t = 0;
            b.x = (Math.random() - 0.5) * 0.5;
          }
          const m = kids[i];
          const rise = b.t * (0.7 + washP * 0.5);
          m.position.set(b.x, 0.18 + rise, b.z);
          // suds count/size grow with washP → "suds build the higher washP"
          const present = b.t < 0.2 + washP * 0.8 ? 1 : 0;
          const sc = (0.04 + b.t * 0.06) * (0.4 + live) * present;
          m.scale.setScalar(sc);
          if (m.material) m.material.opacity = Math.min(1, (1 - b.t) * 1.4) * 0.85 * present;
        }
      }
    }

    // approach glow ease
    if (glowMesh.current) {
      const target = glow ? 1 : 0;
      glowRef.current += (target - glowRef.current) * Math.min(1, dt * 6);
      const g = glowRef.current;
      glowMesh.current.visible = g > 0.01;
      const pulse = 0.16 + 0.05 * Math.sin(t * 3);
      glowMesh.current.material.opacity = g * pulse;
      const sc = 1 + 0.04 * Math.sin(t * 3);
      glowMesh.current.scale.setScalar(sc);
    }
  });

  return (
    <group position={[WASHER_POS.x, WASHER_POS.y, WASHER_POS.z]}>
      {/* approach glow halo */}
      <mesh ref={glowMesh} position={[0, 0.6, 0]} visible={false}>
        <sphereGeometry args={[1.3, 16, 16]} />
        <meshBasicMaterial color="#FFD9A6" transparent opacity={0} depthWrite={false} />
      </mesh>

      <group ref={shell}>
        {/* body */}
        <mesh castShadow position={[0, 0.62, 0]}>
          <boxGeometry args={[1.0, 1.05, 0.92]} />
          <meshStandardMaterial color="#EDEFF2" roughness={0.6} metalness={0} />
        </mesh>
        {/* control panel strip */}
        <mesh position={[0, 1.06, 0.18]}>
          <boxGeometry args={[1.0, 0.22, 0.56]} />
          <meshStandardMaterial color="#D7DCE2" roughness={0.6} metalness={0} />
        </mesh>
        {/* knob */}
        <mesh position={[-0.32, 1.08, 0.47]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.05, 12]} />
          <meshStandardMaterial color="#4E7FC4" roughness={0.5} metalness={0} />
        </mesh>
        {/* status light */}
        <mesh position={[0.28, 1.08, 0.47]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial
            color={washing ? "#6FE3A0" : "#9aa3ad"}
            emissive={washing ? "#3fcf86" : "#000000"}
            emissiveIntensity={washing ? 0.8 : 0}
            roughness={0.4}
          />
        </mesh>

        {/* porthole */}
        <group position={[0, 0.6, 0.47]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.34, 0.34, 0.06, 24]} />
            <meshStandardMaterial color="#C2C8D0" roughness={0.5} metalness={0} />
          </mesh>
          <mesh position={[0, 0, 0.02]}>
            <circleGeometry args={[0.27, 24]} />
            <meshStandardMaterial color="#1b2733" roughness={0.3} metalness={0} transparent opacity={0.92} />
          </mesh>
          <group ref={drum} position={[0, 0, 0.005]}>
            {[0, 1, 2, 3].map((i) => (
              <mesh key={i} rotation={[0, 0, (i / 4) * Math.PI * 2]}>
                <boxGeometry args={[0.42, 0.018, 0.01]} />
                <meshStandardMaterial color="#3a4a5c" roughness={0.6} metalness={0} />
              </mesh>
            ))}
            {/* a denim hint tumbling behind the glass while washing */}
            {jacketInDrum && (
              <mesh position={[0, 0, 0.006]}>
                <circleGeometry args={[0.16, 16]} />
                <meshStandardMaterial color="#2f4d72" roughness={0.9} metalness={0} />
              </mesh>
            )}
          </group>
        </group>

        {/* feet */}
        {[
          [-0.42, -0.42],
          [0.42, -0.42],
          [-0.42, 0.4],
          [0.42, 0.4],
        ].map(([fx, fz], i) => (
          <mesh key={i} position={[fx, 0.06, fz]}>
            <cylinderGeometry args={[0.07, 0.08, 0.12, 8]} />
            <meshStandardMaterial color="#2f3540" roughness={0.8} metalness={0} />
          </mesh>
        ))}
      </group>

      {/* suds particles */}
      <group ref={suds} visible={false}>
        {Array.from({ length: SUDS_COUNT }).map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[1, 6, 6]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.8} roughness={0.4} metalness={0} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ── The dirty denim lying FLAT on the ground (seek phase). It rests ON the
// terrain — no float, no spin, no glow. The orange bird is the cue, not a halo. ──
function SeekPanel({ visible }) {
  const g = useRef();
  useFrame(() => {
    if (g.current) g.current.visible = visible;
  });
  return (
    // sit flush on the terrain (tiny lift to avoid z-fighting with the ground)
    <group ref={g} position={[SEEK_POS.x, SEEK_POS.y + 0.02, SEEK_POS.z]} rotation={[0, 0.7, 0]}>
      {/* laid flat on the ground: rotate the hanging panel down so it lies on the
          surface; centre it over the spot so it reads as a dropped, crumpled garment */}
      <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.85]}>
        <DenimPanel state="dirty" hung={false} />
      </group>
    </group>
  );
}

// ── The carried denim bobbing above the avatar (carryDirty / carryWet) ───────────
function CarriedPanel({ visible, state }) {
  const g = useRef();
  useFrame((st) => {
    if (!g.current) return;
    g.current.visible = visible;
    if (!visible) return;
    const t = st.clock.elapsedTime;
    g.current.position.set(
      avatarPos.x,
      avatarPos.y + 2.4 + Math.sin(t * 2.5) * 0.1,
      avatarPos.z
    );
    g.current.rotation.y = Math.sin(t * 0.6) * 0.25;
  });
  return (
    <group ref={g} visible={false}>
      {/* hang it from a carried point so it drapes downward while bobbing */}
      <DenimPanel state={state} hung />
    </group>
  );
}

// ── The denim hanging on the empty 6th peg (drying / done) ───────────────────────
function HungPanel({ visible, dry, done, holding, celebrate }) {
  return (
    <group position={[PEG_POS.x, PEG_POS.y, PEG_POS.z]} visible={visible}>
      {/* tiny clothespin at the rope */}
      <mesh position={[0, 0.04, 0.05]}>
        <boxGeometry args={[0.08, 0.16, 0.08]} />
        <meshStandardMaterial color="#C99A5B" roughness={0.8} metalness={0} />
      </mesh>
      <DenimPanel
        state={done ? "clean" : "wet"}
        p={done ? 1 : dry}
        holding={holding}
        hung
        // celebration: an extra breeze flourish when the line first completes;
        // a live fan-boost while the player holds to dry.
        windBoost={celebrate ? 0.7 : holding ? 0.35 : 0}
      />
    </group>
  );
}

export function WashDay() {
  const { playing } = useGame();
  const wash = useWash();
  const { phase, washP, dryP, holding } = wash;

  // Live mirrors for the per-frame loop (avoid stale closures).
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const holdingRef = useRef(holding);
  holdingRef.current = holding;

  // Reset positions/phase when a fresh wash run begins (playing flips true).
  useEffect(() => {
    if (playing) resetWash();
  }, [playing]);

  // Brief "line complete" celebration window before the About reveal (P1 #6).
  const [celebrate, setCelebrate] = React.useState(false);
  useEffect(() => {
    if (phase === "done") {
      setCelebrate(true);
      const id = setTimeout(() => setCelebrate(false), 2500);
      return () => clearTimeout(id);
    }
    setCelebrate(false);
    return undefined;
  }, [phase]);

  // Current target spot the bird flies to, by phase.
  const targetRef = useRef(SEEK_POS);
  const acc = useRef(0);

  useFrame((st, dt) => {
    if (!avatarActive) return;
    const ph = phaseRef.current;

    // Timed fills run every frame for smoothness (cheap, store-guarded).
    if (ph === "washing" && holdingRef.current) addWash(dt / WASH_TIME);
    if (ph === "drying" && holdingRef.current) addDry(dt / DRY_TIME);

    // Proximity work — throttle a touch.
    acc.current += dt;
    if (acc.current < 0.06) return;
    acc.current = 0;

    if (ph === "seek") {
      const d = Math.hypot(SEEK_POS.x - avatarPos.x, SEEK_POS.z - avatarPos.z);
      if (d <= PICKUP_RANGE) pickUpJacket();
      targetRef.current = SEEK_POS;
    } else if (ph === "carryDirty") {
      const d = Math.hypot(WASHER_POS.x - avatarPos.x, WASHER_POS.z - avatarPos.z);
      setNearWasher(d < NEAR_RANGE);
      targetRef.current = WASHER_POS;
    } else if (ph === "washing") {
      targetRef.current = WASHER_POS;
    } else if (ph === "carryWet") {
      const d = Math.hypot(PEG_POS.x - avatarPos.x, PEG_POS.z - avatarPos.z);
      setNearPeg(d < NEAR_RANGE);
      targetRef.current = PEG_POS;
    } else {
      // drying / done — hover near the peg / line
      targetRef.current = PEG_POS;
    }
  });

  if (!playing) return null;

  const washing = phase === "washing";
  const nearWasherGlow = phase === "carryDirty" || washing;

  return (
    <group>
      <WashingMachine
        washing={washing}
        washP={washP}
        holding={holding}
        glow={nearWasherGlow}
        jacketInDrum={washing}
      />

      {/* dirty denim lying in the yard */}
      <SeekPanel visible={phase === "seek"} />

      {/* carried states (hidden during washing — it's in the drum) */}
      <CarriedPanel visible={phase === "carryDirty"} state="dirty" />
      <CarriedPanel visible={phase === "carryWet"} state="wet" />

      {/* hanging on the peg while drying + once done */}
      <HungPanel
        visible={phase === "drying" || phase === "done"}
        dry={dryP}
        done={phase === "done"}
        holding={holding}
        celebrate={celebrate}
      />

      {/* the orange bird guide + its in-world speech bubble */}
      <BirdGuide phase={phase} targetRef={targetRef} celebrate={celebrate} />
    </group>
  );
}
