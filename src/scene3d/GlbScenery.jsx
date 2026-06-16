/**
 * GlbScenery.jsx — GLB asset loader + heuristic extraction.
 *
 * mode:
 *   "full"      — the whole model
 *   "trees"     — only green-foliage + brown-trunk meshes
 *   "mountains" — everything EXCEPT trees, the flat ground plane, and water
 *                 (i.e. the rocky peaks + snow), for use as a distant backdrop
 *   "canyons"   — only the large canyon/rock terrain mesh, dropping the rover
 *                 (mars_rover.glb): the vehicle is a cluster of dozens of small
 *                 meshes under "Car"/"Wheel" nodes, while the canyon is the one
 *                 big mesh. We keep only the largest-spanning mesh(es).
 *
 * Since this GLB's objects aren't named/grouped, we separate by material colour
 * + a couple of name hints. A named / per-asset GLB makes this trivial instead.
 */

import React, { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { terrainHeight } from "./coords";

const URL = "/models/low_poly_landscape_practice.glb";

// Distant-mountain look: a cool blue-grey silhouette that ignores fog, so far
// peaks read as crisp atmospheric-perspective shapes instead of washing into a
// pale winter sky.
const MOUNTAIN_MAT = new THREE.MeshStandardMaterial({
  color: "#7C8DA8",
  flatShading: true,
  roughness: 1,
  metalness: 0,
  fog: false,
});

// Warm desert canyon look: terracotta/sandstone silhouette that ignores fog so
// the far rock walls read as crisp shapes against the summer sky, mirroring how
// MOUNTAIN_MAT recolours the winter peaks.
const CANYON_MAT = new THREE.MeshStandardMaterial({
  color: "#B5613A",
  flatShading: true,
  roughness: 1,
  metalness: 0,
  fog: false,
});

function isTreeColor(c) {
  if (!c) return false;
  const { r, g, b } = c;
  const green = g > r * 1.08 && g > b * 1.08;
  const brown = r > g && g >= b && r > 0.06 && r < 0.62 && b < r * 0.9;
  return green || brown;
}

// Classify a mesh into tree / ground / water / rock (mountains).
function meshKind(o) {
  const name = `${o.name} ${o.parent ? o.parent.name : ""}`.toLowerCase();
  if (/plane/.test(name)) return "ground"; // the flat base plane
  const col = o.material && o.material.color;
  if (isTreeColor(col)) return "tree";
  if (col && col.b > col.r * 1.12 && col.b > col.g) return "water";
  return "rock"; // grey peaks, snow, misc rock (often vertex-coloured)
}

export function GlbScenery({
  url = URL,
  position = [0, 0, 0],
  targetSize = 40,
  rotationY = 0,
  mode = "full",
  pick = null,
  tint = null,
  tintStrength = 0.82,
  tintReplace = false,
  yOffset = 0,
  hideNames = null,
}) {
  const { scene } = useGLTF(url);

  const model = useMemo(() => {
    const c = scene.clone(true);

    c.updateWorldMatrix(true, true);
    const tmpBox = new THREE.Box3();

    // Optional tint: recolor the fabric parts. These GLB materials get their
    // colour from a TEXTURE, so a colour multiply can't change the hue — we drop
    // the map and set the colour directly. Wood/pole parts are left natural.
    // tintStrength softens the result toward white (1 = full saturation).
    if (tint) {
      const tc = new THREE.Color(tint);
      const white = new THREE.Color(0xffffff);
      c.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const recolor = (mat) => {
          if (!tintReplace) {
            // Texture-preserving multiply — warm tints over the original texture.
            const m2 = mat.clone();
            if (m2.color) m2.color = m2.color.clone().lerp(tc, tintStrength);
            return m2;
          }
          // Replace: drop the texture + set a flat colour (needed to recolour to
          // a different hue, e.g. teal). Wood/pole parts stay natural.
          const name = (mat.name || "").toLowerCase();
          if (/wood|stick|pole|trunk|bark|metal/.test(name)) return mat;
          const m2 = mat.clone();
          m2.map = null;
          m2.color = white.clone().lerp(tc, 0.85); // clear, true colour
          return m2;
        };
        o.material = Array.isArray(o.material)
          ? o.material.map(recolor)
          : recolor(o.material);
      });
    }

    // Drop named meshes (e.g. a baked "Skybox" sphere or "BaseGround" plane that
    // would otherwise swallow the scene or clip our terrain). Applied first so it
    // composes with any mode below and the recenter ignores hidden meshes.
    if (hideNames) {
      const re = new RegExp(hideNames, "i");
      c.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const matNames = mats.map((m) => (m && m.name) || "").join(" ");
        const n = `${o.name} ${o.parent ? o.parent.name : ""} ${matNames}`;
        if (re.test(n)) o.visible = false;
      });
    }

    if (mode === "trees") {
      c.traverse((o) => {
        if (o.isMesh) o.visible = meshKind(o) === "tree";
      });
    } else if (mode === "mountains") {
      // Size-based: keep the tallest masses (the peaks), drop trees/rocks/ground.
      // Robust against colour misclassification of tan/grey rock.
      let maxH = 0;
      const heights = new Map();
      c.traverse((o) => {
        if (!o.isMesh) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const bb = tmpBox.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        const h = bb.max.y - bb.min.y;
        heights.set(o, h);
        if (h > maxH) maxH = h;
      });
      c.traverse((o) => {
        if (o.isMesh) {
          o.visible = (heights.get(o) || 0) > maxH * 0.4;
          if (o.visible) o.material = MOUNTAIN_MAT; // cool silhouette, no fog
        }
      });
    } else if (mode === "rock") {
      // Pick ONE named rock from the desert rocks/stones pack (e.g. "Big_rock_1")
      // and recolour it with CANYON_MAT so it matches the existing canyon palette.
      c.traverse((o) => {
        if (!o.isMesh) return;
        const name = `${o.name} ${o.parent ? o.parent.name : ""}`.toLowerCase();
        o.visible = pick ? name.includes(pick.toLowerCase()) : true;
        if (o.visible) o.material = CANYON_MAT;
      });
    } else if (mode === "canyons") {
      // Vehicle removal: mars_rover.glb is one big canyon mesh + dozens of tiny
      // rover meshes (wheels/body/mast). Keep only the largest-spanning mesh(es)
      // — the canyon dwarfs every rover part, so a fraction of the max diagonal
      // cleanly drops the whole vehicle cluster regardless of names.
      let maxSpan = 0;
      const spans = new Map();
      c.traverse((o) => {
        if (!o.isMesh) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const bb = tmpBox.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        const s = bb.getSize(new THREE.Vector3());
        const span = Math.max(s.x, s.y, s.z);
        spans.set(o, span);
        if (span > maxSpan) maxSpan = span;
      });
      c.traverse((o) => {
        if (o.isMesh) {
          o.visible = (spans.get(o) || 0) > maxSpan * 0.6;
          if (o.visible) o.material = CANYON_MAT; // warm sandstone, no fog
        }
      });
    }

    // Bounding box over VISIBLE meshes only, so we recenter on what's kept.
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    c.traverse((o) => {
      if (o.isMesh && o.visible) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        box.union(tmp);
      }
    });
    if (box.isEmpty()) return c;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    c.position.set(-center.x, -box.min.y, -center.z);

    const g = new THREE.Group();
    g.add(c);
    g.scale.setScalar(targetSize / Math.max(size.x, size.z, 0.001));
    return g;
  }, [scene, targetSize, mode, pick, tint, tintStrength, tintReplace, hideNames]);

  const [x, , z] = position;
  // yOffset lets callers sink a model into the terrain (negative) so big rocks
  // embed in the dunes instead of perching on a crest and reading as floating.
  const y = terrainHeight(x, z) + yOffset;
  return <primitive object={model} position={[x, y, z]} rotation={[0, rotationY, 0]} />;
}

useGLTF.preload(URL);
useGLTF.preload("/models/mars_rover.glb");
useGLTF.preload("/models/desert_rocks.glb");
