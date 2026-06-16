import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clotheslinePoint, svgToWorldOnTerrain, terrainHeight } from "./coords";
import { ROPE, WICKER, WOOD } from "./materials";

export function ClotheslinePost({ layout, palette, withChime = false, windStrength = 3, onChimeStrike }) {
  const { x, z, footY, height } = layout;

  return (
    <group position={[x, footY + height / 2, z]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.13, 0.15, height, 16]} />
        <meshStandardMaterial {...WOOD} flatShading />
      </mesh>
      <mesh position={[0, height / 2 + 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.1, 0.14, 16]} />
        <meshStandardMaterial {...WOOD} color="#8B6640" />
      </mesh>
      <mesh position={[0, height / 2 + 0.14, 0]} castShadow>
        <boxGeometry args={[0.56, 0.08, 0.1]} />
        <meshStandardMaterial {...WOOD} color="#7A5435" />
      </mesh>
      {withChime && (
        <WindChimeOnPost
          palette={palette}
          y={height / 2 + 0.12}
          windStrength={windStrength}
          onStrike={onChimeStrike}
        />
      )}
    </group>
  );
}

const CHIME_TUBES = [0.36, 0.46, 0.3, 0.4, 0.33];

function WindChimeOnPost({ palette, y, windStrength = 3, onStrike }) {
  const swing = useRef();
  const struck = useRef(0);

  useFrame(({ clock }, dt) => {
    if (!swing.current) return;
    const t = clock.elapsedTime;
    const wind = THREE.MathUtils.clamp(windStrength / 4, 0.25, 2);
    struck.current = Math.max(0, struck.current - Math.min(dt, 0.05) * 1.5);
    const amp = 0.045 * wind + struck.current * 0.6;
    const freq = 1.1 + wind * 0.5 + struck.current * 6;
    swing.current.rotation.z = Math.sin(t * freq) * amp;
    swing.current.rotation.x = Math.cos(t * (freq * 0.8) + 1) * amp * 0.5;
  });

  const ringR = 0.085;

  return (
    <group
      position={[0.18, y, 0.16]}
      onClick={(e) => {
        e.stopPropagation();
        struck.current = 1;
        onStrike?.();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.18, 6]} />
        <meshStandardMaterial color={palette.ink} roughness={0.9} />
      </mesh>
      <group ref={swing}>
        <mesh position={[0, 0.04, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 0.028, 20]} />
          <meshStandardMaterial color="#7A5435" roughness={0.85} />
        </mesh>
        {CHIME_TUBES.map((len, i) => {
          const a = (i / CHIME_TUBES.length) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * ringR, 0.02 - len / 2, Math.sin(a) * ringR]}
              castShadow
            >
              <cylinderGeometry args={[0.016, 0.016, len, 12]} />
              <meshStandardMaterial color="#E7C56B" metalness={0.9} roughness={0.25} />
            </mesh>
          );
        })}
        <mesh position={[0, -0.16, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.014, 18]} />
          <meshStandardMaterial color="#CBA24C" metalness={0.85} roughness={0.32} />
        </mesh>
        <mesh position={[0, -0.25, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.16, 6]} />
          <meshStandardMaterial color={palette.ink} roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.35, 0]} castShadow>
          <boxGeometry args={[0.13, 0.09, 0.012]} />
          <meshStandardMaterial color={palette.accent} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

export function Rope({ palette, L, R }) {
  const geometry = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 64; i += 1) {
      const [x, y, z] = clotheslinePoint(i / 64, L, R);
      points.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, 140, 0.02, 8, false);
  }, [L, R]);

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial {...ROPE} />
      </mesh>
      {[L, R].map((end, i) => (
        <mesh key={i} position={end} castShadow>
          <torusGeometry args={[0.045, 0.018, 8, 16]} />
          <meshStandardMaterial color={palette?.accent || "#B8754A"} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

export function WickerBasket({ palette, sx = 180 }) {
  const pos = useMemo(() => {
    const [x, , z] = svgToWorldOnTerrain(sx, 640, 1.6);
    return [x, terrainHeight(x, z), z];
  }, [sx]);

  return (
    <group position={pos}>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.52, 0.38, 0.34, 20, 1, true]} />
        <meshStandardMaterial {...WICKER} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} rotation={[0, (i / 8) * Math.PI, 0]} position={[0, 0.2, 0]}>
          <boxGeometry args={[0.02, 0.32, 0.52]} />
          <meshStandardMaterial {...WICKER} color="#C9AD84" />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.4, 0]} castShadow>
        <torusGeometry args={[0.5, 0.04, 10, 24]} />
        <meshStandardMaterial color="#B8956E" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.44, 0.04]} castShadow>
        <boxGeometry args={[0.38, 0.06, 0.28]} />
        <meshStandardMaterial
          color={palette.clothTint || palette.cloth}
          roughness={0.92}
        />
      </mesh>
      <mesh position={[0, 0.47, 0.06]} castShadow>
        <boxGeometry args={[0.34, 0.04, 0.24]} />
        <meshStandardMaterial color={palette.accent} roughness={0.85} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

/** Soft radial falloff for a gentle haze halo (no hard edge anywhere). */
function makeGlowTexture() {
  const s = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, "rgba(255,255,255,1)");
  g.addColorStop(0.22, "rgba(255,255,255,0.55)");
  g.addColorStop(0.5, "rgba(255,255,255,0.18)");
  g.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

/** A defined-but-soft-edged disc: the single moody sun circle. */
function makeDiscTexture() {
  const s = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, "rgba(255,255,255,1)");
  g.addColorStop(0.6, "rgba(255,255,255,1)");
  g.addColorStop(0.85, "rgba(255,255,255,0.82)");
  g.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

export function SkySun({ palette, position, show }) {
  const glow = useMemo(makeGlowTexture, []);
  const disc = useMemo(makeDiscTexture, []);
  if (!show) return null;
  return (
    <group position={position}>
      {/* Gentle moody haze around the sun. */}
      <sprite scale={[52, 52, 1]}>
        <spriteMaterial
          map={glow}
          color={palette.sun}
          transparent
          opacity={0.34}
          depthWrite={false}
          toneMapped={false}
          fog={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      {/* The single soft sun disc. */}
      <sprite scale={[12.8, 12.8, 1]}>
        <spriteMaterial
          map={disc}
          color={palette.sun}
          transparent
          opacity={0.62}
          depthWrite={false}
          toneMapped={false}
          fog={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  );
}

function FlapBird({ offset = [0, 0, 0], phase = 0, color = "#2A2018" }) {
  const left = useRef();
  const right = useRef();
  useFrame(({ clock }) => {
    const f = Math.sin(clock.elapsedTime * 7 + phase) * 0.6 + 0.15;
    if (left.current) left.current.rotation.z = f;
    if (right.current) right.current.rotation.z = -f;
  });
  return (
    <group position={offset}>
      <mesh>
        <boxGeometry args={[0.09, 0.05, 0.13]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <group ref={left} position={[-0.04, 0.02, 0]}>
        <mesh position={[-0.15, 0, 0]}>
          <boxGeometry args={[0.3, 0.012, 0.1]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
      </group>
      <group ref={right} position={[0.04, 0.02, 0]}>
        <mesh position={[0.15, 0, 0]}>
          <boxGeometry args={[0.3, 0.012, 0.1]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
      </group>
    </group>
  );
}

/** A small flock that glides across the sky and loops. */
export function FlyingBirds({ show }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const period = 24;
    const p = (t % period) / period;
    ref.current.position.x = -36 + p * 72;
    ref.current.position.y = 12.5 + Math.sin(t * 0.5) * 1.6;
    ref.current.position.z = -16 + Math.sin(t * 0.3) * 5;
    ref.current.rotation.y = Math.sin(t * 0.3) * 0.2;
  });
  if (!show) return null;
  return (
    <group ref={ref} scale={1.7}>
      <FlapBird offset={[0, 0, 0]} phase={0} />
      <FlapBird offset={[0.7, 0.16, 0.35]} phase={1.1} />
      <FlapBird offset={[-0.6, 0.1, 0.4]} phase={2.0} />
    </group>
  );
}

/** The signature orange bird — glides gently, but darts away zippy-fast with a
 * chirp when clicked or disturbed (hovered). */
export function OrangeBird({ show, onChirp }) {
  const ref = useRef();
  const leftWing = useRef();
  const rightWing = useRef();
  const phase = useRef(0);
  const dash = useRef(0);

  const startle = (e) => {
    if (e) e.stopPropagation();
    if (dash.current > 0) return;
    dash.current = 1.5;
    onChirp?.();
  };

  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    dash.current = Math.max(0, dash.current - dt);
    const zipping = dash.current > 0;
    const zip = zipping ? 8 : 1;
    phase.current += dt * 0.22 * zip;
    const angle = phase.current;
    const x = Math.sin(angle) * 13;
    const z = 1.5 + Math.cos(angle) * 4.5;
    const y = 6.2 + Math.sin(t * 0.7) * 0.9 + (zipping ? Math.sin(dash.current * 22) * 0.7 : 0);
    ref.current.position.set(x, y, z);
    // Face the direction of travel (tangent to the elliptical path) so the bird
    // noses forward instead of gliding sideways. The path velocity is the
    // derivative of (x, z) w.r.t. angle: (cos·13, -sin·4.5). Local forward is +X
    // (beak); a +X vector rotated by rotation.y=θ points to (cosθ, 0, -sinθ), so
    // matching it to the velocity gives θ = atan2(-vz, vx).
    const vx = Math.cos(angle) * 13;
    const vz = -Math.sin(angle) * 4.5;
    ref.current.rotation.y = Math.atan2(-vz, vx);
    // Gentle nose bob; banks a little harder when zipping away.
    ref.current.rotation.z = Math.sin(t * 0.7) * 0.12 + (zipping ? 0.4 : 0);
    const flap = Math.sin(t * (zipping ? 26 : 9)) * 0.7 + 0.2;
    if (leftWing.current) leftWing.current.rotation.z = flap;
    if (rightWing.current) rightWing.current.rotation.z = -flap;
  });

  if (!show) return null;

  return (
    <group
      ref={ref}
      scale={0.42}
      onClick={startle}
      onPointerOver={(e) => {
        startle(e);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      <mesh castShadow>
        <sphereGeometry args={[0.5, 16, 14]} />
        <meshStandardMaterial color="#EA580C" roughness={0.85} />
      </mesh>
      <mesh position={[0.16, -0.16, 0]} scale={[0.85, 0.8, 0.95]}>
        <sphereGeometry args={[0.42, 16, 14]} />
        <meshStandardMaterial color="#FCD9A8" roughness={0.9} />
      </mesh>
      <mesh position={[0.46, 0.28, 0]} castShadow>
        <sphereGeometry args={[0.3, 14, 12]} />
        <meshStandardMaterial color="#F97316" roughness={0.82} />
      </mesh>
      <mesh position={[0.74, 0.26, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.08, 0.22, 8]} />
        <meshStandardMaterial color="#FACC15" roughness={0.6} />
      </mesh>
      <mesh position={[0.56, 0.36, 0.14]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#1A1208" roughness={0.4} />
      </mesh>
      <mesh position={[0.56, 0.36, -0.14]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#1A1208" roughness={0.4} />
      </mesh>
      <mesh position={[-0.5, 0.05, 0]} rotation={[0, 0, 0.5]} castShadow>
        <coneGeometry args={[0.22, 0.7, 6]} />
        <meshStandardMaterial color="#C2410C" roughness={0.85} />
      </mesh>
      <group ref={leftWing} position={[0, 0.18, 0.12]}>
        <mesh position={[0, 0, 0.36]} rotation={[0.3, 0, 0]} castShadow>
          <boxGeometry args={[0.5, 0.05, 0.66]} />
          <meshStandardMaterial color="#D9480F" roughness={0.85} />
        </mesh>
      </group>
      <group ref={rightWing} position={[0, 0.18, -0.12]}>
        <mesh position={[0, 0, -0.36]} rotation={[-0.3, 0, 0]} castShadow>
          <boxGeometry args={[0.5, 0.05, 0.66]} />
          <meshStandardMaterial color="#D9480F" roughness={0.85} />
        </mesh>
      </group>
    </group>
  );
}

function Flower({ position, petal, green, center, phase, scale = 1 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = Math.sin(clock.elapsedTime * 1.6 + phase) * 0.09;
  });
  const petals = [0, 1, 2, 3, 4];
  return (
    <group position={position} scale={scale}>
      <group ref={ref}>
        <mesh position={[0, 0.13, 0]} castShadow>
          <cylinderGeometry args={[0.009, 0.012, 0.26, 5]} />
          <meshStandardMaterial color={green} roughness={1} />
        </mesh>
        <mesh position={[0.05, 0.1, 0]} rotation={[0, 0, -0.7]}>
          <boxGeometry args={[0.08, 0.006, 0.035]} />
          <meshStandardMaterial color={green} roughness={1} />
        </mesh>
        <group position={[0, 0.27, 0]} castShadow>
          {petals.map((i) => {
            const a = (i / petals.length) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05]}
                scale={[1, 0.5, 1]}
              >
                <sphereGeometry args={[0.045, 10, 8]} />
                <meshStandardMaterial color={petal} roughness={0.85} />
              </mesh>
            );
          })}
          <mesh>
            <sphereGeometry args={[0.03, 10, 8]} />
            <meshStandardMaterial color={center} roughness={0.7} emissive={center} emissiveIntensity={0.2} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Spring red poppies scattered densely across the front of the world. */
export function SpringFlowers({ palette, show, count = 150 }) {
  const flowers = useMemo(() => {
    const rng = (n) => {
      const s = Math.sin(n * 91.31 + 7.7) * 43758.5453;
      return s - Math.floor(s);
    };
    return Array.from({ length: count }, (_, i) => {
      const x = (rng(i) - 0.5) * 48;
      const z = -5 + rng(i + 50) * 18;
      return {
        key: i,
        pos: [x, terrainHeight(x, z), z],
        phase: rng(i + 90) * Math.PI * 2,
        scale: 0.8 + rng(i + 300) * 0.7,
      };
    });
  }, [count]);

  if (!show) return null;
  return (
    <group>
      {flowers.map((f) => (
        <Flower
          key={f.key}
          position={f.pos}
          petal={palette.accent}
          green={palette.soft}
          center="#FFD54A"
          phase={f.phase}
          scale={f.scale}
        />
      ))}
    </group>
  );
}

/** Lantern hung on the post; tap at night to light the world. */
export function PostLantern({ palette, position, show, lanternOn, onToggle }) {
  if (!show) return null;
  const glow = lanternOn ? "#FFE6A8" : "#C28A3A";
  return (
    <group
      name="post-lantern"
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onToggle?.();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.2, 6]} />
        <meshStandardMaterial color="#2A2438" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.22, 0]} castShadow>
        <coneGeometry args={[0.1, 0.1, 8]} />
        <meshStandardMaterial color="#2A2438" roughness={0.8} metalness={0.2} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.14, 0.2, 0.14]} />
        <meshStandardMaterial
          color={glow}
          emissive={glow}
          emissiveIntensity={lanternOn ? 2.6 : 0.55}
          roughness={0.5}
          transparent
          opacity={0.92}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, -0.13, 0]}>
        <boxGeometry args={[0.12, 0.05, 0.12]} />
        <meshStandardMaterial color="#2A2438" roughness={0.8} metalness={0.2} />
      </mesh>
      {lanternOn && (
        <>
          <pointLight
            color="#FFD89A"
            intensity={48}
            distance={34}
            decay={1.3}
            position={[-0.4, -0.05, 0.25]}
          />
          <pointLight color="#FFE9C2" intensity={10} distance={9} decay={2} />
          {[0.5, 0.9, 1.4].map((r, i) => (
            <mesh key={i}>
              <sphereGeometry args={[r, 16, 16]} />
              <meshBasicMaterial
                color="#FFE6A8"
                transparent
                opacity={0.2 - i * 0.055}
                toneMapped={false}
                depthWrite={false}
              />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

export function SoftCloudCluster({ position, scale = 1, color = "#FFF6EA" }) {
  const puffs = [
    [0, 0, 0, 0.55],
    [0.65, 0.06, 0.1, 0.42],
    [-0.55, 0.04, -0.08, 0.48],
    [0.25, 0.12, -0.18, 0.38],
    [-0.22, 0.08, 0.15, 0.4],
  ];
  return (
    <group position={position} scale={scale}>
      {puffs.map(([px, py, pz, r], i) => (
        <mesh key={i} position={[px, py, pz]} castShadow receiveShadow>
          <sphereGeometry args={[r, 20, 16]} />
          <meshStandardMaterial color={color} roughness={0.98} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

export function WireFenceLine({ palette, startX, endX, z, posts = 12 }) {
  const step = (endX - startX) / posts;
  const postXs = Array.from({ length: posts + 1 }, (_, i) => startX + i * step);

  return (
    <group>
      {postXs.map((x, i) => {
        const y = terrainHeight(x, z);
        return (
          <group key={i} position={[x, y + 0.32, z]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.035, 0.045, 0.65, 8]} />
              <meshStandardMaterial color={palette.soft} roughness={0.9} />
            </mesh>
          </group>
        );
      })}
      {[0.22, 0.42].map((hOff, li) => {
        const midX = (startX + endX) / 2;
        const y = terrainHeight(midX, z) + hOff;
        return (
          <mesh key={li} position={[midX, y, z]}>
            <boxGeometry args={[endX - startX, 0.012, 0.012]} />
            <meshStandardMaterial color={`${palette.ink}88`} roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

export function GrassTufts({ palette, seed = 42, count = 40 }) {
  const tufts = useMemo(() => {
    const rng = (n) => {
      const s = Math.sin(n * 127.1 + seed) * 43758.5453;
      return s - Math.floor(s);
    };
    return Array.from({ length: count }, (_, i) => ({
      x: (rng(i) - 0.5) * 22,
      z: (rng(i + 100) - 0.5) * 14,
      rot: rng(i + 200) * Math.PI,
      h: 0.06 + rng(i + 300) * 0.1,
    }));
  }, [count, seed]);

  return (
    <group>
      {tufts.map((t, i) => {
        const y = terrainHeight(t.x, t.z);
        return (
          <mesh key={i} position={[t.x, y + t.h / 2, t.z]} rotation={[0, t.rot, 0]}>
            <coneGeometry args={[0.035, t.h, 5]} />
            <meshStandardMaterial color={palette.soft} roughness={0.96} />
          </mesh>
        );
      })}
    </group>
  );
}
