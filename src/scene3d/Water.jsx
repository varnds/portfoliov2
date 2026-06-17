/**
 * Water.jsx — Seasonal pond nestled in the terrain diorama.
 *
 * Pond center: x ≈ -30, z ≈ -22  (≈ 37 units from origin, well clear of the
 * clothesline's radius-14 exclusion zone). Diameter: ~18 units.
 *
 * Season behaviour:
 *   spring  — fresh blue-green, gentle vertex ripple, soft glints
 *   summer  — warm teal, same ripple, brighter glints
 *   autumn  — cooler desaturated slate-blue, slower ripple
 *   winter  — opaque faceted ice (pale blue-white), crack lines, no ripple
 *   night   — dark reflective navy, faint moonlight glints, very slow ripple
 */

import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { terrainHeight, POND_X, POND_Z, POND_RADIUS, pondEdgeRadius } from "./coords";
import { seededRng, makeRadialTexture } from "./particleUtils";
import { registerObstacle, unregisterObstacle } from "../game/gameStore";

// ─── constants ────────────────────────────────────────────────────────────────
// POND_X/Z/RADIUS come from coords.js (same values the terrain basin is carved
// from) so the water fills the bowl exactly.

const SHORE_WIDTH = 2.4;    // extra band of shore geometry around the disc
const RADIAL_SEGS = 26;     // segments around the circle (low-poly look) — shore uses this
const WATER_RADIAL_SEGS = 64; // finer resolution for the water surface so ripples read smooth
const RING_SEGS = 14;       // concentric rings inside the disc (denser → smoother waves)

// Sun / sky-light direction projected onto the water plane. The bright glancing
// reflection ("sun glitter path") is elongated along this axis so it reads like
// a real reflection of the low desert sun rather than a centred coin.
const SUN_DIR = new THREE.Vector2(0.55, -0.82).normalize();

// Rotation (about the plane normal) that aligns the glitter texture's long axis
// with SUN_DIR. The reflection plane is laid flat (rotation.x = -PI/2); after
// that, its local +Y maps to world -Z, so we rotate so the streak runs along
// SUN_DIR in the X/Z plane.
const REFL_ANGLE = Math.atan2(SUN_DIR.x, -SUN_DIR.y);

// The sun sits low on one side, so its reflection (and the strongest sky sheen)
// falls on the side of the pond toward the sun. Offset both highlights that way.
const SUN_OFFSET = 0.32; // fraction of POND_RADIUS toward the sun side

// The terrain is carved into a ~1.9-deep bowl at the pond centre. Fill it part
// way so the water has a real waterline with banks sloping up out of it (the
// disc edge tucks under the banks instead of sitting proud as a flat circle).
function computeWaterY() {
  // Fill the (now deeper, 1.6) basin most of the way: a higher waterline means
  // more open water and submerges any rolling-hill ridge that used to poke
  // through the shallow surface and split the pool into separate patches.
  return terrainHeight(POND_X, POND_Z) + 0.95;
}

export const WATER_Y = computeWaterY();

// ─── season colour palette ────────────────────────────────────────────────────

const SEASON_CONFIG = {
  spring: {
    color: new THREE.Color("#5EC4A8"),
    opacity: 0.72,
    rippleSpeed: 0.55,
    rippleAmp: 0.085,
    glintColor: new THREE.Color("#ADFFD8"),
    roughness: 0.18,
    metalness: 0.35,
  },
  summer: {
    color: new THREE.Color("#2AA8C4"),
    opacity: 0.75,
    rippleSpeed: 0.65,
    rippleAmp: 0.095,
    glintColor: new THREE.Color("#B8F0FF"),
    roughness: 0.14,
    metalness: 0.42,
  },
  autumn: {
    color: new THREE.Color("#4A7A90"),
    opacity: 0.78,
    rippleSpeed: 0.28,
    rippleAmp: 0.06,
    glintColor: new THREE.Color("#8AB0BE"),
    roughness: 0.3,
    metalness: 0.25,
  },
  winter: {
    // Bright sky-blue frozen pond.
    color: new THREE.Color("#76C7F0"),
    opacity: 1.0,
    rippleSpeed: 0,
    rippleAmp: 0,
    glintColor: new THREE.Color("#E6F6FF"),
    roughness: 0.4,
    metalness: 0.18,
  },
  night: {
    color: new THREE.Color("#1A2E55"),
    opacity: 0.88,
    rippleSpeed: 0.18,
    rippleAmp: 0.05,
    glintColor: new THREE.Color("#6088C8"),
    roughness: 0.08,
    metalness: 0.6,
  },
};

// Sky-gradient stops per season — baked into a tiny equirect texture used as the
// water's OWN envMap so the whole surface reflects the sky evenly (a real, full
// reflection rather than just a single sun-specular hot-spot).
const SKY_GRADIENT = {
  spring: [[0, "#EAF4E8"], [0.5, "#F3E6C8"], [1, "#D8B98A"]],
  summer: [[0, "#FBEFD6"], [0.45, "#F3D9AE"], [0.62, "#E8B07A"], [1, "#C98A5A"]],
  autumn: [[0, "#F3E2C4"], [0.5, "#E6B488"], [1, "#B87848"]],
  winter: [[0, "#EAF6FF"], [0.55, "#CDE8F6"], [1, "#9FC6DE"]],
  night:  [[0, "#1B2647"], [0.5, "#22305A"], [1, "#0E1530"]],
};

function buildSkyEnvMap(season) {
  const stops = SKY_GRADIENT[season] || SKY_GRADIENT.summer;
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  stops.forEach(([s, col]) => g.addColorStop(s, col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Soft "sun glitter" reflection texture — a vertically-elongated, feathered
 * smear with a few broken horizontal streaks, NOT a hard radial coin. Drawn into
 * a tall canvas so when mapped onto a plane that we stretch along the sun axis it
 * reads as the broken reflection of the sky/sun on rippling water.
 */
function buildSunGlitterTexture() {
  const W = 64, H = 256;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, W, H);

  // Base soft elongated glow (an ellipse much taller than wide, feathered out).
  const cx = W / 2;
  const cy = H / 2;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.5);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.45)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.save();
  // Stretch the radial along Y to make the long reflection path.
  ctx.translate(cx, cy);
  ctx.scale(1, H / W * 0.9);
  ctx.translate(-cx, -cy);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Broken horizontal streaks (the glittering ripple breakup) fading toward ends.
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    const y = t * H;
    // Stronger near the centre of the path, faint at the ends.
    const edgeFade = Math.sin(t * Math.PI);
    const wob = Math.sin(i * 1.7) * 0.5 + 0.5;
    const halfW = (4 + wob * 16) * edgeFade;
    const alpha = 0.10 + wob * 0.18 * edgeFade;
    if (halfW <= 0) continue;
    const g = ctx.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, `rgba(255,255,255,${alpha.toFixed(3)})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - halfW, y - 1.2, halfW * 2, 2.4);
  }
  ctx.globalCompositeOperation = "source-over";

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ─── geometry builders ────────────────────────────────────────────────────────

/**
 * Local Y for a water-surface vertex.
 *
 * The water is a FLAT plane at WATER_Y. The terrain basin that hides its edges
 * (so the pool nestles in a depression instead of floating) is carved in
 * coords.js gated by an "origin guard" that SUPPRESSES the carve within ~r17 of
 * the world origin, to keep the clothesline yard level. The pond centre sits at
 * r≈22, but its rim reaching toward the yard dips into that guard zone — so
 * there the basin is NOT carved and the flat water plane floats on un-carved
 * sand, reading as a stray rippling "lake" patch away from the main pool.
 *
 * Fix: mirror the guard. Where the carve is suppressed (guard < 1), sink the
 * water vertex DOWN beneath the local (un-carved) ground so it's hidden. Scaled
 * by exactly (1 - guard): in the entire main pool (guard = 1) this is 0, so the
 * visible lake is unchanged; only the suppressed rim lobe tucks under the sand.
 */
function waterVertexY(vx, vz) {
  const r = Math.sqrt(vx * vx + vz * vz);
  const og = Math.min(Math.max((r - 10) / 7, 0), 1);
  const guard = og * og * (3 - 2 * og); // same smoothstep as the terrain carve
  const exposure = 1 - guard;           // 1 near origin, 0 across the main pool
  if (exposure <= 0.001) return 0;
  const groundY = terrainHeight(vx, vz);
  const hideY = groundY - 0.5 - WATER_Y; // local Y that buries the vertex 0.5 under ground
  return Math.min(0, hideY * exposure);  // lerp 0→hideY by exposure; never raise water
}

/**
 * Build a low-poly disc for the water surface.
 * Vertices lie at varying radii (concentric rings + centre) so the
 * vertex-wobble ripple looks organic rather than spinning.
 */
function buildWaterGeometry() {
  const positions = [];
  const indices = [];

  // Centre vertex
  positions.push(POND_X, waterVertexY(POND_X, POND_Z), POND_Z);

  // Concentric rings — each ring's radius follows the organic pond outline
  // (pondEdgeRadius) scaled inward, so the whole pool is an irregular lobed shape.
  // Rings are spaced with a slight ease so there are more of them toward the rim
  // (where the glancing sky sheen falls off fastest and needs resolution).
  for (let r = 1; r <= RING_SEGS; r++) {
    const frac = r / RING_SEGS;
    for (let s = 0; s < WATER_RADIAL_SEGS; s++) {
      const angle = (s / WATER_RADIAL_SEGS) * Math.PI * 2;
      const radius = pondEdgeRadius(angle) * frac;
      const vx = POND_X + Math.cos(angle) * radius;
      const vz = POND_Z + Math.sin(angle) * radius;
      positions.push(vx, waterVertexY(vx, vz), vz);
    }
  }

  // Fan from centre to first ring
  for (let s = 0; s < WATER_RADIAL_SEGS; s++) {
    const a = 1 + s;
    const b = 1 + ((s + 1) % WATER_RADIAL_SEGS);
    indices.push(0, a, b);
  }

  // Quads between rings
  for (let r = 0; r < RING_SEGS - 1; r++) {
    const innerBase = 1 + r * WATER_RADIAL_SEGS;
    const outerBase = 1 + (r + 1) * WATER_RADIAL_SEGS;
    for (let s = 0; s < WATER_RADIAL_SEGS; s++) {
      const i0 = innerBase + s;
      const i1 = innerBase + ((s + 1) % WATER_RADIAL_SEGS);
      const o0 = outerBase + s;
      const o1 = outerBase + ((s + 1) % WATER_RADIAL_SEGS);
      indices.push(i0, o0, i1);
      indices.push(i1, o0, o1);
    }
  }

  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(positions);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Shore band: a narrow ring of geometry around the pond edge, coloured darker
 * (wet sand / dark shore) so the water disc doesn't float.
 */
function buildShoreGeometry() {
  const positions = [];
  const indices = [];
  const colors = [];

  const darkShore = new THREE.Color("#A2855A"); // damp sand at the waterline
  const midShore = new THREE.Color("#BFA372");  // blends out to dry ground

  for (let s = 0; s < RADIAL_SEGS; s++) {
    const angle = (s / RADIAL_SEGS) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const innerR = pondEdgeRadius(angle);          // organic waterline
    const outerR = innerR + SHORE_WIDTH;            // shore band follows it

    // inner vertex (pond edge — slightly depressed)
    const ix = POND_X + cos * innerR;
    const iz = POND_Z + sin * innerR;
    const iy = terrainHeight(ix, iz) - 0.08;
    positions.push(ix, iy, iz);
    colors.push(darkShore.r, darkShore.g, darkShore.b);

    // outer vertex (blends back into terrain)
    const ox = POND_X + cos * outerR;
    const oz = POND_Z + sin * outerR;
    const oy = terrainHeight(ox, oz);
    positions.push(ox, oy, oz);
    colors.push(midShore.r, midShore.g, midShore.b);
  }

  // Quads around the ring
  for (let s = 0; s < RADIAL_SEGS; s++) {
    const i0 = s * 2;
    const i1 = s * 2 + 1;
    const i2 = ((s + 1) % RADIAL_SEGS) * 2;
    const i3 = ((s + 1) % RADIAL_SEGS) * 2 + 1;
    indices.push(i0, i2, i1);
    indices.push(i1, i2, i3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Ice crack lines for winter — a handful of line segments radiating across the
 * frozen surface, roughly centred on the pond.
 */
function buildIceCracks() {
  const pts = [];
  const crackCount = 6;
  for (let i = 0; i < crackCount; i++) {
    // Seeded deterministic positions
    const seed1 = Math.sin(i * 13.7) * 0.5 + 0.5;
    const seed2 = Math.sin(i * 27.3 + 1.1) * 0.5 + 0.5;
    const seed3 = Math.sin(i * 41.9 + 2.3) * 0.5 + 0.5;
    const angle = seed1 * Math.PI * 2;
    const startR = seed2 * POND_RADIUS * 0.25;
    const endR = pondEdgeRadius(angle) * (0.45 + seed3 * 0.45);
    const jitter = (Math.sin(i * 53.1) * 0.5 + 0.5) * 0.4 - 0.2;

    pts.push(
      new THREE.Vector3(
        POND_X + Math.cos(angle) * startR,
        WATER_Y + 0.01,
        POND_Z + Math.sin(angle) * startR
      ),
      new THREE.Vector3(
        POND_X + Math.cos(angle + jitter) * endR,
        WATER_Y + 0.01,
        POND_Z + Math.sin(angle + jitter) * endR
      )
    );
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return geo;
}

// ─── glint sparkles (points) ─────────────────────────────────────────────────

function buildGlintGeometry(count = 14) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = (Math.sin(i * 37.1) * 0.5 + 0.5) * Math.PI * 2;
    const r = (Math.sin(i * 71.3 + 1) * 0.5 + 0.5) * pondEdgeRadius(a) * 0.8;
    positions[i * 3] = POND_X + Math.cos(a) * r;
    positions[i * 3 + 1] = WATER_Y + 0.05;
    positions[i * 3 + 2] = POND_Z + Math.sin(a) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geo;
}

// ─── shore rock season palette ────────────────────────────────────────────────
// Matches Foliage.jsx SEASON_COLORS rock entries exactly

const ROCK_PALETTE = {
  spring: { rockA: "#9AADA4", rockB: "#B2C4BC" },            // mossy grey-green
  summer: { rockA: "#C8A870", rockB: "#DAB882" },            // warm sandstone
  autumn: { rockA: "#C0885C", rockB: "#B87840" },            // warm grey-brown
  winter: { rockA: "#7A8898", rockB: "#8898A8", snow: "#EEF2F8" }, // cool grey + snow
  night:  { rockA: "#202228", rockB: "#282A30" },            // near-black silhouettes
};

// ─── shore rock placement (seeded, irregular ring) ────────────────────────────

/**
 * Returns an array of rock descriptors placed around the pond shore.
 * Uses a deterministic seeded RNG so positions never drift between renders.
 *
 * Strategy:
 *  - 20 rocks total: 6 large anchor boulders, 14 smaller stones.
 *  - Placed on an irregular ring between POND_RADIUS*0.88 and POND_RADIUS+SHORE_WIDTH+0.6.
 *    Inner fraction → half-submerged at waterline; outer fraction → back from shore.
 *  - Angular jitter breaks the tidy-circle feel.
 *  - A handful of intentional gaps (open water views) via angle exclusion.
 */
function buildShoreRocks() {
  const rocks = [];

  // Anchor boulders: 6 large, spread unevenly around the ring
  const anchorAngles = [0.35, 1.12, 2.05, 2.88, 4.10, 5.30]; // radians, hand-tuned
  anchorAngles.forEach((baseAngle, i) => {
    const s = seededRng(i * 31 + 7);
    const angle = baseAngle + (seededRng(i * 17 + 3) - 0.5) * 0.38;
    // Vary radial placement: some kissing the water (0.90 r), some slightly back (1.05 r)
    const radialFrac = 0.90 + seededRng(i * 43 + 11) * 0.18;
    const r = pondEdgeRadius(angle) * radialFrac;
    const x = POND_X + Math.cos(angle) * r;
    const z = POND_Z + Math.sin(angle) * r;
    const y = terrainHeight(x, z);
    const scale = 0.5 + seededRng(i * 61 + 5) * 0.42;    // 0.50–0.92
    const rotY = seededRng(i * 79 + 13) * Math.PI * 2;
    const rockSeed = seededRng(i * 53 + 1);
    rocks.push({ x, y, z, scale, rotY, rockSeed, isLarge: true, slot: i });
  });

  // Smaller stones: scattered at tighter radii with more angular jitter
  const stoneCount = 28;
  for (let i = 0; i < stoneCount; i++) {
    // Spread across the full circle, with a gap around ~3.5–3.9 rad (open water view)
    let angle = (i / stoneCount) * Math.PI * 2 + seededRng(i * 23 + 99) * 0.55;
    // Nudge to avoid the intentional open gap band
    if (angle > 3.4 && angle < 3.95) angle += 0.55;

    const radialFrac = 0.86 + seededRng(i * 37 + 77) * 0.32; // 0.86–1.18 × edge
    const r = pondEdgeRadius(angle) * radialFrac;
    const x = POND_X + Math.cos(angle) * r;
    const z = POND_Z + Math.sin(angle) * r;
    const y = terrainHeight(x, z);
    const scale = 0.22 + seededRng(i * 41 + 55) * 0.34;   // 0.22–0.56
    const rotY = seededRng(i * 67 + 21) * Math.PI * 2;
    const rockSeed = seededRng(i * 29 + 3);
    rocks.push({ x, y, z, scale, rotY, rockSeed, isLarge: false, slot: i + 10 });
  }

  // Outer scatter: small pebbles spread further out on the bank (mixes with the
  // grass) so the shore reads as a rocky, vegetated edge rather than a tidy ring.
  const outerCount = 22;
  for (let i = 0; i < outerCount; i++) {
    const angle = (i / outerCount) * Math.PI * 2 + seededRng(i * 19 + 131) * 0.7;
    const radialFrac = 1.2 + seededRng(i * 53 + 61) * 0.55; // 1.2–1.75 × edge (on the bank)
    const r = pondEdgeRadius(angle) * radialFrac;
    const x = POND_X + Math.cos(angle) * r;
    const z = POND_Z + Math.sin(angle) * r;
    const y = terrainHeight(x, z);
    const scale = 0.16 + seededRng(i * 47 + 17) * 0.3; // 0.16–0.46 (little pebbles)
    const rotY = seededRng(i * 71 + 9) * Math.PI * 2;
    const rockSeed = seededRng(i * 23 + 7);
    rocks.push({ x, y, z, scale, rotY, rockSeed, isLarge: false, slot: i + 40 });
  }

  return rocks;
}

// ─── shore rock renderers ─────────────────────────────────────────────────────

/** Single low-poly boulder — icosahedron (detail=0) squashed like Foliage's Rock */
function ShoreRock({ x, y, z, scale: s, rotY, rockSeed, isLarge, slot, season }) {
  const pal = ROCK_PALETTE[season] || ROCK_PALETTE.summer;
  // Alternate between the two palette colours using rockSeed
  const baseColor = rockSeed > 0.5 ? pal.rockA : pal.rockB;
  const isWinter = season === "winter";

  // Squash/stretch ratios: vary per rock for organic feel
  const sx = s * (1.2 + rockSeed * 0.25);
  const sy = s * (0.55 + rockSeed * 0.22);
  const sz = s * (1.0 + rockSeed * 0.18);

  // Big boulders are solid — the avatar collides instead of walking through them.
  useEffect(() => {
    if (!isLarge) return undefined;
    const id = `shorerock-${slot}`;
    registerObstacle(id, x, z, 0.55 * sx);
    return () => unregisterObstacle(id);
  }, [isLarge, slot, x, z, sx]);

  // Seat so the rock bottom sits on the terrain (icosa radius ≈ 0.55 * sy)
  const yOffset = 0.55 * sy;

  return (
    <group position={[x, y + yOffset, z]} rotation={[0.15 * rockSeed, rotY, 0.08 * rockSeed]}>
      <mesh scale={[sx, sy, sz]} castShadow receiveShadow>
        <icosahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color={baseColor} flatShading roughness={0.88} metalness={0.04} />
      </mesh>
      {/* Winter: small snow cap cone on top of boulder */}
      {isWinter && isLarge && (
        <mesh position={[0, 0.55 * sy + 0.05, 0]}>
          <coneGeometry args={[0.32 * sx, 0.14 * sy + 0.1, 5]} />
          <meshStandardMaterial color={pal.snow} flatShading roughness={0.95} metalness={0} />
        </mesh>
      )}
    </group>
  );
}

/** Rocky shore group — memoised placement, season-tinted */
function ShoreRocks({ season }) {
  const rocks = useMemo(() => buildShoreRocks(), []);

  return (
    <group name="shore-rocks">
      {rocks.map((rock, i) => (
        <ShoreRock key={i} {...rock} season={season} />
      ))}
    </group>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function Water({ seasonKey, palette }) {
  const season = seasonKey || "summer";
  const cfg = SEASON_CONFIG[season] || SEASON_CONFIG.summer;
  const isFrozen = season === "winter";

  // Stable geometry (doesn't change per season)
  const waterGeo = useMemo(() => buildWaterGeometry(), []);
  const crackGeo = useMemo(() => buildIceCracks(), []);
  const glintGeo = useMemo(() => buildGlintGeometry(), []);

  // Per-season sky env map for a soft full-surface reflection.
  const envMap = useMemo(() => buildSkyEnvMap(season), [season]);
  useEffect(() => () => envMap.dispose(), [envMap]);

  // Soft elongated "sun glitter" reflection along the sun axis (replaces the old
  // hard centred coin). Lives on a plane stretched along SUN_DIR.
  const reflTex = useMemo(() => buildSunGlitterTexture(), []);
  useEffect(() => () => reflTex.dispose(), [reflTex]);
  const reflRef = useRef();
  const reflMatRef = useRef();

  // Fresnel sky-sheen patch: a brighter, larger soft glow concentrated toward the
  // FAR rim (grazing angle, where real water reflects the sky most). Additive,
  // very soft, tinted with the season sky colour.
  const sheenTex = useMemo(() => makeRadialTexture(1, 0.55, 0), []);
  useEffect(() => () => sheenTex.dispose(), [sheenTex]);
  const sheenRef = useRef();

  // Store original vertex Y positions for ripple animation
  const origPositions = useMemo(() => {
    const pos = waterGeo.attributes.position;
    const arr = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) arr[i] = pos.getY(i);
    return arr;
  }, [waterGeo]);

  const waterMatRef = useRef();
  const waterMeshRef = useRef();
  const glintRef = useRef();

  // Animate ripple: per-vertex Y wobble keyed to world X/Z position + time
  useFrame(({ clock }) => {
    if (isFrozen) return;
    const t = clock.elapsedTime;
    const { rippleSpeed, rippleAmp } = cfg;

    // Water surface vertex wobble
    if (waterMeshRef.current) {
      const pos = waterMeshRef.current.geometry.attributes.position;
      const origPos = waterGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const wx = origPos.getX(i);
        const wz = origPos.getZ(i);
        const dx = wx - POND_X;
        const dz = wz - POND_Z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Richer water motion: a couple of gentle concentric swells expanding
        // outward at different scales/speeds, PLUS two directional wave trains
        // travelling across the pond at an angle to each other. Summing several
        // octaves of unequal wavelength breaks the single-ring look into
        // believable, slowly-drifting water.
        const wave =
          // concentric swells
          Math.sin(dist * 0.7 - t * rippleSpeed * 2.0) * rippleAmp * 0.42 +
          Math.sin(dist * 1.45 - t * rippleSpeed * 3.1) * rippleAmp * 0.24 +
          // directional train A
          Math.sin((dx * 0.62 + dz * 0.78) * 1.05 + t * rippleSpeed * 1.7) * rippleAmp * 0.30 +
          // directional train B (crosses A) — finer, faster chop
          Math.sin((dx * -0.80 + dz * 0.59) * 1.9 + t * rippleSpeed * 2.6) * rippleAmp * 0.18 +
          // tiny high-frequency detail so light catches small facets
          Math.sin((dx * 1.3 - dz * 0.9) * 2.7 - t * rippleSpeed * 3.4) * rippleAmp * 0.09;
        pos.setY(i, origPositions[i] + wave);
      }
      pos.needsUpdate = true;
      waterMeshRef.current.geometry.computeVertexNormals();
    }

    // Glint opacity pulse (subtle — a few faint sparkles, not a shiny sheet)
    if (glintRef.current) {
      glintRef.current.material.opacity =
        0.14 + Math.sin(t * rippleSpeed * 4.2 + 1.3) * 0.1;
    }

    // Sun-glitter reflection: gentle shimmer in brightness + a slight length
    // breathing along the sun axis, plus a slow sway so the streaks live.
    if (reflMatRef.current) {
      reflMatRef.current.opacity = 0.22 + Math.sin(t * rippleSpeed * 3.4) * 0.07;
    }
    if (reflRef.current) {
      const stretch = 1 + Math.sin(t * rippleSpeed * 1.6 + 0.7) * 0.05;
      reflRef.current.scale.y = stretch;
      reflRef.current.rotation.z = REFL_ANGLE + Math.sin(t * rippleSpeed * 0.8) * 0.04;
    }

    // Fresnel sky-sheen on the far rim: very slow breathing.
    if (sheenRef.current) {
      sheenRef.current.material.opacity = 0.18 + Math.sin(t * rippleSpeed * 1.4 + 2.0) * 0.05;
    }
  });

  return (
    <group>
      {/* Rocky shore boulders and stones */}
      <ShoreRocks season={season} />

      {/* Water / ice disc */}
      <mesh
        ref={waterMeshRef}
        position={[0, WATER_Y, 0]}
        geometry={waterGeo}
        receiveShadow
      >
        <meshStandardMaterial
          ref={waterMatRef}
          color={cfg.color}
          emissive={cfg.color}
          emissiveIntensity={isFrozen ? 0 : 0.06}
          transparent={!isFrozen}
          opacity={cfg.opacity}
          // Liquid water: low roughness so the envMap sky reads as a soft sheen
          // (not a flat patch), modest metalness so it's reflective but not a
          // mirror. Winter keeps its frosted-ice look.
          roughness={isFrozen ? cfg.roughness : cfg.roughness}
          metalness={isFrozen ? 0.2 : cfg.metalness}
          envMap={envMap}
          envMapIntensity={isFrozen ? 0.9 : 0.55}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Fresnel-style sky sheen: a broad, very soft additive glow biased to the
          far (sun-side) rim, where grazing-angle reflection of the sky is
          strongest on real water. Large and feathered so it integrates with the
          surface instead of reading as a hard disc. */}
      {!isFrozen && (
        <mesh
          ref={sheenRef}
          position={[
            POND_X + SUN_DIR.x * POND_RADIUS * SUN_OFFSET * 1.4,
            WATER_Y + 0.02,
            POND_Z + SUN_DIR.y * POND_RADIUS * SUN_OFFSET * 1.4,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[POND_RADIUS * 0.92, 48]} />
          <meshBasicMaterial
            map={sheenTex}
            color={cfg.glintColor}
            transparent
            opacity={0.18}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Sun-glitter reflection path: a soft, elongated, broken highlight that
          runs along the sun direction across the water — the integrated
          reflection of the low sun, replacing the old centred coin. */}
      {!isFrozen && (
        <mesh
          ref={reflRef}
          position={[
            POND_X + SUN_DIR.x * POND_RADIUS * SUN_OFFSET,
            WATER_Y + 0.04,
            POND_Z + SUN_DIR.y * POND_RADIUS * SUN_OFFSET,
          ]}
          rotation={[-Math.PI / 2, 0, REFL_ANGLE]}
        >
          {/* Plane: narrow in X, long in Y (the streak runs down Y, which we
              align to the sun axis via REFL_ANGLE). */}
          <planeGeometry args={[POND_RADIUS * 0.55, POND_RADIUS * 1.25]} />
          <meshBasicMaterial
            ref={reflMatRef}
            map={reflTex}
            color={cfg.glintColor}
            transparent
            opacity={0.24}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Winter ice crack lines */}
      {isFrozen && (
        <lineSegments geometry={crackGeo}>
          <lineBasicMaterial color="#8AAFCC" transparent opacity={0.55} />
        </lineSegments>
      )}

      {/* Surface glints (small bright points) — liquid seasons only */}
      {!isFrozen && (
        <points ref={glintRef} geometry={glintGeo}>
          <pointsMaterial
            color={cfg.glintColor}
            size={0.18}
            sizeAttenuation
            transparent
            opacity={0.45}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}
    </group>
  );
}
