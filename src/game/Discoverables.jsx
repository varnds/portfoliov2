/**
 * Discoverables — the manifest of all set-pieces placed in the world. Each
 * set-piece owns its own file (visual + <Discoverable> wrapper + placeholder
 * reveal content). This manifest just composes them, so Phase-2 agents can flesh
 * out one file each without colliding here.
 */
import React from "react";
import { JourneyTree } from "./discoverables/JourneyTree";
import { BalancingStones } from "./discoverables/BalancingStones";
import { LanternFocus } from "./discoverables/LanternFocus";
import { Beacon } from "./discoverables/Beacon";
import { BuriedContradiction } from "./discoverables/BuriedContradiction";
import { TimeCapsule } from "./discoverables/TimeCapsule";
import { DreamDoorway } from "./discoverables/DreamDoorway";
import { PastCareers } from "./discoverables/PastCareers";
import { MessageBottle } from "./discoverables/MessageBottle";
import { PhotoFrame } from "./discoverables/PhotoFrame";

export function Discoverables() {
  return (
    <>
      <JourneyTree />
      <BalancingStones />
      <LanternFocus />
      <Beacon />
      <BuriedContradiction />
      <TimeCapsule />
      <DreamDoorway />
      <PastCareers />
      <MessageBottle />
      <PhotoFrame />
    </>
  );
}
