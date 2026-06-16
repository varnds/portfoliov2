import * as THREE from "three";

export function seededRng(seed) {
  const s = Math.sin(seed * 91.31 + 7.7) * 43758.5453;
  return s - Math.floor(s);
}

export function makeRadialTexture(inner = 1, mid = 0.85, outer = 0) {
  const s = 64;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, `rgba(255,255,255,${inner})`);
  g.addColorStop(0.55, `rgba(255,255,255,${mid})`);
  g.addColorStop(1, `rgba(255,255,255,${outer})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(cv);
}

export function makeStarTexture() {
  return makeRadialTexture(1, 0.7, 0);
}

export function makeMoteTexture() {
  return makeRadialTexture(1, 0.6, 0);
}

export function makeFireflyTexture() {
  const s = 64;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,245,180,1)");
  g.addColorStop(0.35, "rgba(255,230,120,0.85)");
  g.addColorStop(0.7, "rgba(255,200,80,0.25)");
  g.addColorStop(1, "rgba(255,200,80,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(cv);
}

/** Lantern post approx world position (right post). */
export const LANTERN_WORLD = { x: 5.4, y: 1.1, z: 0.04 };
