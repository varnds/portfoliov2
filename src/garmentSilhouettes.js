import * as THREE from "three";
import { SCENE_SCALE } from "./scene3d/coords";

const S = SCENE_SCALE;
const DEPTH = 0.16;

function to3([sx, sy]) {
  return [sx * S, -sy * S];
}

function shapeFromPoints(svgPoints) {
  const shape = new THREE.Shape();
  svgPoints.forEach(([sx, sy], i) => {
    const [x, y] = to3([sx, sy]);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

function extrudePoints(svgPoints, depth = DEPTH) {
  const geo = new THREE.ExtrudeGeometry(shapeFromPoints(svgPoints), {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

function mergeGeometries(geos) {
  const merged = new THREE.BufferGeometry();
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let vOffset = 0;

  geos.forEach((g) => {
    g.computeVertexNormals();
    const pos = g.getAttribute("position");
    const norm = g.getAttribute("normal");
    const uv = g.getAttribute("uv");
    const idx = g.getIndex();
    for (let i = 0; i < pos.count; i += 1) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (norm) normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
    }
    if (idx) {
      for (let i = 0; i < idx.count; i += 1) indices.push(idx.getX(i) + vOffset);
    }
    vOffset += pos.count;
    g.dispose();
  });

  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length) merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  if (uvs.length) merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  if (indices.length) merged.setIndex(indices);
  merged.computeVertexNormals();
  return merged;
}

const SILHOUETTES = {
  LEHENGA: [
    [[-16, 0], [16, 0], [18, 34], [0, 38], [-18, 34]],
    [[-14, 32], [-32, 158], [0, 168], [32, 158], [14, 32], [0, 28]],
  ],
  KURTA: [
    [
      [-22, 0], [-20, 28], [-26, 38], [-24, 148], [-8, 152], [-8, 132],
      [8, 132], [8, 152], [24, 148], [26, 38], [20, 28], [22, 0], [0, 12],
    ],
  ],
  DUPATTA: [
    [[-8, 0], [-18, 60], [-22, 110], [-26, 162], [-14, 170], [-4, 160], [-2, 110], [-4, 55], [-2, 6]],
    [[6, 4], [16, 65], [14, 115], [18, 155], [28, 162], [34, 148], [30, 100], [32, 55], [24, 0]],
  ],
  CHURIDAR: [
    [
      [-20, 0], [20, 0], [22, 55], [14, 108], [10, 138], [8, 148], [2, 72],
      [-2, 138], [-8, 148], [-14, 108], [-22, 55],
    ],
  ],
  SAREE: [
    [[-24, 0], [-28, 150], [-4, 162], [8, 150], [6, 0], [0, 10]],
    [[6, 2], [22, 20], [38, 55], [42, 100], [44, 130], [36, 155], [28, 158], [10, 80], [8, 40]],
  ],
  SOCK: [
    [[-8, 0], [8, 0], [10, 40], [12, 88], [8, 102], [0, 108], [-6, 102], [-10, 88], [-10, 40]],
  ],
};

const geoCache = new Map();

export function buildExtrudedGarmentGeometry(typeKey) {
  if (geoCache.has(typeKey)) return geoCache.get(typeKey).clone();
  const parts = SILHOUETTES[typeKey];
  if (!parts) return null;
  const geos = parts.map((pts) => extrudePoints(pts));
  const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos);
  geoCache.set(typeKey, merged);
  return merged.clone();
}

export { DEPTH as GARMENT_EXTRUDE_DEPTH };
