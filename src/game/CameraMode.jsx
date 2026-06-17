// CameraMode — CAMERA play-mode in-world layer. Renders a faint floating cue
// ring (a "📷 here" marker) at each photographable subject, and every frame
// measures the avatar's distance to each subject to publish the nearest one in
// range to cameraStore. CameraHud (DOM) reads that to show the viewfinder +
// prompt; capture itself (F key / shutter button) is owned by CameraHud, which
// calls cameraStore.capture(). This layer is purely the world cues + proximity.
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { avatarPos, avatarActive } from "./gameStore";
import { terrainHeight } from "../scene3d/coords";
import { SUBJECTS, setInRange, useCamera } from "./cameraStore";

const ACCENT = "#E2725B";
const RANGE = 4; // units — within this (X/Z plane) a subject becomes "in range"

/** A subtle floating cue at a subject: a thin glowing ring + a soft pulse halo
 *  that bobs gently and brightens when this subject is the one in range / once
 *  it's captured. CSS-free, cheap (a torus + a sprite-ish billboard plane). */
function SubjectCue({ subject, active, captured }) {
  const groupRef = useRef();
  const ringRef = useRef();
  const haloRef = useRef();

  // Ground the cue on the terrain (sky subject keeps its given altitude).
  const [bx, by, bz] = subject.pos;
  const baseY = useMemo(() => {
    if (subject.id === "sky") return by;
    return terrainHeight(bx, bz) + by;
  }, [subject.id, bx, by, bz]);

  useFrame((stateR3F) => {
    const t = stateR3F.clock.elapsedTime;
    const g = groupRef.current;
    if (g) g.position.y = baseY + Math.sin(t * 1.4 + bx) * 0.12;
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.5;
    }
    if (haloRef.current) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + bz);
      const s = 1 + pulse * (active ? 0.35 : 0.18);
      haloRef.current.scale.setScalar(s);
      const mat = haloRef.current.material;
      if (mat) mat.opacity = (captured ? 0.05 : active ? 0.32 : 0.16) * (0.6 + pulse * 0.4);
    }
  });

  const ringColor = captured ? "#7BA05B" : ACCENT;

  return (
    <group ref={groupRef} position={[bx, baseY, bz]}>
      {/* faint pulsing halo disc, faces up */}
      <mesh ref={haloRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.9, 32]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={0.16}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {/* thin slowly-spinning ring marker, upright + billboard-ish (faces camera
          enough to read as a "📷 here" cue from most angles) */}
      <mesh ref={ringRef}>
        <torusGeometry args={[0.55, 0.045, 8, 40]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={captured ? 0.4 : active ? 1 : 0.6}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* inner dot — the "lens" */}
      <mesh>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={captured ? 0.5 : 0.85}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export function CameraMode() {
  const { captured, inRange } = useCamera();
  const tmp = useRef(new THREE.Vector3());

  // Per-frame proximity: nearest NOT-captured subject within RANGE (X/Z plane)
  // becomes the in-range subject. Publishes to cameraStore only on change.
  useFrame(() => {
    if (!avatarActive) {
      if (inRange !== null) setInRange(null);
      return;
    }
    let best = null;
    let bestD = RANGE * RANGE;
    for (let i = 0; i < SUBJECTS.length; i += 1) {
      const s = SUBJECTS[i];
      if (captured.has(s.id)) continue;
      const dx = avatarPos.x - s.pos[0];
      const dz = avatarPos.z - s.pos[2];
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD) {
        bestD = d2;
        best = s.id;
      }
    }
    setInRange(best);
  });

  return (
    <>
      {SUBJECTS.map((s) => (
        <SubjectCue
          key={s.id}
          subject={s}
          active={inRange === s.id}
          captured={captured.has(s.id)}
        />
      ))}
    </>
  );
}
