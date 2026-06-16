/**
 * Avatar — the explorable character for play mode. Drops in from the sky on
 * start, then walks on the terrain via WASD / arrows with a follow camera. Its
 * position lives in the gameStore (`avatarPos`) so Discoverables can measure
 * proximity. While playing, this owns the camera (ExploreControls is unmounted).
 */
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { avatarPos, setLanded, refreshGuideTarget, useGame } from "./gameStore";
import { terrainHeight } from "../scene3d/coords";

// Selectable player models. `idle`/`walk` are animation-clip indices (Mixamo
// names are cryptic); chicken has no animations (static).
const AVATAR_MODELS = {
  robot: { url: "/models/chibi_robot.glb", target: 0.7, rotX: 0, idle: 0, walk: 1 },
  chicken: { url: "/models/chicken.glb", target: 0.95, rotX: 0, idle: 0, walk: 1 },
};
useGLTF.preload(AVATAR_MODELS.robot.url);
useGLTF.preload(AVATAR_MODELS.chicken.url);

const SPEED = 11;
const SPAWN = new THREE.Vector3(0, 42, 16);

export function Avatar() {
  const { camera, gl } = useThree();
  const ref = useRef();
  const keys = useRef({});
  const dropping = useRef(true);
  const guideTimer = useRef(0);
  const tmpFwd = useRef(new THREE.Vector3());
  const tmpRight = useRef(new THREE.Vector3());
  const tmpMove = useRef(new THREE.Vector3());
  const tmpCam = useRef(new THREE.Vector3());
  const tmpTarget = useRef(new THREE.Vector3());
  // Orbit camera (drag to look 360° around the avatar). Drag sets the *target*
  // angles; the live angles ease toward them each frame for OrbitControls-style
  // damped, inertial motion.
  const yaw = useRef(0);
  const pitch = useRef(0.38);
  const dist = useRef(8.5);
  const yawT = useRef(0);
  const pitchT = useRef(0.38);
  const distT = useRef(8.5);
  const drag = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const { playing, avatarVariant } = useGame();
  const cfg = AVATAR_MODELS[avatarVariant] || AVATAR_MODELS.robot;

  // Player model + (optional) Mixamo animations.
  const { scene, animations } = useGLTF(cfg.url);
  const robotRef = useRef();
  const { actions, names } = useAnimations(animations, robotRef);
  const curAction = useRef(null);
  const forced = useRef(null); // debug: 1-4 keys force a clip to find the walk
  const robot = useMemo(() => {
    const obj = skeletonClone(scene);
    obj.rotation.set(cfg.rotX, 0, 0);
    obj.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    obj.traverse((o) => {
      if (o.isMesh) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        box.union(tmp);
      }
    });
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    obj.position.set(-center.x, -box.min.y, -center.z); // feet on the ground, centered
    const scale = cfg.target / Math.max(size.x, size.y, size.z, 0.001);
    return { obj, scale };
  }, [scene, cfg]);

  // Start on the idle clip once playing.
  useEffect(() => {
    if (!playing || !names || !names.length) return;
    const idle = actions[names[cfg.idle]] || actions[names[0]];
    if (idle) {
      idle.reset().play();
      curAction.current = idle.getClip().name;
    }
    return () => Object.values(actions).forEach((a) => a && a.stop());
  }, [actions, names, playing, cfg]);

  useEffect(() => {
    if (!playing) return;
    avatarPos.copy(SPAWN);
    dropping.current = true;
    setLanded(false);
    const down = (e) => { keys.current[e.code] = true; };
    const up = (e) => { keys.current[e.code] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [playing]);

  // Drag-to-orbit + wheel-to-zoom around the avatar.
  useEffect(() => {
    if (!playing) return;
    const el = gl.domElement;
    const onDown = (e) => { drag.current = true; last.current = { x: e.clientX, y: e.clientY }; };
    const onMove = (e) => {
      if (!drag.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      yawT.current -= dx * 0.005;
      pitchT.current = Math.min(1.2, Math.max(0.06, pitchT.current + dy * 0.004));
    };
    const onUp = () => { drag.current = false; };
    const onWheel = (e) => {
      // multiplicative zoom: quick to pull back for a map overview, precise up close
      distT.current = Math.min(90, Math.max(3.5, distT.current * (1 + e.deltaY * 0.002)));
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [playing, gl]);

  useFrame((_, dt) => {
    if (!playing || !ref.current) return;
    const d = Math.min(dt, 0.05);
    const groundY = terrainHeight(avatarPos.x, avatarPos.z);
    let moved = false;

    if (dropping.current) {
      // ease down to the ground, then land
      avatarPos.y += (groundY - avatarPos.y) * Math.min(1, d * 3.2);
      if (avatarPos.y <= groundY + 0.06) {
        avatarPos.y = groundY;
        dropping.current = false;
        setLanded(true);
      }
    } else {
      const k = keys.current;
      const fwd = tmpFwd.current;
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      if (fwd.lengthSq() > 1e-6) fwd.normalize();
      const right = tmpRight.current.crossVectors(fwd, camera.up).normalize();
      const move = tmpMove.current.set(0, 0, 0);
      if (k.KeyW || k.ArrowUp) move.add(fwd);
      if (k.KeyS || k.ArrowDown) move.sub(fwd);
      if (k.KeyD || k.ArrowRight) move.add(right);
      if (k.KeyA || k.ArrowLeft) move.sub(right);
      if (move.lengthSq() > 0) {
        moved = true;
        move.normalize().multiplyScalar(SPEED * d);
        avatarPos.x += move.x;
        avatarPos.z += move.z;
        ref.current.rotation.y = Math.atan2(move.x, move.z);
      }
      avatarPos.y = terrainHeight(avatarPos.x, avatarPos.z);
    }
    ref.current.position.copy(avatarPos);

    // walk clip while moving; idle clip frozen (timescale 0) while standing still
    if (actions && names && names.length) {
      // DEBUG: press 1-4 to lock a clip and preview it (find the real walk).
      ["Digit1", "Digit2", "Digit3", "Digit4"].forEach((code, i) => {
        if (keys.current[code] && i < names.length) forced.current = i;
      });
      const idleName = names[cfg.idle] || names[0];
      const walkName = names[cfg.walk] || names[0];
      const want =
        forced.current != null
          ? names[forced.current] || names[0]
          : moved
            ? walkName
            : idleName;
      if (want !== curAction.current) {
        actions[curAction.current]?.fadeOut(0.18);
        const nx = actions[want];
        if (nx) {
          nx.reset();
          nx.setEffectiveWeight(1);
          nx.setEffectiveTimeScale(1);
          nx.fadeIn(0.18).play();
        }
        curAction.current = want;
        if (forced.current != null) console.log("[avatar] clip", forced.current, "→", want);
      }
      // hold the idle pose without looping; the walk clip always animates
      const idleAct = actions[idleName];
      if (idleAct) idleAct.setEffectiveTimeScale(moved || forced.current != null ? 1 : 0);
    }

    // orbit follow camera: ease the live yaw/pitch/distance toward their drag
    // targets (damped inertia), then place the camera on that sphere around the
    // avatar and look at its head.
    const ease = Math.min(1, d * 12);
    yaw.current += (yawT.current - yaw.current) * ease;
    pitch.current += (pitchT.current - pitch.current) * ease;
    dist.current += (distT.current - dist.current) * Math.min(1, d * 10);
    const cp = pitch.current;
    const r = dist.current;
    camera.position.set(
      avatarPos.x + Math.sin(yaw.current) * Math.cos(cp) * r,
      avatarPos.y + Math.sin(cp) * r + 1.0,
      avatarPos.z + Math.cos(yaw.current) * Math.cos(cp) * r,
    );
    const target = tmpTarget.current.set(avatarPos.x, avatarPos.y + 1.1, avatarPos.z);
    camera.lookAt(target);

    guideTimer.current += d;
    if (guideTimer.current > 0.4) {
      guideTimer.current = 0;
      refreshGuideTarget();
    }
  });

  if (!playing) return null;
  return (
    <group ref={ref}>
      <group ref={robotRef} scale={robot.scale}>
        <primitive object={robot.obj} />
      </group>
    </group>
  );
}
