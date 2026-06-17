// WashDay — WASH DAY mode in-world layer: a charming low-poly washing machine
// near the camp tent, and a muddy denim jacket you find → carry → wash → carry →
// hang on the empty 6th peg of the clothesline (which completes the line and
// unlocks About Me).
//
// Rendered inside the Canvas by GameLayer when gameMode === "wash". All proximity
// + timed-fill work runs in useFrame reading the live `avatarPos` (non-reactive)
// and the wash store; only discrete events (pickUpJacket / phase fills) touch the
// store. Scratch vectors are reused — no per-frame allocations.
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
// Drop spot for the dirty jacket: by the pond edge, away from washer + line.
const SEEK_XZ = (() => {
  // a point on the near-side rim of the pond, toward the open yard
  const x = POND_X + (POND_RADIUS + 3.0) * Math.cos(-0.5);
  const z = POND_Z + (POND_RADIUS + 3.0) * Math.sin(-0.5);
  return [x, z];
})();
const SEEK_POS = new THREE.Vector3(SEEK_XZ[0], terrainHeight(SEEK_XZ[0], SEEK_XZ[1]), SEEK_XZ[1]);

const PEG_POS = new THREE.Vector3(PEG_POINT[0], PEG_POINT[1], PEG_POINT[2]);

const PICKUP_RANGE = 1.4;
const NEAR_RANGE = 2.2;

// Denim palette across the three states.
const DENIM_DIRTY = new THREE.Color("#3E5A82"); // dimmer, dusty blue
const DENIM_WET = new THREE.Color("#27425F"); // dark saturated when soaked
const DENIM_CLEAN = new THREE.Color("#4E7FC4"); // bright fresh denim
const MUD = "#6B4A2B";

// ── Reusable scratch (no per-frame allocations) ────────────────────────────────
const _tmpColor = new THREE.Color();

// ─────────────────────────────────────────────────────────────────────────────
// The denim jacket. Drives its own look from `state` ("dirty"|"wet"|"clean") and
// a `dry` 0..1 (used to lerp wet→clean during drying, and to grow the billow).
// `hung` makes it hang+billow from the top; otherwise it sits upright (carried /
// on the ground).
// ─────────────────────────────────────────────────────────────────────────────
function DenimJacket({ state, dry = 0, hung = false }) {
  const body = useRef();
  const lSleeve = useRef();
  const rSleeve = useRef();
  const lDrip = useRef();
  const rDrip = useRef();
  const bodyMat = useRef();
  const sleeveMatL = useRef();
  const sleeveMatR = useRef();
  const collarMat = useRef();
  const mudGroup = useRef();

  useFrame((st) => {
    const t = st.clock.elapsedTime;

    // Resolve the denim color for this state (lerp wet→clean during drying).
    if (state === "clean") _tmpColor.copy(DENIM_CLEAN);
    else if (state === "wet") _tmpColor.copy(DENIM_WET).lerp(DENIM_CLEAN, dry);
    else _tmpColor.copy(DENIM_DIRTY);
    if (bodyMat.current) bodyMat.current.color.copy(_tmpColor);
    if (sleeveMatL.current) sleeveMatL.current.color.copy(_tmpColor);
    if (sleeveMatR.current) sleeveMatR.current.color.copy(_tmpColor);
    if (collarMat.current) collarMat.current.color.copy(_tmpColor).offsetHSL(0, 0, -0.06);

    // Mud fades as it gets clean (gone for wet/clean; full for dirty).
    if (mudGroup.current) {
      const show = state === "dirty";
      mudGroup.current.visible = show;
    }

    // Billow: clean/dry cloth waves gently; grows with `dry`. Wet barely moves.
    const billowAmt = state === "clean" ? 0.16 : state === "wet" ? 0.04 + dry * 0.12 : 0.05;
    if (hung) {
      const sway = Math.sin(t * 1.6) * billowAmt;
      const sway2 = Math.sin(t * 2.3 + 1.1) * billowAmt * 0.6;
      if (body.current) body.current.rotation.z = sway * 0.5;
      if (lSleeve.current) lSleeve.current.rotation.z = 0.5 + sway + sway2;
      if (rSleeve.current) rSleeve.current.rotation.z = -0.5 - sway + sway2;
    } else {
      // carried / on ground: a soft idle flutter
      const f = Math.sin(t * 2.4) * 0.05;
      if (lSleeve.current) lSleeve.current.rotation.z = 0.45 + f;
      if (rSleeve.current) rSleeve.current.rotation.z = -0.45 - f;
      if (body.current) body.current.rotation.z = 0;
    }

    // Drips: only while wet (and tapering off as it dries).
    const dripActive = state === "wet" && dry < 0.7;
    const dripY = (-((t * 0.9) % 1)) * 0.5; // 0 → -0.5 falling loop
    [lDrip, rDrip].forEach((d, idx) => {
      if (!d.current) return;
      d.current.visible = dripActive;
      if (dripActive) {
        d.current.position.y = -0.7 + dripY - idx * 0.18;
        const m = d.current.material;
        if (m) m.opacity = (1 - ((t * 0.9) % 1)) * 0.6;
      }
    });
  });

  return (
    <group>
      {/* torso / body of the jacket */}
      <mesh ref={body} castShadow position={[0, 0, 0]}>
        <boxGeometry args={[0.62, 0.7, 0.22]} />
        <meshStandardMaterial ref={bodyMat} roughness={0.92} metalness={0} />
      </mesh>
      {/* left sleeve (pivots from the shoulder) */}
      <group position={[-0.31, 0.28, 0]}>
        <mesh ref={lSleeve} castShadow position={[-0.16, -0.18, 0]} rotation={[0, 0, 0.45]}>
          <boxGeometry args={[0.18, 0.5, 0.18]} />
          <meshStandardMaterial ref={sleeveMatL} roughness={0.92} metalness={0} />
        </mesh>
      </group>
      {/* right sleeve */}
      <group position={[0.31, 0.28, 0]}>
        <mesh ref={rSleeve} castShadow position={[0.16, -0.18, 0]} rotation={[0, 0, -0.45]}>
          <boxGeometry args={[0.18, 0.5, 0.18]} />
          <meshStandardMaterial ref={sleeveMatR} roughness={0.92} metalness={0} />
        </mesh>
      </group>
      {/* collar */}
      <mesh position={[0, 0.4, 0.02]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.5, 0.14, 0.16]} />
        <meshStandardMaterial ref={collarMat} roughness={0.9} metalness={0} />
      </mesh>
      {/* button placket hint */}
      <mesh position={[0, -0.02, 0.12]}>
        <boxGeometry args={[0.05, 0.6, 0.03]} />
        <meshStandardMaterial color="#26405f" roughness={0.85} metalness={0.1} />
      </mesh>

      {/* mud splotches (only visible when dirty) */}
      <group ref={mudGroup}>
        <mesh position={[-0.14, -0.1, 0.115]}>
          <circleGeometry args={[0.13, 10]} />
          <meshStandardMaterial color={MUD} roughness={1} metalness={0} />
        </mesh>
        <mesh position={[0.16, 0.08, 0.115]}>
          <circleGeometry args={[0.09, 9]} />
          <meshStandardMaterial color={MUD} roughness={1} metalness={0} />
        </mesh>
        <mesh position={[0.05, -0.24, 0.115]}>
          <circleGeometry args={[0.07, 8]} />
          <meshStandardMaterial color="#5a3d22" roughness={1} metalness={0} />
        </mesh>
        <mesh position={[-0.42, 0.02, 0.05]}>
          <circleGeometry args={[0.06, 8]} />
          <meshStandardMaterial color={MUD} roughness={1} metalness={0} />
        </mesh>
      </group>

      {/* drip droplets (wet only) */}
      <mesh ref={lDrip} position={[-0.18, -0.7, 0.05]} visible={false}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#9fc4e8" transparent opacity={0.6} roughness={0.3} metalness={0} />
      </mesh>
      <mesh ref={rDrip} position={[0.2, -0.7, 0.05]} visible={false}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#9fc4e8" transparent opacity={0.6} roughness={0.3} metalness={0} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Washing machine: front-loader body, round dark porthole that spins (faster with
// washP), little feet, a knob. While washing it shakes and emits rising suds.
// ─────────────────────────────────────────────────────────────────────────────
const SUDS_COUNT = 10;
function WashingMachine({ washing, washP, jacketInDrum }) {
  const shell = useRef();
  const drum = useRef(); // the spinning inner ring + tumbling jacket
  const tumble = useRef();
  const suds = useRef();
  // per-suds bubble state (reused, never re-allocated)
  const sudsState = useMemo(
    () =>
      Array.from({ length: SUDS_COUNT }, (_, i) => ({
        t: Math.random(),
        x: (Math.random() - 0.5) * 0.5,
        z: 0.34 + Math.random() * 0.1,
        speed: 0.5 + Math.random() * 0.5,
        phase: i * 0.7,
      })),
    []
  );

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    const live = washing ? 0.25 + washP * 0.75 : 0; // liveliness scales with washP

    // drum spin — faster with washP
    if (drum.current) drum.current.rotation.z -= dt * (washing ? 3 + washP * 9 : 0);
    if (tumble.current) tumble.current.rotation.z += dt * (washing ? 4 + washP * 10 : 0);

    // gentle shake of the whole shell
    if (shell.current) {
      const s = live * 0.02;
      shell.current.position.x = Math.sin(t * 28) * s;
      shell.current.position.y = Math.abs(Math.sin(t * 22)) * s * 0.6;
      shell.current.rotation.z = Math.sin(t * 25 + 1) * s * 0.5;
    }

    // suds bubbles rise + pop
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
          const rise = b.t * 0.7;
          m.position.set(b.x, 0.18 + rise, b.z);
          // grow a touch then pop (fade) near the top
          const sc = (0.04 + b.t * 0.05) * (0.4 + live);
          m.scale.setScalar(sc);
          if (m.material) m.material.opacity = Math.min(1, (1 - b.t) * 1.4) * 0.85;
        }
      }
    }
  });

  return (
    <group position={[WASHER_POS.x, WASHER_POS.y, WASHER_POS.z]}>
      <group ref={shell}>
        {/* body */}
        <mesh castShadow position={[0, 0.62, 0]}>
          <boxGeometry args={[1.0, 1.05, 0.92]} />
          <meshStandardMaterial color="#EDEFF2" roughness={0.6} metalness={0} />
        </mesh>
        {/* top control panel strip */}
        <mesh position={[0, 1.06, 0.18]}>
          <boxGeometry args={[1.0, 0.22, 0.56]} />
          <meshStandardMaterial color="#D7DCE2" roughness={0.6} metalness={0} />
        </mesh>
        {/* knob */}
        <mesh position={[-0.32, 1.08, 0.47]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.05, 12]} />
          <meshStandardMaterial color="#4E7FC4" roughness={0.5} metalness={0} />
        </mesh>
        {/* little status light */}
        <mesh position={[0.28, 1.08, 0.47]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial
            color={washing ? "#6FE3A0" : "#9aa3ad"}
            emissive={washing ? "#3fcf86" : "#000000"}
            emissiveIntensity={washing ? 0.8 : 0}
            roughness={0.4}
          />
        </mesh>

        {/* porthole — recessed dark ring + glass + spinning drum */}
        <group position={[0, 0.6, 0.47]}>
          {/* outer ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.34, 0.34, 0.06, 24]} />
            <meshStandardMaterial color="#C2C8D0" roughness={0.5} metalness={0} />
          </mesh>
          {/* dark glass */}
          <mesh position={[0, 0, 0.02]}>
            <circleGeometry args={[0.27, 24]} />
            <meshStandardMaterial color="#1b2733" roughness={0.3} metalness={0} transparent opacity={0.92} />
          </mesh>
          {/* spinning drum ribs (read the motion through the glass) */}
          <group ref={drum} position={[0, 0, 0.005]}>
            {[0, 1, 2, 3].map((i) => (
              <mesh key={i} rotation={[0, 0, (i / 4) * Math.PI * 2]}>
                <boxGeometry args={[0.42, 0.018, 0.01]} />
                <meshStandardMaterial color="#3a4a5c" roughness={0.6} metalness={0} />
              </mesh>
            ))}
          </group>
          {/* tumbling jacket inside the drum (only during washing) */}
          {jacketInDrum && (
            <group ref={tumble} position={[0, 0, 0.04]} scale={0.32}>
              <DenimJacket state="dirty" dry={0} />
            </group>
          )}
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

      {/* suds particles (rise + pop) */}
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

// ── Floating guide arrow pointing at the current target ──────────────────────────
function GuideArrow({ targetRef }) {
  const ref = useRef();
  useFrame((st) => {
    const g = ref.current;
    const target = targetRef.current;
    if (!g || !target || !avatarActive) {
      if (g) g.visible = false;
      return;
    }
    g.visible = true;
    const t = st.clock.elapsedTime;
    g.position.set(avatarPos.x, avatarPos.y + 2.2 + Math.sin(t * 3) * 0.08, avatarPos.z);
    const dir = Math.atan2(target.x - avatarPos.x, target.z - avatarPos.z);
    g.rotation.set(Math.PI / 2, 0, 0);
    g.rotation.y = dir;
  });
  return (
    <mesh ref={ref} visible={false}>
      <coneGeometry args={[0.14, 0.4, 6]} />
      <meshBasicMaterial color="#6FA8E0" transparent opacity={0.85} depthWrite={false} />
    </mesh>
  );
}

// ── The dirty jacket sitting in the yard (seek phase): glow + bob cue ────────────
function SeekJacket({ visible }) {
  const g = useRef();
  useFrame((st) => {
    if (!g.current) return;
    g.current.visible = visible;
    if (!visible) return;
    const t = st.clock.elapsedTime;
    g.current.position.y = SEEK_POS.y + 0.95 + Math.sin(t * 2) * 0.12;
    g.current.rotation.y = t * 0.7;
  });
  return (
    <group ref={g} position={[SEEK_POS.x, SEEK_POS.y + 0.95, SEEK_POS.z]}>
      <DenimJacket state="dirty" dry={0} />
      {/* soft glow */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.7, 12, 12]} />
        <meshBasicMaterial color="#7FA8D8" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      <pointLight color="#8fb8e8" intensity={0.6} distance={3} position={[0, 0.2, 0]} />
    </group>
  );
}

// ── The carried jacket bobbing above the avatar (carryDirty / carryWet) ──────────
function CarriedJacket({ visible, state }) {
  const g = useRef();
  useFrame((st) => {
    if (!g.current) return;
    g.current.visible = visible;
    if (!visible) return;
    const t = st.clock.elapsedTime;
    g.current.position.set(
      avatarPos.x,
      avatarPos.y + 1.7 + Math.sin(t * 2.5) * 0.1,
      avatarPos.z
    );
    g.current.rotation.y = Math.sin(t * 0.6) * 0.2;
  });
  return (
    <group ref={g} visible={false}>
      <DenimJacket state={state} dry={0} />
    </group>
  );
}

// ── The jacket hanging on the empty 6th peg (drying / done) ──────────────────────
function HungJacket({ visible, dry, done }) {
  // Hung from the top: pin the collar at the rope point and let the body hang down.
  return (
    <group position={[PEG_POS.x, PEG_POS.y - 0.45, PEG_POS.z]} visible={visible}>
      {/* tiny clothespin at the top */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.08, 0.16, 0.08]} />
        <meshStandardMaterial color="#C99A5B" roughness={0.8} metalness={0} />
      </mesh>
      <DenimJacket state={done ? "clean" : "wet"} dry={done ? 1 : dry} hung />
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

  const guideTarget = useRef(null);
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
      guideTarget.current = SEEK_POS;
    } else if (ph === "carryDirty") {
      const d = Math.hypot(WASHER_POS.x - avatarPos.x, WASHER_POS.z - avatarPos.z);
      setNearWasher(d < NEAR_RANGE);
      guideTarget.current = WASHER_POS;
    } else if (ph === "carryWet") {
      const d = Math.hypot(PEG_POS.x - avatarPos.x, PEG_POS.z - avatarPos.z);
      setNearPeg(d < NEAR_RANGE);
      guideTarget.current = PEG_POS;
    } else {
      guideTarget.current = null;
    }
  });

  if (!playing) return null;

  const washing = phase === "washing";

  return (
    <group>
      <WashingMachine washing={washing} washP={washP} jacketInDrum={washing} />

      {/* dirty jacket waiting to be found */}
      <SeekJacket visible={phase === "seek"} />

      {/* carried states (hidden during washing — it's in the drum) */}
      <CarriedJacket visible={phase === "carryDirty"} state="dirty" />
      <CarriedJacket visible={phase === "carryWet"} state="wet" />

      {/* hanging on the peg while drying + once done */}
      <HungJacket
        visible={phase === "drying" || phase === "done"}
        dry={dryP}
        done={phase === "done"}
      />

      <GuideArrow targetRef={guideTarget} />
    </group>
  );
}
