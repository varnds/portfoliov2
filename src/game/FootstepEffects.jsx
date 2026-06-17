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

const PUFF_POOL = 72;
const PRINT_POOL = 16;
const STEP_DIST = 0.62; // world units between footfalls
const SIDE = 0.14;      // L/R foot offset from the centre line

// Per-season character. `colors` is sampled per particle so leaves/petals vary.
const FX = {
  summer: {
    colors: ["#E9CBA2", "#DCB588", "#EFD8B0"], n: 7, up: 0.7, out: 0.8, grav: -1.5,
    life: 0.75, size: 0.42, grow: 1.0, drift: 0.2,
    print: "#9C7C4E", pAlpha: 0.32, pLife: 5, pSize: [0.22, 0.34],
  },
  winter: {
    colors: ["#FFFFFF", "#EAF3FF", "#DCEAF8"], n: 9, up: 0.6, out: 0.6, grav: -1.1,
    life: 0.95, size: 0.4, grow: 1.15, drift: 0.18,
    print: "#C7D6EA", pAlpha: 0.5, pLife: 8, pSize: [0.2, 0.33],
  },
  spring: {
    colors: ["#A6C487", "#8FB46E", "#F4B6C2", "#9FBF7F"], n: 5, up: 0.85, out: 0.55, grav: -1.7,
    life: 0.6, size: 0.32, grow: 0.85, drift: 0.32,
    print: "#7C9A60", pAlpha: 0.24, pLife: 4, pSize: [0.18, 0.3],
  },
  autumn: {
    colors: ["#C8803F", "#B5532A", "#D9A441", "#9C5A2E"], n: 6, up: 0.9, out: 0.75, grav: -1.2,
    life: 0.85, size: 0.4, grow: 1.2, drift: 0.5,
    print: "#8E5E34", pAlpha: 0.3, pLife: 4.5, pSize: [0.2, 0.32],
  },
  night: {
    colors: ["#9AA6C4", "#7E8AAA", "#AEB8D2"], n: 4, up: 0.55, out: 0.5, grav: -1.0,
    life: 0.95, size: 0.34, grow: 1.0, drift: 0.22,
    print: "#444C66", pAlpha: 0.22, pLife: 4, pSize: [0.18, 0.28],
  },
};

export function FootstepEffects({ seasonKey }) {
  const pool = useMemo(() => {
    const puffTex = makeRadialTexture(1, 0.55, 0);
    const printTex = makeRadialTexture(1, 0.7, 0);

    const puffGroup = new THREE.Group();
    const puffs = [];
    for (let i = 0; i < PUFF_POOL; i += 1) {
      const mat = new THREE.SpriteMaterial({
        map: puffTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: true,
      });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      puffGroup.add(sp);
      puffs.push({ sp, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, base: 0.4 });
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

    return { puffTex, printTex, printGeo, puffGroup, puffs, printGroup, prints };
  }, []);

  useEffect(
    () => () => {
      pool.puffTex.dispose();
      pool.printTex.dispose();
      pool.printGeo.dispose();
      pool.puffs.forEach((p) => p.sp.material.dispose());
      pool.prints.forEach((p) => p.m.material.dispose());
    },
    [pool],
  );

  const prev = useRef(null);
  const accum = useRef(0);
  const side = useRef(1);
  const puffCursor = useRef(0);
  const printCursor = useRef(0);
  const wasAir = useRef(false);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const fx = FX[seasonKey] || FX.summer;
    const { puffs, prints } = pool;

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
      const k = p.life / p.maxLife; // 1 → 0
      p.sp.material.opacity = Math.min(1, k * 1.6) * 0.85;
      const s = p.base * (1 + (1 - k) * fx.grow);
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
      emitPuff(fx, avatarPos.x, avatarPos.z, groundY, 0, 0, 2.4, 1.5);
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
      emitPuff(fx, avatarPos.x + ox, avatarPos.z + oz, groundY, dirX, dirZ, 1 + fast * 0.6, 1);
      emitPrint(fx, avatarPos.x + ox, avatarPos.z + oz, groundY, dirX, dirZ);
    }
  });

  function emitPuff(fx, x, z, groundY, dirX, dirZ, mult, lifeMult) {
    const count = Math.max(2, Math.round(fx.n * mult));
    for (let i = 0; i < count; i += 1) {
      const p = pool.puffs[puffCursor.current];
      puffCursor.current = (puffCursor.current + 1) % pool.puffs.length;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * fx.out;
      p.sp.position.set(
        x + Math.cos(a) * r * 0.4,
        groundY + 0.06 + Math.random() * 0.08,
        z + Math.sin(a) * r * 0.4,
      );
      // kicked up + outward, biased backward against travel
      p.vx = Math.cos(a) * r + (-dirX) * fx.drift * mult + (Math.random() - 0.5) * fx.drift;
      p.vz = Math.sin(a) * r + (-dirZ) * fx.drift * mult + (Math.random() - 0.5) * fx.drift;
      p.vy = fx.up * (0.6 + Math.random() * 0.8) * mult;
      p.maxLife = fx.life * lifeMult * (0.8 + Math.random() * 0.5);
      p.life = p.maxLife;
      p.base = fx.size * (0.7 + Math.random() * 0.7);
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

  return (
    <>
      <primitive object={pool.printGroup} />
      <primitive object={pool.puffGroup} />
    </>
  );
}
