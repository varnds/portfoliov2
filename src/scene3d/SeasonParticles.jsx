import React, { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  LANTERN_WORLD,
  makeFireflyTexture,
  makeMoteTexture,
  makeStarTexture,
  seededRng,
} from "./particleUtils";
import { terrainHeight } from "./coords";

// ─── Night: star dome ───────────────────────────────────────────────────────

function StarField({ lanternOn, count = 380 }) {
  const ref = useRef();
  const tex = useMemo(() => makeStarTexture(), []);
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const u = seededRng(i + 1);
      const v = seededRng(i + 2);
      const theta = u * Math.PI * 2;
      // Upper hemisphere only — visible sky dome
      const phi = Math.acos(1 - v * 0.55);
      const r = 95 + seededRng(i + 3) * 12;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3] = x;
      positions[i * 3 + 1] = Math.max(y, 18);
      positions[i * 3 + 2] = z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count]);

  const baseOpacity = lanternOn ? 0.65 : 0.95;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.material.opacity =
      baseOpacity + Math.sin(clock.elapsedTime * 0.35) * 0.04;
  });

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false} renderOrder={10}>
      <pointsMaterial
        map={tex}
        color="#F8FBFF"
        size={0.9}
        sizeAttenuation={false}
        transparent
        opacity={baseOpacity}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
        fog={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ─── Night: rare shooting star ──────────────────────────────────────────────

function ShootingStar() {
  const ref = useRef();
  const [visible, setVisible] = useState(false);
  const streak = useRef({ t: 0, origin: new THREE.Vector3(), dir: new THREE.Vector3() });
  const nextAt = useRef(performance.now() + 12000 + Math.random() * 25000);

  useFrame(() => {
    const now = performance.now();
    const s = streak.current;
    if (!visible) {
      if (now >= nextAt.current) {
        const ox = (Math.random() - 0.5) * 80;
        const oy = 22 + Math.random() * 28;
        const oz = -40 - Math.random() * 30;
        s.origin.set(ox, oy, oz);
        s.dir.set(18 + Math.random() * 12, -8 - Math.random() * 6, 6 + Math.random() * 8);
        s.t = 0;
        setVisible(true);
      }
      return;
    }
    s.t += 0.022;
    if (!ref.current) return;
    ref.current.position.copy(s.origin).addScaledVector(s.dir, s.t);
    ref.current.material.opacity = Math.sin(Math.min(1, s.t) * Math.PI) * 0.95;
    if (s.t >= 1.05) {
      setVisible(false);
      nextAt.current = now + 18000 + Math.random() * 42000;
    }
  });

  return (
    <mesh ref={ref} visible={visible} rotation={[0, 0.4, -0.55]}>
      <planeGeometry args={[2.8, 0.06]} />
      <meshBasicMaterial
        color="#FFFFFF"
        transparent
        opacity={0}
        toneMapped={false}
        fog={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ─── Night: ground fireflies (two layers: slow drifters + pulsing bright) ───

function GroundFirefliesFixed({ lanternOn }) {
  const slowRef = useRef();
  const brightRef = useRef();
  const tex = useMemo(() => makeFireflyTexture(), []);

  const { slowGeo, brightGeo, slowFlies, brightFlies } = useMemo(() => {
    const mk = (n, offset, bright) =>
      Array.from({ length: n }, (_, i) => {
        const x = (seededRng(i + offset) - 0.5) * 52;
        const z = -4 + seededRng(i + offset + 11) * 22;
        const y = terrainHeight(x, z) + 0.35 + seededRng(i + offset + 22) * 1.8;
        return {
          x,
          y,
          z,
          phase: seededRng(i + offset + 33) * Math.PI * 2,
          orbit: 0.25 + seededRng(i + offset + 44) * (bright ? 0.35 : 0.55),
          speed: 0.2 + seededRng(i + offset + 55) * (bright ? 0.9 : 0.55),
          pulse: 1.2 + seededRng(i + offset + 66) * 2.2,
        };
      });

    const slowFlies = mk(92, 0, false);
    const brightFlies = mk(32, 500, true);
    const toGeo = (flies) => {
      const pos = new Float32Array(flies.length * 3);
      flies.forEach((f, i) => {
        pos[i * 3] = f.x;
        pos[i * 3 + 1] = f.y;
        pos[i * 3 + 2] = f.z;
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      return geo;
    };
    return {
      slowFlies,
      brightFlies,
      slowGeo: toGeo(slowFlies),
      brightGeo: toGeo(brightFlies),
    };
  }, []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const d = Math.min(dt, 0.05);
    const animate = (geo, flies, sizeBase) => {
      const arr = geo.attributes.position.array;
      for (let i = 0; i < flies.length; i += 1) {
        const f = flies[i];
        let x = f.x + Math.sin(t * f.speed + f.phase) * f.orbit;
        let z = f.z + Math.cos(t * f.speed * 0.85 + f.phase * 1.3) * f.orbit * 0.7;
        let y = f.y + Math.sin(t * f.speed * 1.1 + f.phase) * 0.15;
        if (lanternOn) {
          const dx = LANTERN_WORLD.x - x;
          const dz = LANTERN_WORLD.z - z;
          const dist = Math.hypot(dx, dz);
          if (dist < 10 && dist > 0.01) {
            x += (dx / dist) * d * 0.35;
            z += (dz / dist) * d * 0.35;
          }
        }
        arr[i * 3] = x;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = z;
      }
      geo.attributes.position.needsUpdate = true;
    };
    animate(slowGeo, slowFlies, 0.24);
    animate(brightGeo, brightFlies, 0.38);
    const pulse = 0.65 + 0.35 * Math.sin(t * 2.1);
    if (brightRef.current) {
      brightRef.current.material.opacity = (lanternOn ? 0.95 : 0.82) * pulse;
      brightRef.current.material.size = 0.42 + pulse * 0.12;
    }
    if (slowRef.current) {
      slowRef.current.material.opacity = lanternOn ? 0.7 : 0.55;
      slowRef.current.material.color.set(lanternOn ? "#FFE090" : "#FFE8A0");
    }
  });

  const matProps = {
    map: tex,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    fog: true,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  };

  return (
    <>
      <points ref={slowRef} geometry={slowGeo} frustumCulled={false}>
        <pointsMaterial {...matProps} color="#FFE8A0" size={0.26} opacity={0.58} />
      </points>
      <points ref={brightRef} geometry={brightGeo} frustumCulled={false}>
        <pointsMaterial {...matProps} color="#FFF0B0" size={0.44} opacity={0.85} />
      </points>
    </>
  );
}

// ─── Spring: tiny motes rising from the ground ─────────────────────────────

function SpringPollen() {
  const ref = useRef();
  const tex = useMemo(() => makeMoteTexture(), []);
  const count = 48;

  const { geometry, motes } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const motes = [];
    for (let i = 0; i < count; i += 1) {
      const x = (seededRng(i + 5000) - 0.5) * 34;
      const z = -2 + seededRng(i + 5001) * 12;
      const baseY = terrainHeight(x, z) + 0.04;
      pos[i * 3] = x;
      pos[i * 3 + 1] = baseY + seededRng(i + 5002) * 1.5;
      pos[i * 3 + 2] = z;
      motes.push({
        x,
        z,
        baseY,
        speed: 0.28 + seededRng(i + 5003) * 0.38,
        wobble: seededRng(i + 5004) * Math.PI * 2,
        maxRise: 1.4 + seededRng(i + 5005) * 2.2,
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { geometry: geo, motes };
  }, []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const d = Math.min(dt, 0.05);
    const arr = geometry.attributes.position.array;
    for (let i = 0; i < motes.length; i += 1) {
      const m = motes[i];
      let y = arr[i * 3 + 1];
      y += m.speed * d;
      const top = m.baseY + m.maxRise;
      if (y > top) y = m.baseY;
      arr[i * 3] = m.x + Math.sin(t * 0.7 + m.wobble) * 0.06;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = m.z + Math.cos(t * 0.55 + m.wobble) * 0.05;
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false} renderOrder={2}>
      <pointsMaterial
        map={tex}
        color="#FFEAB8"
        size={0.1}
        sizeAttenuation
        transparent
        opacity={0.42}
        depthWrite={false}
        toneMapped={false}
        fog
      />
    </points>
  );
}

// ─── Summer: ground dust ────────────────────────────────────────────────────

function SummerDust({ windStrength = 0.5 }) {
  const ref = useRef();
  const tex = useMemo(() => makeMoteTexture(), []);

  const { geometry, motes } = useMemo(() => {
    const n = 55;
    const pos = new Float32Array(n * 3);
    const motes = [];
    for (let i = 0; i < n; i += 1) {
      const x = (seededRng(i + 4000) - 0.5) * 40;
      const z = -3 + seededRng(i + 4001) * 16;
      pos[i * 3] = x;
      pos[i * 3 + 1] = terrainHeight(x, z) + 0.2 + seededRng(i + 4002) * 1.2;
      pos[i * 3 + 2] = z;
      motes.push({ phase: seededRng(i + 4003) * Math.PI * 2, drift: 0.05 + seededRng(i + 4004) * 0.12 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { geometry: geo, motes };
  }, []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const d = Math.min(dt, 0.05);
    const arr = geometry.attributes.position.array;
    const wind = (0.12 + windStrength * 0.25) * d;
    for (let i = 0; i < motes.length; i += 1) {
      const m = motes[i];
      arr[i * 3] += wind + Math.sin(t * 0.3 + m.phase) * d * 0.06;
      arr[i * 3 + 1] += Math.sin(t * 0.25 + m.phase) * d * 0.04;
      if (arr[i * 3] > 24) arr[i * 3] = -24;
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        map={tex}
        color="#E8D4A8"
        size={0.2}
        sizeAttenuation
        transparent
        opacity={0.35}
        depthWrite={false}
        toneMapped={false}
        fog
      />
    </points>
  );
}

/** Subtle heat shimmer above distant hills — effect only, no scenery change. */
function HeatShimmer() {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.material.opacity = 0.035 + Math.sin(t * 1.8) * 0.012;
    ref.current.scale.x = 1 + Math.sin(t * 2.3) * 0.018;
    ref.current.position.y = 2.8 + Math.sin(t * 1.1) * 0.08;
  });

  return (
    <mesh ref={ref} position={[0, 2.8, -22]} rotation={[-Math.PI / 2.2, 0, 0]}>
      <planeGeometry args={[90, 40, 1, 1]} />
      <meshBasicMaterial
        color="#FFE8C0"
        transparent
        opacity={0.04}
        depthWrite={false}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export function SeasonAtmosphere({
  seasonKey,
  isNight,
  lanternOn,
  windStrength = 0.5,
}) {
  return (
    <>
      {isNight && (
        <>
          <StarField lanternOn={lanternOn} />
          <ShootingStar />
          <GroundFirefliesFixed lanternOn={lanternOn} />
        </>
      )}
      {seasonKey === "spring" && !isNight && <SpringPollen />}
      {seasonKey === "summer" && !isNight && (
        <>
          <SummerDust windStrength={windStrength} />
          <HeatShimmer />
        </>
      )}
    </>
  );
}
