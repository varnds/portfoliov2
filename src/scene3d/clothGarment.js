import * as THREE from "three";
import { SCENE_SCALE } from "./coords";

const S = SCENE_SCALE;

/**
 * Cloth garments — a finely subdivided draping SHEET (not an extruded slab), so it
 * reads as fabric and can ripple per-vertex in the breeze.
 *
 * Each type is a half-width profile by height fraction v (0 = top at the line,
 * 1 = hem) plus a height H (in the same SVG-ish units the silhouettes used). The
 * shapes approximate the 2D garments: A-line dress, straight jumpsuit, tapered
 * pants/tights, flat wrap. `bow` is how far the cloth bulges toward the viewer in
 * the middle (volume); `folds` is the number of soft vertical folds that deepen
 * toward the hem.
 */
const PROFILES = {
  LEHENGA:  { h: 172, pts: [[0, 9], [0.05, 15], [0.12, 18], [0.35, 22], [0.65, 28], [1, 35]], folds: 3.0, bow: 11 }, // dress
  KURTA:    { h: 150, pts: [[0, 20], [0.06, 24], [0.5, 25], [1, 26]], folds: 2.4, bow: 12 },                         // jumpsuit / tunic
  CHURIDAR: { h: 150, pts: [[0, 20], [0.25, 17], [0.6, 13], [1, 9]], folds: 2.0, bow: 9 },                           // pants / tights
  DUPATTA:  { h: 165, pts: [[0, 24], [0.5, 23], [1, 22]], folds: 3.2, bow: 8 },                                      // wrap
  SAREE:    { h: 168, pts: [[0, 22], [0.5, 22], [1, 24]], folds: 3.2, bow: 8 },                                      // wrap
  SOCK:     { h: 108, pts: [[0, 9], [0.5, 11], [0.85, 10], [1, 7]], folds: 1.4, bow: 6 },
};

function halfWidthAt(pts, v) {
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [v0, w0] = pts[i];
    const [v1, w1] = pts[i + 1];
    if (v <= v1) {
      const t = (v - v0) / (v1 - v0 || 1);
      return w0 + (w1 - w0) * t;
    }
  }
  return pts[pts.length - 1][1];
}

const ROWS = 40; // height subdivisions
const COLS = 20; // width subdivisions

/**
 * Build a draping cloth sheet for a garment type. Returns the geometry plus the
 * base (rest) positions and a per-vertex hem weight (0 at the pinned top → 1 at
 * the free hem) so the animator can ripple it while keeping the top anchored.
 * A fresh geometry is returned every call so each hanging garment ripples on its
 * own buffer.
 */
/**
 * A flat rectangular panel (z = 0) sized to a garment illustration, finely
 * subdivided so it can ripple. The art texture (drawn with transparency outside
 * the garment shape) supplies the silhouette — so this reads as a 2D drawing
 * standing in the 3D world. Top edge sits at y = 0 (the clothesline); the panel
 * hangs down. vWeight is 0 at the pinned top → 1 at the free hem.
 */
export function buildFlatPanel(wWorld, hWorld, rows = 34, cols = 16) {
  const positions = [];
  const uvs = [];
  const vWeights = [];
  const indices = [];
  for (let j = 0; j <= rows; j += 1) {
    const v = j / rows;
    const y = -v * hWorld;
    for (let i = 0; i <= cols; i += 1) {
      const u = i / cols;
      positions.push((u - 0.5) * wWorld, y, 0);
      uvs.push(u, 1 - v); // texture top (uv.y=1) → garment top
      vWeights.push(v);
    }
  }
  const cw = cols + 1;
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const a = j * cw + i;
      const b = a + 1;
      const c = a + cw;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return {
    geometry: geo,
    base: new Float32Array(positions),
    vWeight: new Float32Array(vWeights),
    rows,
    cols,
  };
}

export function buildClothGarment(typeKey) {
  const prof = PROFILES[typeKey] || PROFILES.KURTA;
  const H = prof.h;
  const positions = [];
  const uvs = [];
  const vWeights = [];
  const indices = [];

  for (let j = 0; j <= ROWS; j += 1) {
    const v = j / ROWS;
    const hw = halfWidthAt(prof.pts, v);
    const y = -v * H;
    // Drape envelope: ~0 at the pinched top, fuller through the body — gives the
    // cloth real cross-section volume instead of a flat plane.
    const drape = Math.sin(Math.min(v * 1.15, 1) * Math.PI * 0.85);
    for (let i = 0; i <= COLS; i += 1) {
      const u = i / COLS;
      const x = (u * 2 - 1) * hw;
      const bow = Math.sin(u * Math.PI) * prof.bow * drape; // bulge toward viewer
      const fold = Math.sin(u * Math.PI * prof.folds) * (prof.bow * 0.45) * v; // folds deepen to hem
      const z = bow + fold;
      positions.push(x * S, y * S, z * S);
      uvs.push(u, 1 - v);
      vWeights.push(v);
    }
  }

  const cw = COLS + 1;
  for (let j = 0; j < ROWS; j += 1) {
    for (let i = 0; i < COLS; i += 1) {
      const a = j * cw + i;
      const b = a + 1;
      const c = a + cw;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return {
    geometry: geo,
    base: new Float32Array(positions),
    vWeight: new Float32Array(vWeights),
    rows: ROWS,
    cols: COLS,
  };
}
