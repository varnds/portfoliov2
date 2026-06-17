import React, { Suspense, useMemo, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { SceneEnvironment } from "./SceneEnvironment";
import { ExploreControls } from "./ExploreControls";
import { Snowfall, FrostSparkles } from "./Atmosphere";
import { SeasonAtmosphere } from "./SeasonParticles";
import { computeCameraPreset, computeEntryCamera, SUN_POSITION } from "./coords";
import { TransitionGate } from "./TransitionGate";
import { GameLayer } from "../game/GameLayer";

/** Full surrounding sky: a large back-faced sphere graded top→horizon. */
function SkyDome({ sky1, sky2, sky3 }) {
  const geometry = useMemo(() => {
    const radius = 260;
    const geo = new THREE.SphereGeometry(radius, 48, 32);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const top = new THREE.Color(sky1);
    const mid = new THREE.Color(sky2);
    const horizon = new THREE.Color(sky3);
    const c = new THREE.Color();
    const smooth = (x) => x * x * (3 - 2 * x);
    for (let i = 0; i < pos.count; i += 1) {
      const t = THREE.MathUtils.clamp((pos.getY(i) / radius + 0.2) / 0.95, 0, 1);
      // Two overlapping smoothsteps give a seamless horizon→mid→top blend with
      // no visible banding, brightest low (near the sun) and deeper up top.
      if (t > 0.45) c.copy(mid).lerp(top, smooth((t - 0.45) / 0.55));
      else c.copy(horizon).lerp(mid, smooth(t / 0.45));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [sky1, sky2, sky3]);

  return (
    <mesh geometry={geometry} scale={[1, 0.85, 1]}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} toneMapped={false} fog={false} depthWrite={false} />
    </mesh>
  );
}

/** Per-season sunlight: color temperature + strength of the single key sun and
 * the sky fill, so each season feels like real daylight of that time/place. */
// Soft, hazy golden-hour mood: a gentle backlit key sun + generous warm sky
// fill so shadows stay light and the whole scene reads low-contrast and dreamy.
const SEASON_LIGHT = {
  spring: { sun: "#FFF1DA", sunI: 1.55, amb: 0.62, hemi: 0.72, skyFill: "#FBEFE2" },
  summer: { sun: "#FFDDAE", sunI: 1.7, amb: 0.6, hemi: 0.68, skyFill: "#FFEBCF" },
  autumn: { sun: "#FFD09A", sunI: 1.65, amb: 0.6, hemi: 0.66, skyFill: "#FFE3C2" },
  winter: { sun: "#EDF3FF", sunI: 1.5, amb: 0.82, hemi: 0.9, skyFill: "#EAF1FF" },
};

function GoldenHourLighting({ palette, seasonKey, isNight, lanternOn }) {
  const sunRef = useRef();
  const [sx, sy, sz] = SUN_POSITION;

  useEffect(() => {
    if (!sunRef.current) return;
    sunRef.current.shadow.camera.left = -48;
    sunRef.current.shadow.camera.right = 48;
    sunRef.current.shadow.camera.top = 48;
    sunRef.current.shadow.camera.bottom = -48;
    sunRef.current.shadow.camera.near = 1;
    sunRef.current.shadow.camera.far = 120;
    sunRef.current.shadow.camera.updateProjectionMatrix();
  }, []);

  if (isNight) {
    return (
      <>
        <ambientLight intensity={lanternOn ? 0.42 : 0.32} color="#5A6488" />
        <hemisphereLight args={["#141830", "#3A4468", lanternOn ? 0.62 : 0.5]} />
        <directionalLight
          position={[sx * 0.3, sy * 0.4 + 6, sz * 0.3 + 8]}
          intensity={lanternOn ? 0.55 : 0.38}
          color="#B8C8E8"
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
      </>
    );
  }

  const L = SEASON_LIGHT[seasonKey] || SEASON_LIGHT.spring;

  // Natural daylight = one sun (key) + sky dome fill (hemisphere) + soft ambient.
  return (
    <>
      <hemisphereLight args={[L.skyFill, palette.hill2 || palette.hill3, L.hemi]} />
      <ambientLight intensity={L.amb} color={L.skyFill} />
      <directionalLight
        ref={sunRef}
        position={[sx, sy, sz]}
        intensity={L.sunI}
        color={L.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
      />
    </>
  );
}

function SceneContents(props) {
  const { palette, seasonKey, isNight, lanternOn, hangPositions } = props;
  const showSun = seasonKey !== "night";
  const isWinter = seasonKey === "winter";
  const cameraPreset = useMemo(
    () => computeCameraPreset(hangPositions),
    [hangPositions],
  );

  // Clear winter-day sky; night gets a deep star-field sky darker than the ground.
  const sky = isNight
    ? { sky1: "#040612", sky2: "#0A1024", sky3: "#141C38" }
    : isWinter
      ? { sky1: "#8FBAE8", sky2: "#BBD5F1", sky3: "#ECF4FC" }
      : { sky1: palette.sky1, sky2: palette.sky2, sky3: palette.sky3 };
  const fogColor = isNight ? "#0A1020" : isWinter ? "#EDF3FC" : palette.sky3;
  const fogRange = isNight ? [22, 72] : isWinter ? [17, 70] : [16, 66];

  return (
    <>
      <color attach="background" args={[sky.sky2]} />
      <SkyDome sky1={sky.sky1} sky2={sky.sky2} sky3={sky.sky3} />
      <fog attach="fog" args={[fogColor, fogRange[0], fogRange[1]]} />
      <GoldenHourLighting palette={palette} seasonKey={seasonKey} isNight={isNight} lanternOn={lanternOn} />
      <SeasonAtmosphere
        seasonKey={seasonKey}
        isNight={isNight}
        lanternOn={lanternOn}
        windStrength={props.windStrength ?? 0.5}
      />
      <Snowfall seasonKey={seasonKey} />
      <FrostSparkles seasonKey={seasonKey} />
      <SceneEnvironment {...props} showSun={showSun} isNight={isNight} seasonKey={seasonKey} />
      <GameLayer seasonKey={seasonKey} />
      <ExploreControls
        cameraPreset={cameraPreset}
        entryKey={props.entryKey}
        hangPositions={hangPositions}
      />
      <TransitionGate entryKey={props.entryKey} onReady={props.onTransitionReady} />
    </>
  );
}

export function Scene3D(props) {
  const isNight = props.seasonKey === "night";
  const isWinter = props.seasonKey === "winter";
  const entryCamera = useMemo(
    () => computeEntryCamera(props.hangPositions),
    [props.hangPositions],
  );

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      frameloop={props.active ? "always" : "never"}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: isNight ? 0.95 : isWinter ? 1.45 : 1.2,
      }}
      camera={{
        fov: entryCamera.fov,
        near: 0.1,
        far: 400,
        position: entryCamera.position,
      }}
      style={{ position: "absolute", inset: 0, touchAction: "none", zIndex: 0 }}
    >
      <Suspense fallback={null}>
        <SceneContents {...props} isNight={isNight} />
      </Suspense>
    </Canvas>
  );
}
