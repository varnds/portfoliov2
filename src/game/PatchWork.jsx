// PatchWork — PATCHWORK mode in-world layer. A garment was torn into PATCH_TOTAL
// patches and scattered, HIDDEN, across the world. The player explores and stumbles
// on each patch (no waypoints, no glowing beacons) tucked beside a small concealing
// prop (a low rock or a grass tuft), resting on the terrain. Walking close enough
// "discovers" it: the scrap lifts and zips onto the incomplete garment the player
// carries, stitching itself into a tidy grid. When all are found the garment is
// whole → wash it at the machine → hang it on the empty peg to finish.
//
// Reuses WashDay's <WashingMachine> + <KeyPrompt> and the wash anchors (WASHER_POS,
// PEG_POS, NEAR_RANGE, …). The store (patchStore) is the single source of truth;
// PatchHud (DOM) owns the keys (load / spin / hang / fan) and toggles `holding`.
// PatchWork only READS the store, drives proximity (setNearWasher/setNearPeg), the
// timed fills (addWash/addDry while holding), and the patch discovery (collectPatch).
//
// All per-frame work reads the live, non-reactive `avatarPos` and reuses scratch
// objects — no per-frame allocations. Refs are guarded defensively throughout.
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  usePatch,
  collectPatch,
  setNearWasher,
  setNearPeg,
  addWash,
  addDry,
  resetPatch,
  PATCH_TOTAL,
  WASH_TIME,
  DRY_TIME,
} from "./patchStore";
import {
  WashingMachine,
  KeyPrompt,
  WASHER_POS,
  PEG_POS,
  PEG_PROMPT_Y,
  NEAR_RANGE,
} from "./WashDay";
import { avatarPos, registerObstacle, unregisterObstacle } from "./gameStore";
import { terrainHeight } from "../scene3d/coords";
import { buildFlatPanel } from "../scene3d/clothGarment";
import { sfx } from "./audio";
import { WanderBird } from "./WanderBird";

// ── Tuning ──────────────────────────────────────────────────────────────────────
const DISCOVER_RANGE = 2.8; // horizontal distance at which a patch is discovered
const PATCH_W = 0.7; // scrap world size — big enough to spot when you're in the area
const PATCH_LIFT = 0.07; // small lift so it rests cleanly above grass tufts
const FLY_TIME = 0.85; // seconds for the found-patch zip-to-garment animation

// 6 hidden patch spots, each nestled by a concealing prop, kept off the pond water
// and away from the flat clothesline yard near origin. Each gets its own warm
// garment colour and a concealing prop kind ("rock" | "bush").
const PATCH_DEFS = [
  { id: 0, xz: [-12, 4], color: "#E2725B", prop: "rock" }, // west, toward the pond shore
  { id: 1, xz: [-3, -12], color: "#E0A458", prop: "bush" }, // back-hill rise
  { id: 2, xz: [12, 10], color: "#6FA8A0", prop: "rock" }, // beside the tent/camp
  { id: 3, xz: [-8, -4], color: "#8C7BD9", prop: "bush" }, // behind the left line post
  { id: 4, xz: [15, -3], color: "#D96BA0", prop: "rock" }, // east outcrop
  { id: 5, xz: [5, 6], color: "#C9A24B", prop: "bush" }, // near the yard's right side
];

// Garment-assembly grid: 2 columns × 3 rows = 6 squares. Patch i fills cell i so
// the carried garment fills in patch-by-patch as they're discovered, each square
// taking that patch's colour.
const GRID_COLS = 2;
const GRID_ROWS = 3;

// ── Reusable scratch (no per-frame allocations) ─────────────────────────────────
const _tmpColor = new THREE.Color();
const _tmpColor2 = new THREE.Color();
const _carryPos = new THREE.Vector3();
const _ghostColor = new THREE.Color("#D9C7A6"); // raw muslin/canvas — the cloth body
const _wholeColor = new THREE.Color("#FBF3E2"); // whole/washed garment body tint
const _white = new THREE.Color("#ffffff");
const _slotColor = new THREE.Color("#B0966F"); // an empty, un-filled patch slot (a hole)
const _frameColor = new THREE.Color("#7A5E3C"); // the garment's stitched binding/edge

// Precompute each patch's resting world position once.
const PATCHES = PATCH_DEFS.map((d) => {
  const [x, z] = d.xz;
  const y = terrainHeight(x, z) + PATCH_LIFT;
  return { ...d, pos: new THREE.Vector3(x, y, z) };
});

// ─────────────────────────────────────────────────────────────────────────────
// A concealing prop — a low rock or a little grass tuft — that the patch nestles
// against, so the scrap reads as a found object you stumble on, not a pickup.
// ─────────────────────────────────────────────────────────────────────────────
function ConcealProp({ kind, color }) {
  if (kind === "rock") {
    // a chunky little boulder cluster — a clear landmark to explore toward, with
    // the patch snagged against it.
    return (
      <group>
        <mesh castShadow receiveShadow position={[0.3, 0.26, -0.05]} rotation={[0.3, 0.6, 0.15]}>
          <dodecahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial color="#8C8579" roughness={1} metalness={0} flatShading />
        </mesh>
        <mesh castShadow receiveShadow position={[0.0, 0.15, 0.28]} rotation={[0.5, 1.2, 0]}>
          <dodecahedronGeometry args={[0.3, 0]} />
          <meshStandardMaterial color="#9C958A" roughness={1} metalness={0} flatShading />
        </mesh>
        <mesh castShadow position={[-0.3, 0.1, -0.02]} rotation={[0.2, 2.1, 0.4]}>
          <dodecahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial color="#7E776B" roughness={1} metalness={0} flatShading />
        </mesh>
      </group>
    );
  }
  // a fuller shrub — a few leafy blades the scrap drapes over.
  return (
    <group>
      {[
        [0.3, 0, 0.0, 0.0, 0.6],
        [0.4, 0.3, 0.15, 0.4, 0.52],
        [0.18, -0.4, 0.3, -0.25, 0.46],
        [0.46, 0.9, -0.12, 0.18, 0.5],
        [0.1, 1.6, -0.18, -0.1, 0.42],
      ].map(([x, ry, z, tilt, h], i) => (
        <mesh key={i} castShadow position={[x, h * 0.5, z]} rotation={[tilt, ry, tilt * 0.5]}>
          <coneGeometry args={[0.18, h, 5]} />
          <meshStandardMaterial color={i % 2 ? "#6E8F4E" : "#7CA05A"} roughness={1} metalness={0} flatShading />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HiddenPatch — a small fabric scrap resting on the terrain, nestled by its prop.
// ONLY a very gentle breeze flutter (no spin, no float-bob beacon, no glow aura).
// When discovered it plays a brief FLY animation: it lifts and zips toward the
// carried garment (target read live from avatarPos), with a tiny sparkle, then
// hides. The parent flips `found` true on discovery; this component owns the
// little fly-out tween via a local progress ref.
// ─────────────────────────────────────────────────────────────────────────────
function HiddenPatch({ def, found }) {
  const group = useRef();
  const clothRef = useRef();
  const sparkleRef = useRef();
  const flyRef = useRef(0); // 0 → 1 over FLY_TIME once found
  const restRef = useRef(new THREE.Vector3().copy(def.pos));

  const panel = useMemo(() => buildFlatPanel(PATCH_W, PATCH_W, 6, 6), []);
  useEffect(() => () => panel.geometry.dispose(), [panel.geometry]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;

    if (found) {
      // brief zip-to-garment animation, then stay hidden.
      if (flyRef.current < 1) {
        flyRef.current = Math.min(1, flyRef.current + dt / FLY_TIME);
        const p = flyRef.current;
        const ease = p * p * (3 - 2 * p); // smoothstep
        // target: just above + slightly in front of the avatar (the carried garment)
        _carryPos.set(avatarPos.x, avatarPos.y + 1.7, avatarPos.z);
        g.position.lerpVectors(restRef.current, _carryPos, ease);
        // a little arc lift on the way
        g.position.y += Math.sin(p * Math.PI) * 0.8;
        const s = 1 - ease * 0.7; // shrink as it stitches in
        g.scale.setScalar(s);
        g.rotation.y = t * 6; // a quick celebratory twirl only while flying
        if (sparkleRef.current) {
          sparkleRef.current.visible = true;
          const sp = Math.sin(p * Math.PI);
          sparkleRef.current.scale.setScalar(0.2 + sp * 0.9);
          if (sparkleRef.current.material) sparkleRef.current.material.opacity = sp * 0.9;
        }
        g.visible = p < 0.999;
      } else {
        g.visible = false;
      }
      return;
    }

    // Not found: rest on the terrain, lying flat, with ONLY a gentle breeze flutter.
    g.visible = true;
    g.position.copy(restRef.current);
    g.scale.setScalar(1);
    if (sparkleRef.current) sparkleRef.current.visible = false;

    const cloth = clothRef.current;
    if (cloth && cloth.geometry) {
      const arr = cloth.geometry.attributes.position.array;
      const { base, vWeight } = panel;
      const gust = 0.6 + 0.4 * Math.sin(t * 0.7 + def.id);
      for (let k = 0; k < vWeight.length; k += 1) {
        const o = k * 3;
        const bx = base[o];
        const by = base[o + 1];
        const w = vWeight[k];
        // draped upright now → it ripples toward/away (z) + sways a touch, more at
        // the free hem (w→1), so it reads as a little rag flapping in the breeze.
        const flutter =
          Math.sin(bx * 12 + t * 2.2 + def.id) * 0.03 +
          Math.sin(by * 9 - t * 1.7 + def.id * 1.3) * 0.04;
        arr[o] = bx + Math.sin(by * 7 + t * 1.5 + def.id) * 0.02 * w;
        arr[o + 1] = by;
        arr[o + 2] = flutter * (0.5 + w) * gust;
      }
      cloth.geometry.attributes.position.needsUpdate = true;
      cloth.geometry.computeVertexNormals();
    }
  });

  return (
    <group ref={group} position={[def.pos.x, def.pos.y, def.pos.z]}>
      <ConcealProp kind={def.prop} color={def.color} />
      {/* the scrap, snagged on the prop + fluttering — draped UPRIGHT so you can
          spot it from a distance (not flat on the sand). A pale raw-fabric backing
          gives it a soft light edge that pops a touch from the terrain — it's
          cloth caught on a rock, not a glowing marker. */}
      <group position={[0.15, 0.78, 0.1]} rotation={[0.22, 0.55, 0.12]}>
        <mesh position={[0, -PATCH_W * 0.5, -0.015]}>
          <planeGeometry args={[PATCH_W * 1.12, PATCH_W * 1.08]} />
          <meshStandardMaterial color="#F3E8CF" roughness={1} metalness={0} side={THREE.DoubleSide} flatShading />
        </mesh>
        <mesh ref={clothRef} geometry={panel.geometry} castShadow receiveShadow>
          <meshStandardMaterial
            color={def.color}
            roughness={0.92}
            metalness={0}
            side={THREE.DoubleSide}
            flatShading
          />
        </mesh>
      </group>
      {/* tiny brief sparkle that flashes only during the fly-to-garment moment */}
      <mesh ref={sparkleRef} visible={false} position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.34, 10, 10]} />
        <meshBasicMaterial color="#FFF3D6" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CarriedGarment — the heart. A garment-shaped cloth that bobs just above + behind
// the avatar and faces roughly the camera. It starts as a faint ghostly OUTLINE and
// fills PATCH BY PATCH: a tidy 2×3 grid of squares, each appearing (pop-in) as its
// patch is collected, taking that patch's colour. When found===total the garment is
// whole + vivid; after washing it tints cleaner/brighter. Hidden once it's hung.
// ─────────────────────────────────────────────────────────────────────────────
function CarriedGarment({ found, total, phase, washP }) {
  const group = useRef();
  const bodyMat = useRef();
  // one ref + a pop-in progress per grid cell
  const cellRefs = useRef([]);
  const cellPop = useRef(PATCH_DEFS.map(() => 0));

  const panel = useMemo(() => buildFlatPanel(1.0, 1.3, 18, 14), []);
  useEffect(() => () => panel.geometry.dispose(), [panel.geometry]);

  // grid cell layout in the garment's local space (panel spans x∈[-0.5,0.5], y∈[-1.3,0])
  const cells = useMemo(() => {
    const out = [];
    const padX = 0.12;
    const padY = 0.16;
    const cw = (1.0 - padX * 2) / GRID_COLS;
    const ch = (1.3 - padY * 2) / GRID_ROWS;
    for (let i = 0; i < PATCH_DEFS.length; i += 1) {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const x = -0.5 + padX + cw * (col + 0.5);
      const y = -padY - ch * (row + 0.5);
      out.push({ x, y, w: cw * 0.86, h: ch * 0.86, color: PATCH_DEFS[i].color, c3: new THREE.Color(PATCH_DEFS[i].color) });
    }
    return out;
  }, []);

  // Only carry the 3D garment once it's WHOLE — to the washer + through washing.
  // During gather the assembly lives in the corner HUD panel; while drying/done it
  // hangs on the line (HungGarment). So the avatar only physically carries the
  // finished garment to the laundry.
  const visible = phase === "toWasher" || phase === "washing" || phase === "toPeg";
  const cleaned = phase === "washing" || phase === "toPeg" || phase === "drying" || phase === "done";

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    g.visible = visible;
    if (!visible) return;
    const t = state.clock.elapsedTime;

    // bob just above + behind the avatar, facing roughly toward the camera (which
    // sits behind/above the avatar in this world) — we face -Z relative to avatar.
    _carryPos.set(avatarPos.x - 0.05, avatarPos.y + 2.5 + Math.sin(t * 2.2) * 0.06, avatarPos.z + 0.5);
    g.position.copy(_carryPos);
    g.rotation.y = Math.PI + Math.sin(t * 0.5) * 0.12;
    g.rotation.z = Math.sin(t * 0.8) * 0.05;

    // body outline: faint ghost until complete, then vivid; cleaner after washing.
    const whole = found >= total;
    if (bodyMat.current) {
      if (!whole) {
        _tmpColor.copy(_ghostColor);
        bodyMat.current.opacity = 0.62;
      } else {
        _tmpColor.copy(_ghostColor).lerp(_wholeColor, cleaned ? 1 : 0.5);
        bodyMat.current.opacity = cleaned ? 0.92 : 0.82;
      }
      bodyMat.current.color.copy(_tmpColor);
    }

    // per-cell pop-in: cell i is present once found > i.
    for (let i = 0; i < cells.length; i += 1) {
      const target = found > i ? 1 : 0;
      const cur = cellPop.current[i];
      const next = cur + (target - cur) * Math.min(1, dt * 7);
      cellPop.current[i] = next;
      const m = cellRefs.current[i];
      if (!m) continue;
      m.visible = next > 0.01;
      // overshoot pop on appear
      const s = next < 0.999 ? next * (1.12 - 0.12 * next) : 1;
      m.scale.set(s, s, 1);
      if (m.material) {
        // brighten cells a touch once washed
        if (cleaned) _tmpColor2.copy(cells[i].c3).lerp(_white, 0.22);
        else _tmpColor2.copy(cells[i].c3);
        m.material.color.copy(_tmpColor2);
      }
    }
  });

  return (
    <group ref={group} visible={false}>
      {/* stitched binding / frame behind the cloth — reads as a deliberate
          patchwork panel (a garment-in-progress), not a stray rectangle */}
      <mesh position={[0, -0.65, -0.02]}>
        <planeGeometry args={[1.16, 1.46]} />
        <meshStandardMaterial color={_frameColor} roughness={1} metalness={0} side={THREE.DoubleSide} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      {/* the cloth body (raw muslin) the patches stitch into */}
      <mesh geometry={panel.geometry}>
        <meshStandardMaterial
          ref={bodyMat}
          color={_ghostColor}
          transparent
          opacity={0.6}
          roughness={1}
          metalness={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* the 6 patch SLOTS — always shown as empty recesses so you can see there
          are pieces to find; each is covered by its colour once that patch is found */}
      {cells.map((c, i) => (
        <mesh key={`slot${i}`} position={[c.x, c.y, 0.008]}>
          <planeGeometry args={[c.w, c.h]} />
          <meshStandardMaterial color={_slotColor} roughness={1} metalness={0} side={THREE.DoubleSide} transparent opacity={0.7} depthWrite={false} />
        </mesh>
      ))}
      {/* the assembling patches — pop in over their slot as they're collected */}
      {cells.map((c, i) => (
        <mesh
          key={i}
          ref={(el) => (cellRefs.current[i] = el)}
          position={[c.x, c.y, 0.016]}
          visible={false}
        >
          <planeGeometry args={[c.w, c.h]} />
          <meshStandardMaterial color={c.color} roughness={0.9} metalness={0} side={THREE.DoubleSide} flatShading />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HungGarment — the completed patchwork garment hanging from the empty peg while
// drying + once done. Billows while drying, settles when done. A simple flat panel
// with the 2×3 colour grid drawn on as small squares so it still reads as the same
// patchwork garment now on the line.
// ─────────────────────────────────────────────────────────────────────────────
function HungGarment({ visible, drying, dryP }) {
  const meshRef = useRef();
  const panel = useMemo(() => buildFlatPanel(1.0, 1.3, 20, 14), []);
  useEffect(() => () => panel.geometry.dispose(), [panel.geometry]);

  const cells = useMemo(() => {
    const out = [];
    const padX = 0.12;
    const padY = 0.16;
    const cw = (1.0 - padX * 2) / GRID_COLS;
    const ch = (1.3 - padY * 2) / GRID_ROWS;
    for (let i = 0; i < PATCH_DEFS.length; i += 1) {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const x = -0.5 + padX + cw * (col + 0.5);
      const y = -padY - ch * (row + 0.5);
      out.push({ x, y, w: cw * 0.86, h: ch * 0.86, color: PATCH_DEFS[i].color });
    }
    return out;
  }, []);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || !mesh.geometry || !visible) return;
    const t = state.clock.elapsedTime;
    const { base, vWeight } = panel;
    // billow strongly while drying (and as dryP rises it flaps a touch more), settle
    // to a gentle sway once done.
    const billow = drying ? 0.55 + dryP * 0.5 : 0.35;
    const gust = 0.7 + 0.5 * Math.sin(t * 0.6 + 1.4);
    const arr = mesh.geometry.attributes.position.array;
    for (let k = 0; k < vWeight.length; k += 1) {
      const o = k * 3;
      const bx = base[o];
      const by = base[o + 1];
      const w = vWeight[k];
      const amp = w * w; // pinned at the top peg, free at the hem
      const flutter =
        Math.sin(bx * 13 + by * 6 + t * 2.2 + 1.4) * 0.04 +
        Math.sin(by * 10 - t * 1.6 + 0.9) * 0.05;
      const sway = Math.sin(by * 6 + t * 1.1) * 0.02 * amp;
      arr[o] = bx + sway;
      arr[o + 1] = by;
      arr[o + 2] = flutter * amp * gust * billow;
    }
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  });

  return (
    <group position={[PEG_POS.x, PEG_POS.y, PEG_POS.z]} visible={visible}>
      {/* clothespin at the rope */}
      <mesh position={[0, 0.04, 0.05]}>
        <boxGeometry args={[0.08, 0.16, 0.08]} />
        <meshStandardMaterial color="#C99A5B" roughness={0.8} metalness={0} />
      </mesh>
      <mesh ref={meshRef} geometry={panel.geometry} castShadow receiveShadow>
        <meshStandardMaterial color="#FBF3E2" roughness={0.95} metalness={0} side={THREE.DoubleSide} flatShading />
      </mesh>
      {/* the patchwork colour grid rides just in front of the cloth */}
      {cells.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, 0.014]}>
          <planeGeometry args={[c.w, c.h]} />
          <meshStandardMaterial
            color={c.color}
            roughness={0.9}
            metalness={0}
            side={THREE.DoubleSide}
            flatShading
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export function PatchWork() {
  const store = usePatch();
  const { phase, found, total, washP, dryP, holding, nearWasher, nearPeg } = store;

  // Live mirrors for the per-frame loop (avoid stale closures touching the store).
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const holdingRef = useRef(holding);
  holdingRef.current = holding;

  // Track which patch ids have been collected (drives `found` flag per HiddenPatch).
  // We mirror the store's `found` count, but keep our own id set so each patch knows
  // when IT specifically was discovered.
  const collectedRef = useRef(new Set());
  // a render-trigger so HiddenPatch sees its `found` prop flip
  const [, forceRender] = React.useReducer((n) => n + 1, 0);

  // Reset the store (and our local set) whenever this mode mounts.
  useEffect(() => {
    resetPatch();
    collectedRef.current = new Set();
    forceRender();
  }, []);

  // The washing machine is solid — register a UNIQUE obstacle id (don't collide with
  // WashDay's "washer"). Unregister on unmount.
  useEffect(() => {
    registerObstacle("patchWasher", WASHER_POS.x, WASHER_POS.z, 1.0);
    return () => unregisterObstacle("patchWasher");
  }, []);

  // throttle the proximity sweep a touch
  const acc = useRef(0);
  useFrame((state, dt) => {
    const ph = phaseRef.current;

    // timed fills run every frame for smoothness (store-guarded by phase).
    if (ph === "washing" && holdingRef.current) addWash(dt / WASH_TIME);
    if (ph === "drying" && holdingRef.current) addDry(dt / DRY_TIME);

    acc.current += dt;
    if (acc.current < 0.05) return;
    acc.current = 0;

    if (ph === "gather") {
      // discover patches: each uncollected one within DISCOVER_RANGE gets collected.
      let changed = false;
      for (let i = 0; i < PATCHES.length; i += 1) {
        const p = PATCHES[i];
        if (collectedRef.current.has(p.id)) continue;
        const d = Math.hypot(p.pos.x - avatarPos.x, p.pos.z - avatarPos.z);
        if (d < DISCOVER_RANGE) {
          if (collectPatch(p.id)) {
            collectedRef.current.add(p.id);
            sfx.stitch(); // needle stitch as it attaches (patchFound played by store)
            changed = true;
          }
        }
      }
      if (changed) forceRender();
    } else if (ph === "toWasher") {
      const d = Math.hypot(WASHER_POS.x - avatarPos.x, WASHER_POS.z - avatarPos.z);
      setNearWasher(d < NEAR_RANGE);
    } else if (ph === "toPeg") {
      const d = Math.hypot(PEG_POS.x - avatarPos.x, PEG_POS.z - avatarPos.z);
      setNearPeg(d < NEAR_RANGE);
    }
  });

  const washing = phase === "washing";
  const washerGlow = (phase === "toWasher" && nearWasher) || washing;

  // Floating in-world keycap per phase. action:null — PatchHud owns the DOM keys.
  const promptInfo = (() => {
    if (phase === "toWasher" && nearWasher)
      return { pos: [WASHER_POS.x, WASHER_POS.y + 1.6, WASHER_POS.z], k: "L", verb: "load it", hold: false, action: null };
    if (phase === "washing")
      return { pos: [WASHER_POS.x, WASHER_POS.y + 1.6, WASHER_POS.z], k: "S", verb: "wash", hold: true, action: null };
    if (phase === "toPeg" && nearPeg)
      return { pos: [PEG_POS.x, PEG_PROMPT_Y, PEG_POS.z], k: "H", verb: "hang it", hold: false, action: null };
    if (phase === "drying")
      return { pos: [PEG_POS.x, PEG_PROMPT_Y, PEG_POS.z], k: "F", verb: "fan dry", hold: true, action: null };
    return null;
  })();

  return (
    <group>
      {/* the washing machine (self-positions at WASHER_POS) */}
      <WashingMachine
        washing={washing}
        washP={washP}
        holding={holding}
        glow={washerGlow}
        jacketInDrum={washing}
      />

      {/* the hidden patches scattered across the world */}
      {PATCHES.map((p) => (
        <HiddenPatch key={p.id} def={p} found={collectedRef.current.has(p.id)} />
      ))}

      {/* the carried garment that assembles patch-by-patch (hidden once hung) */}
      <CarriedGarment found={found} total={total} phase={phase} washP={washP} />

      {/* the completed garment hanging on the line while drying + done */}
      <HungGarment visible={phase === "drying" || phase === "done"} drying={phase === "drying"} dryP={dryP} />

      {/* the floating keycap prompt (PatchHud owns the actual keys) */}
      <KeyPrompt info={promptInfo} />

      {/* a self-contained wandering bird for life in the world */}
      <WanderBird />
    </group>
  );
}

export default PatchWork;
