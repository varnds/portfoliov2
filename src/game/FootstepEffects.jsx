/**
 * FootstepEffects — the ground reacts to the avatar's footsteps, themed by season.
 *
 * Two layers:
 *  • Puffs   — pooled billboard sprites kicked up at the feet on each footfall
 *              (sand in summer, snow in winter, grass/petals in spring, leaves in
 *              autumn, pale dust at night). Bigger burst on jump-landings.
 *  • Prints  — a ring buffer of flat soft decals pressed into the ground behind
 *              the avatar, fading out over a few seconds.
 *
 * Step cadence is distance-based (a step every STEP_DIST of travel) so it stays
 * in sync with walk vs run automatically. Reads avatarPos / avatarActive from the
 * game store; no plumbing into the Avatar itself.
 */
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { avatarPos, avatarActive } from "./gameStore";
import { terrainHeight } from "../scene3d/coords";
import { makeRadialTexture } from "../scene3d/particleUtils";

// Crisp little grain: a small dot with a hard-ish core and a thin feather, so a
// footfall throws distinct specks rather than a soft cloud.
function makeGrainTexture() {
  const s = 32;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d");
  // Hard core with only a 1px feather — a solid speck, not a glowing bubble.
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.72, "rgba(255,255,255,1)");
  g.addColorStop(0.92, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Small leaf silhouette (almond shape + midrib) for autumn — tinted per particle
// and tumbled as it falls.
function makeLeafTexture() {
  const s = 40;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d");
  ctx.translate(s / 2, s / 2);
  const h = s * 0.42;
  const w = s * 0.3;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.quadraticCurveTo(w, 0, 0, h);
  ctx.quadraticCurveTo(-w, 0, 0, -h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.22)"; // midrib reads as a darker vein after tint
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.82);
  ctx.lineTo(0, h * 0.82);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Small 5-petal flower for spring — tinted per particle and tumbled as it drifts.
function makeFlowerTexture() {
  const s = 40;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d");
  ctx.translate(s / 2, s / 2);
  ctx.fillStyle = "#ffffff";
  const petalR = s * 0.18;
  const petalDist = s * 0.18;
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * petalDist, Math.sin(a) * petalDist, petalR, petalR * 0.6, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(70,45,20,0.3)"; // darker heart so the bloom reads after tint
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.1, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const PUFF_POOL = 200;
const PRINT_POOL = 16;
const SCUFF_POOL = 28;
const STEP_DIST = 0.62; // world units between footfalls
const SIDE = 0.14;      // L/R foot offset from the centre line

// Per-season character. A footfall does three things:
//  • scuff  — a flat dust disc that blooms outward ON THE GROUND and fades (so the
//             disturbance reads as the ground, not the feet),
//  • grains — a FEW tiny specks that skim off the ground surface,
//  • print  — a fading footprint.
// `soft` picks the round snow-flake texture for grains; others use a crisp grain.
const FX = {
  summer: {
    colors: ["#B58438", "#9E6C28", "#C8A05A", "#8A5C22"], n: 48, up: 0.22, out: 1.3, grav: -4.2,
    life: 0.45, size: 0.012, drift: 0.3, soft: false,
    scuff: { color: "#E0C79C", r: 0.62, life: 0.55, alpha: 0.46 },
    print: "#8A6A3E", pAlpha: 0.32, pLife: 5, pSize: [0.22, 0.34],
  },
  winter: {
    colors: ["#FFFFFF", "#EAF3FF", "#DCEAF8"], n: 6, up: 0.4, out: 0.9, grav: -1.6,
    life: 0.9, size: 0.1, drift: 0.32, soft: true,
    scuff: { color: "#FFFFFF", r: 0.66, life: 0.7, alpha: 0.5 },
    print: "#C7D6EA", pAlpha: 0.5, pLife: 8, pSize: [0.2, 0.33],
  },
  spring: {
    // little flowers that puff out and tumble down
    colors: ["#F4B6C2", "#FFF1F4", "#FFE08A", "#E5C2F0", "#F6A6A0"], n: 7, up: 0.6, out: 1.0, grav: -1.8,
    life: 1.0, size: 0.11, drift: 0.4, soft: false, flower: true, sway: 0.8,
    scuff: { color: "#B7CE9C", r: 0.48, life: 0.45, alpha: 0.26 },
    print: "#7C9A60", pAlpha: 0.24, pLife: 4, pSize: [0.18, 0.3],
  },
  autumn: {
    // actual little leaves that flutter and tumble down
    colors: ["#C8803F", "#B5532A", "#D9A441", "#9C5A2E", "#A8702E"], n: 2, up: 0.7, out: 1.0, grav: -1.4,
    life: 1.3, size: 0.22, drift: 0.5, soft: false, leaf: true, sway: 0.9,
    scuff: { color: "#CE9456", r: 0.52, life: 0.5, alpha: 0.3 },
    print: "#8E5E34", pAlpha: 0.3, pLife: 4.5, pSize: [0.2, 0.32],
  },
  night: {
    colors: ["#9AA6C4", "#7E8AAA", "#AEB8D2"], n: 10, up: 0.4, out: 0.9, grav: -2.0,
    life: 0.8, size: 0.03, drift: 0.28, soft: true,
    scuff: { color: "#8A93AE", r: 0.46, life: 0.5, alpha: 0.22 },
    print: "#444C66", pAlpha: 0.22, pLife: 4, pSize: [0.18, 0.28],
  },
};

export function FootstepEffects({ seasonKey }) {
  const pool = useMemo(() => {
    // crisp grain (tight core, little feather) for sand/dirt/leaves; soft round
    // flake for snow & night dust.
    const grainTex = makeGrainTexture();
    const flakeTex = makeRadialTexture(1, 0.6, 0);
    const leafTex = makeLeafTexture();
    const flowerTex = makeFlowerTexture();
    const printTex = makeRadialTexture(1, 0.7, 0);
    const scuffTex = makeRadialTexture(0.8, 0.32, 0); // soft hollow-ish dust ring

    const puffGroup = new THREE.Group();
    const puffs = [];
    for (let i = 0; i < PUFF_POOL; i += 1) {
      const mat = new THREE.SpriteMaterial({
        map: grainTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false, // render the authored grain colour (tone mapping washed tans to cream)
      });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      puffGroup.add(sp);
      puffs.push({ sp, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, base: 0.4, leaf: false, phase: 0, spin: 0, rot0: 0, sway: 0, groundY: 0 });
    }

    const printGroup = new THREE.Group();
    const prints = [];
    const printGeo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < PRINT_POOL; i += 1) {
      const mat = new THREE.MeshBasicMaterial({
        map: printTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: true,
      });
      const m = new THREE.Mesh(printGeo, mat);
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      printGroup.add(m);
      prints.push({ m, life: 0, maxLife: 1, alpha0: 0.3 });
    }

    // Ground scuff: a flat dust disc that blooms outward on the ground surface so
    // the disturbance reads as the GROUND reacting, not the avatar's feet.
    const scuffGroup = new THREE.Group();
    const scuffs = [];
    for (let i = 0; i < SCUFF_POOL; i += 1) {
      const mat = new THREE.MeshBasicMaterial({
        map: scuffTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      });
      const m = new THREE.Mesh(printGeo, mat);
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scuffGroup.add(m);
      scuffs.push({ m, life: 0, maxLife: 1, alpha0: 0.3, r0: 0.1, r1: 0.5 });
    }

    return {
      grainTex, flakeTex, leafTex, flowerTex, printTex, scuffTex, printGeo,
      puffGroup, puffs, printGroup, prints, scuffGroup, scuffs,
    };
  }, []);

  useEffect(
    () => () => {
      pool.grainTex.dispose();
      pool.flakeTex.dispose();
      pool.leafTex.dispose();
      pool.flowerTex.dispose();
      pool.printTex.dispose();
      pool.scuffTex.dispose();
      pool.printGeo.dispose();
      pool.puffs.forEach((p) => p.sp.material.dispose());
      pool.prints.forEach((p) => p.m.material.dispose());
      pool.scuffs.forEach((p) => p.m.material.dispose());
    },
    [pool],
  );

  const prev = useRef(null);
  const accum = useRef(0);
  const side = useRef(1);
  const puffCursor = useRef(0);
  const printCursor = useRef(0);
  const scuffCursor = useRef(0);
  const wasAir = useRef(false);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const fx = FX[seasonKey] || FX.summer;
    const { puffs, prints, scuffs } = pool;

    // ── advance live puffs ───────────────────────────────────────────────────
    for (let i = 0; i < puffs.length; i += 1) {
      const p = puffs[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.sp.visible = false;
        continue;
      }
      p.vy += fx.grav * dt;
      p.sp.position.x += p.vx * dt;
      p.sp.position.y += p.vy * dt;
      p.sp.position.z += p.vz * dt;
      if (p.leaf) {
        // flutter sideways + tumble (spin the sprite) as the leaf drifts down
        const age = p.maxLife - p.life;
        p.sp.position.x += Math.sin(age * 7 + p.phase) * p.sway * dt;
        p.sp.position.z += Math.cos(age * 6 + p.phase * 1.3) * p.sway * dt;
        p.sp.material.rotation = p.rot0 + p.spin * age;
        if (p.sp.position.y < p.groundY + 0.04) p.sp.position.y = p.groundY + 0.04; // settle on the ground
      }
      const k = p.life / p.maxLife; // 1 → 0
      p.sp.material.opacity = Math.min(1, k * 2.2) * 0.82; // crisp specks, not a solid pale mass
      const s = p.base * (p.leaf ? 0.85 + 0.15 * k : 0.65 + 0.35 * k); // leaves hold size
      p.sp.scale.set(s, s, s);
    }

    // ── advance / fade prints ────────────────────────────────────────────────
    for (let i = 0; i < prints.length; i += 1) {
      const pr = prints[i];
      if (pr.life <= 0) continue;
      pr.life -= dt;
      if (pr.life <= 0) {
        pr.m.visible = false;
        continue;
      }
      const k = pr.life / pr.maxLife;
      // quick fade-in, long fade-out
      pr.m.material.opacity = pr.alpha0 * Math.min(1, k * 6) * (0.4 + 0.6 * k);
    }

    // ── advance scuff discs: bloom outward + fade ────────────────────────────
    for (let i = 0; i < scuffs.length; i += 1) {
      const s = scuffs[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.m.visible = false;
        continue;
      }
      const k = s.life / s.maxLife; // 1 → 0
      const rad = s.r0 + (s.r1 - s.r0) * (1 - k); // expand as it ages
      s.m.scale.set(rad, rad, 1);
      s.m.material.opacity = s.alpha0 * Math.min(1, k * 5) * k; // quick in, fade as it spreads
    }

    if (!avatarActive) {
      prev.current = null;
      return;
    }

    // ── derive motion from avatar position ───────────────────────────────────
    if (!prev.current) {
      prev.current = avatarPos.clone();
      return;
    }
    const dx = avatarPos.x - prev.current.x;
    const dz = avatarPos.z - prev.current.z;
    prev.current.copy(avatarPos);
    const horiz = Math.hypot(dx, dz);
    const speed = horiz / dt;
    const groundY = terrainHeight(avatarPos.x, avatarPos.z);

    // jump / fall landing → one big burst
    const air = avatarPos.y > groundY + 0.2;
    if (wasAir.current && !air) {
      emitPuff(fx, avatarPos.x, avatarPos.z, groundY, 0, 0, 2.2, 1.5);
      emitScuff(fx, avatarPos.x, avatarPos.z, groundY, 1.8);
    }
    wasAir.current = air;

    if (horiz < 1e-4) return;
    const dirX = dx / horiz;
    const dirZ = dz / horiz;

    // distance-based footfall cadence (auto-syncs walk vs run)
    accum.current += horiz;
    if (accum.current >= STEP_DIST && speed > 0.4) {
      accum.current = 0;
      side.current *= -1;
      // perpendicular L/R offset for the foot
      const ox = -dirZ * SIDE * side.current;
      const oz = dirX * SIDE * side.current;
      const fast = THREE.MathUtils.clamp(speed / 6, 0, 1);
      emitScuff(fx, avatarPos.x + ox, avatarPos.z + oz, groundY, 1 + fast * 0.4);
      emitPuff(fx, avatarPos.x + ox, avatarPos.z + oz, groundY, dirX, dirZ, 1 + fast * 0.6, 1);
      emitPrint(fx, avatarPos.x + ox, avatarPos.z + oz, groundY, dirX, dirZ);
    }
  });

  function emitPuff(fx, x, z, groundY, dirX, dirZ, mult, lifeMult) {
    const count = Math.max(3, Math.round(fx.n * mult));
    const tex = fx.flower
      ? pool.flowerTex
      : fx.leaf
        ? pool.leafTex
        : fx.soft
          ? pool.flakeTex
          : pool.grainTex;
    for (let i = 0; i < count; i += 1) {
      const p = pool.puffs[puffCursor.current];
      puffCursor.current = (puffCursor.current + 1) % pool.puffs.length;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * fx.out;
      p.sp.position.set(
        x + Math.cos(a) * r * 0.4,
        groundY + 0.02 + Math.random() * 0.04, // skim off the ground surface
        z + Math.sin(a) * r * 0.4,
      );
      // kicked up + outward, biased backward against travel
      p.vx = Math.cos(a) * r + (-dirX) * fx.drift * mult + (Math.random() - 0.5) * fx.drift;
      p.vz = Math.sin(a) * r + (-dirZ) * fx.drift * mult + (Math.random() - 0.5) * fx.drift;
      p.vy = fx.up * (0.6 + Math.random() * 0.8) * mult;
      p.maxLife = fx.life * lifeMult * (0.8 + Math.random() * 0.5);
      p.life = p.maxLife;
      p.base = fx.size * (0.6 + Math.random() * 0.9); // varied grain/leaf sizes
      p.groundY = groundY;
      p.leaf = !!(fx.leaf || fx.flower); // tumble/flutter applies to leaves AND flowers
      if (p.leaf) {
        p.phase = Math.random() * Math.PI * 2;
        p.spin = (Math.random() - 0.5) * 5; // tumble speed/direction
        p.rot0 = Math.random() * Math.PI * 2;
        p.sway = fx.sway || 0.6;
        p.sp.material.rotation = p.rot0;
      } else {
        p.sp.material.rotation = 0;
      }
      if (p.sp.material.map !== tex) {
        p.sp.material.map = tex;
        p.sp.material.needsUpdate = true;
      }
      p.sp.material.color.set(fx.colors[(Math.random() * fx.colors.length) | 0]);
      p.sp.material.opacity = 0;
      p.sp.scale.setScalar(p.base);
      p.sp.visible = true;
    }
  }

  function emitPrint(fx, x, z, groundY, dirX, dirZ) {
    const pr = pool.prints[printCursor.current];
    printCursor.current = (printCursor.current + 1) % pool.prints.length;
    pr.m.position.set(x, groundY + 0.025, z);
    // orient the oval along the walking direction
    pr.m.rotation.set(-Math.PI / 2, 0, Math.atan2(dirX, dirZ));
    const [w, h] = fx.pSize;
    pr.m.scale.set(w * (0.9 + Math.random() * 0.2), h * (0.9 + Math.random() * 0.2), 1);
    pr.m.material.color.set(fx.print);
    pr.alpha0 = fx.pAlpha;
    pr.maxLife = fx.pLife;
    pr.life = pr.maxLife;
    pr.m.material.opacity = 0;
    pr.m.visible = true;
  }

  function emitScuff(fx, x, z, groundY, mult) {
    const sc = pool.scuffs[scuffCursor.current];
    scuffCursor.current = (scuffCursor.current + 1) % pool.scuffs.length;
    sc.m.position.set(x, groundY + 0.018, z);
    sc.m.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI);
    sc.r0 = fx.scuff.r * 0.28 * mult;
    sc.r1 = fx.scuff.r * mult;
    sc.alpha0 = fx.scuff.alpha;
    sc.maxLife = fx.scuff.life;
    sc.life = sc.maxLife;
    sc.m.material.color.set(fx.scuff.color);
    sc.m.scale.set(sc.r0, sc.r0, 1);
    sc.m.material.opacity = 0;
    sc.m.visible = true;
  }

  return (
    <>
      <primitive object={pool.scuffGroup} />
      <primitive object={pool.printGroup} />
      <primitive object={pool.puffGroup} />
    </>
  );
}
