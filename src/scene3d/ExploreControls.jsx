import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { computeEntryCamera } from "./coords";

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const INTRO_SECONDS = 1.85;

/** Orbit the clothesline: desktop left-drag / touch two-finger rotate, full 360°. */
export function ExploreControls({ cameraPreset, entryKey, hangPositions }) {
  const ref = useRef();
  const { camera } = useThree();
  const { position, target } = cameraPreset;

  const entry = useMemo(
    () => computeEntryCamera(hangPositions),
    [hangPositions],
  );

  const poses = useMemo(() => {
    const startPos = new THREE.Vector3(...entry.position);
    const endPos = new THREE.Vector3(position[0], position[1], position[2]);
    const startTarget = new THREE.Vector3(...entry.target);
    const endTarget = new THREE.Vector3(target[0], target[1], target[2]);
    return {
      startPos,
      endPos,
      startTarget,
      endTarget,
      startFov: entry.fov,
      endFov: entry.endFov ?? cameraPreset.fov ?? 42,
    };
  }, [entry, position, target, cameraPreset.fov]);

  const intro = useRef({ t: 0, active: true });

  useLayoutEffect(() => {
    intro.current = { t: 0, active: true };
    camera.position.copy(poses.startPos);
    camera.fov = poses.startFov;
    camera.updateProjectionMatrix();
    if (ref.current) {
      ref.current.target.copy(poses.startTarget);
      ref.current.enabled = false;
      ref.current.update();
    }
  }, [entryKey, camera, poses]);

  useFrame((_, dt) => {
    const it = intro.current;
    if (!it.active || !ref.current) return;
    it.t = Math.min(1, it.t + dt / INTRO_SECONDS);
    const e = easeInOutCubic(it.t);
    camera.position.lerpVectors(poses.startPos, poses.endPos, e);
    ref.current.target.lerpVectors(poses.startTarget, poses.endTarget, e);
    camera.fov = poses.startFov + (poses.endFov - poses.startFov) * e;
    camera.updateProjectionMatrix();
    ref.current.update();
    if (it.t >= 1) {
      it.active = false;
      ref.current.enabled = true;
    }
  });

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      enablePan
      panSpeed={0.75}
      rotateSpeed={0.55}
      zoomSpeed={0.75}
      minDistance={6}
      maxDistance={70}
      minPolarAngle={0.15}
      maxPolarAngle={1.46}
      target={entry.target}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      touches={{
        ONE: THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.ROTATE,
      }}
    />
  );
}
