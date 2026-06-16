/** Shared SVG ↔ world mapping + terrain for the clothesline diorama. */
export const SCENE_SCALE = 0.012;
export const ORIGIN_X = 520;
export const GROUND_SVG_Y = 640;

export const TERRAIN_HALF_W = 110;
export const TERRAIN_HALF_D = 100;

// Pond placement (recovered from the discovery-era scene). Used by Water/PondLife.
export const POND_X = -15;
export const POND_Z = 16;
export const POND_RADIUS = 11;

const YARD = -0.15;

export function svgXToWorld(x) {
  return (x - ORIGIN_X) * SCENE_SCALE;
}

export function svgClearance(sy) {
  return (GROUND_SVG_Y - sy) * SCENE_SCALE;
}

/**
 * Living terrain: gentle rolling hills everywhere, layered hill ranges that
 * rise as the land recedes behind the clothesline, and a flattened "yard"
 * around the posts so the scene sits level.
 */
export function terrainHeight(x, z) {
  const rolling =
    Math.sin(x * 0.16 + 0.4) * Math.cos(z * 0.14 - 0.2) * 0.45 +
    Math.sin(x * 0.34 - 1.1) * Math.cos(z * 0.29 + 0.6) * 0.22 +
    Math.sin(x * 0.62 + 2.0) * Math.cos(z * 0.5 + 1.3) * 0.1;

  // Back ranges grow as z goes negative (further behind the clothesline).
  const back = Math.max(0, -z - 6);
  const rangeRise = (1 - Math.exp(-back * 0.1)) * 2.6;
  const rangeCrest =
    Math.sin(x * 0.2 + 1.0) * Math.min(back, 16) * 0.11 +
    Math.sin(x * 0.09 - 0.6) * Math.min(back, 24) * 0.06;

  let h = YARD + rolling + rangeRise + rangeCrest;

  // Flatten the clothesline yard so posts + basket rest on level ground.
  const yard = Math.exp(-((x * x) / 90 + ((z - 0.5) * (z - 0.5)) / 10));
  h = h * (1 - yard * 0.92) + YARD * (yard * 0.92);

  // Pond basin: carve a smooth bowl so the water nestles in a real depression
  // with sloped banks (only partly visible — a thing to find) instead of sitting
  // on the surface as a flat disc. An origin guard keeps the clothesline yard level.
  const pdx = x - POND_X;
  const pdz = z - POND_Z;
  const basinR = POND_RADIUS * 1.55;
  const pd = Math.sqrt(pdx * pdx + pdz * pdz);
  if (pd < basinR) {
    const r = Math.sqrt(x * x + z * z);
    let bowl = Math.cos((pd / basinR) * Math.PI * 0.5);
    bowl = bowl * bowl; // smooth 1→0, flat slope at the rim
    const og = Math.min(Math.max((r - 10) / 7, 0), 1);
    const guard = og * og * (3 - 2 * og); // smoothstep: 0 within r10, 1 beyond r17
    h -= 1.1 * bowl * guard; // sink the dish so the banks hide most of the water
  }

  return h;
}

/** Post foot sits on the terrain; top derived from SVG clearance. */
export function postLayout(sx, bottomSvgY, topSvgY, z) {
  const x = svgXToWorld(sx);
  const footY = terrainHeight(x, z);
  const height = (bottomSvgY - topSvgY) * SCENE_SCALE;
  return {
    x,
    z,
    footY,
    topY: footY + height,
    height,
  };
}

/** Place a ground-resting prop from its SVG anchor onto the terrain. */
export function svgToWorldOnTerrain(sx, sy, sz = 0) {
  const x = svgXToWorld(sx);
  const z = sz;
  const y = terrainHeight(x, z) + svgClearance(sy) - svgClearance(GROUND_SVG_Y);
  return [x, y, z];
}

export function svgToWorld(sx, sy, sz = 0) {
  return svgToWorldOnTerrain(sx, sy, sz);
}

/** The single clothesline curve both the rope and the garments hang from. */
export const ROPE_SAG = 0.5;

export function clotheslineEnds(leftPost, rightPost) {
  return {
    L: [leftPost.x, leftPost.topY, leftPost.z],
    R: [rightPost.x, rightPost.topY, rightPost.z],
  };
}

export function clotheslinePoint(t, L, R, sag = ROPE_SAG) {
  const x = L[0] + (R[0] - L[0]) * t;
  const y0 = L[1] + (R[1] - L[1]) * t;
  const z = L[2] + (R[2] - L[2]) * t;
  return [x, y0 - Math.sin(Math.PI * t) * sag, z];
}

/** Fraction along the line for a garment given its SVG x anchor. */
export function lineFraction(svgX) {
  return Math.min(1, Math.max(0, (svgX - 70) / (970 - 70)));
}

/** Angled diorama overview: sky, sun and layered hills all in frame. */
export function computeCameraPreset(hangPositions) {
  let cx = 0;
  if (hangPositions?.length) {
    cx = hangPositions.reduce((s, h) => s + svgXToWorld(h.x), 0) / hangPositions.length;
  }
  return {
    target: [cx, 2.2, -2],
    position: [cx + 9, 9, 16],
    fov: 42,
  };
}

/** Close, eye-level framing that matches the flat 2D clothesline view — used as
 * the first frame when entering 3D so the cross-fade feels continuous. */
export function computeEntryCamera(hangPositions) {
  const { target, fov } = computeCameraPreset(hangPositions);
  const cx = target[0];
  return {
    position: [cx + 0.4, 2.82, 6.4],
    target: [cx, 2.58, -0.6],
    fov: 54,
    endFov: fov,
  };
}

/** Low golden-hour sun sitting in the sky off to the right and BEHIND the
 * clothesline, so the garments are backlit and glow — matching the soft, hazy
 * reference. The visible sun disc and the key light share this direction. */
export const SUN_POSITION = [44, 28, -60];
