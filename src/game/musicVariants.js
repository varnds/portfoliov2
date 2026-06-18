// The switchable background-music variations. Each `create(ctx, dest)` starts a
// looping generative piece and returns { stop(), setIntensity(x) }. Authored as
// self-contained Web Audio modules (no asset files).
import { createWarmDrift } from "./music/warmDrift";
import { createSunlitHum } from "./music/sunlitHum";
import { createMusicBox } from "./music/musicBox";

export const MUSIC_VARIANTS = [
  { id: "warm", label: "Warm Drift", create: createWarmDrift },
  { id: "sunlit", label: "Sunlit Hum", create: createSunlitHum },
  { id: "box", label: "Music Box", create: createMusicBox },
];
