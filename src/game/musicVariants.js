// The switchable background-music variations. Each `create(ctx, dest)` starts a
// looping generative piece and returns { stop(), setIntensity(x) }. Authored as
// self-contained Web Audio modules (no asset files). Playful, character-filled
// tracks — Mii-Channel lounge, PvZ-style ragtime, and a cozy folk stroll.
import { createLaundromatLounge } from "./music/laundromatLounge";
import { createSpinCycleRagtime } from "./music/spinCycleRagtime";
import { createSunDriedStroll } from "./music/sunDriedStroll";

export const MUSIC_VARIANTS = [
  { id: "lounge", label: "Lounge", create: createLaundromatLounge },
  { id: "ragtime", label: "Ragtime", create: createSpinCycleRagtime },
  { id: "stroll", label: "Stroll", create: createSunDriedStroll },
];
