import React from "react";
import {
  clotheslineEnds,
  clotheslinePoint,
  lineFraction,
  postLayout,
  SUN_POSITION,
} from "./coords";
import { GarmentMesh } from "./GarmentMesh";
import { Terrain } from "./Terrain";
import { Water } from "./Water";
import { Foliage } from "./Foliage";
import { LandmarkTree } from "./LandmarkTree";
import { PondRipples } from "./PondRipples";
import { GlbScenery } from "./GlbScenery";
import { AutumnLeaves, AutumnMotes, DriftingClouds } from "./Atmosphere";
import {
  ClotheslinePost,
  Rope,
  WickerBasket,
  SkySun,
  FlyingBirds,
  OrangeBird,
  SpringFlowers,
  PostLantern,
  WireFenceLine,
  GrassTufts,
} from "./Props";

const LEFT_POST = postLayout(70, 470, 130, 0);
const RIGHT_POST = postLayout(970, 470, 130, 0);
const LINE = clotheslineEnds(LEFT_POST, RIGHT_POST);

// Ring of distant GLB mountains framing the horizon (winter).
const MOUNTAIN_RING = [
  { position: [0, 0, -125], rotationY: 0.1, targetSize: 124 },
  { position: [-72, 0, -104], rotationY: 0.9, targetSize: 120 },
  { position: [76, 0, -116], rotationY: -0.7, targetSize: 128 },
  { position: [126, 0, 4], rotationY: -1.5, targetSize: 120 },
  { position: [62, 0, 102], rotationY: -2.4, targetSize: 122 },
  { position: [-60, 0, 106], rotationY: 2.4, targetSize: 124 },
  { position: [-126, 0, -2], rotationY: 1.5, targetSize: 120 },
];

// Big canyon formations ringing the desert horizon (summer).
const CANYON_RING = [
  { position: [126, 0, 4], rotationY: -1.5, targetSize: 120, yOffset: -6 },
  { position: [62, 0, 102], rotationY: -2.4, targetSize: 122, yOffset: -6 },
  { position: [-60, 0, 106], rotationY: 2.4, targetSize: 124, yOffset: -6 },
  { position: [-126, 0, -2], rotationY: 1.5, targetSize: 120, yOffset: -6 },
];

export function SceneEnvironment({
  palette,
  seasonKey,
  isNight,
  showSun,
  lanternOn,
  onToggleLantern,
  onChimeStrike,
  onChirp,
  pieces,
  hangPositions,
  windStrength,
  hot,
  selectedId,
  onGarmentPointerOver,
  onGarmentPointerOut,
  onGarmentClick,
}) {
  return (
    <group>
      <Terrain palette={palette} />
      <Water seasonKey={seasonKey} palette={palette} />
      <PondRipples seasonKey={seasonKey} palette={palette} />
      <Foliage seasonKey={seasonKey} palette={palette} />
      <LandmarkTree seasonKey={seasonKey} palette={palette} />

      {seasonKey === "winter" &&
        MOUNTAIN_RING.map((m, i) => (
          <GlbScenery key={`mtn-${i}`} mode="mountains" position={m.position} rotationY={m.rotationY} targetSize={m.targetSize} />
        ))}
      {seasonKey === "summer" &&
        CANYON_RING.map((m, i) => (
          <GlbScenery key={`canyon-${i}`} url="/models/mars_rover.glb" mode="canyons" position={m.position} rotationY={m.rotationY} targetSize={m.targetSize} yOffset={m.yOffset} />
        ))}

      {seasonKey !== "night" && <DriftingClouds />}

      <SkySun palette={palette} position={SUN_POSITION} show={showSun && !isNight} />
      <FlyingBirds show={!isNight} />
      <OrangeBird show={!isNight} onChirp={onChirp} />
      <SpringFlowers palette={palette} show={seasonKey === "spring"} />
      <AutumnLeaves seasonKey={seasonKey} />
      {seasonKey === "autumn" && <AutumnMotes />}

      <WireFenceLine palette={palette} startX={-13} endX={15} z={-7} posts={16} />
      <GrassTufts palette={palette} count={40} />

      <ClotheslinePost
        layout={LEFT_POST}
        palette={palette}
        withChime
        windStrength={windStrength}
        onChimeStrike={onChimeStrike}
      />
      <ClotheslinePost layout={RIGHT_POST} palette={palette} />
      <PostLantern
        palette={palette}
        position={[RIGHT_POST.x, RIGHT_POST.topY - 0.12, RIGHT_POST.z + 0.04]}
        show={isNight}
        lanternOn={lanternOn}
        onToggle={onToggleLantern}
      />

      <Rope palette={palette} L={LINE.L} R={LINE.R} />
      <WickerBasket palette={palette} />

      {pieces.map((piece, i) => {
        if (!piece) return null;
        const anchor = hangPositions[i];
        if (!anchor) return null;
        const t = lineFraction(anchor.x);
        const pos = clotheslinePoint(t, LINE.L, LINE.R);
        const highlighted = hot === piece.id || selectedId === piece.id;
        return (
          <GarmentMesh
            key={piece.id}
            piece={piece}
            index={i}
            position={pos}
            palette={palette}
            windStrength={windStrength}
            highlighted={highlighted}
            onPointerOver={() => onGarmentPointerOver?.(piece.id)}
            onPointerOut={() => onGarmentPointerOut?.(piece.id)}
            onClick={(e) => {
              e.stopPropagation();
              onGarmentClick?.(piece);
            }}
          />
        );
      })}
    </group>
  );
}
