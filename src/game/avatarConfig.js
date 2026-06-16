/**
 * Avatar roster — the selectable low-poly player models (FBX2glTF / Quaternius
 * exports). Animation clip names vary per model, so Avatar.jsx matches clips by
 * substring (idle / walk / run / jump) rather than by index.
 *
 * Clip availability (from inspecting the GLBs):
 *   wolf        Idle, Walk, Run, Jump_Start, Jump_Loop, ...
 *   chicken     (none — static)
 *   chicken_guy Idle, Walk, Sprint, Jump
 *   zombie      Idle, Walk, Run, Jump, ...
 *   sharky      Idle, Walk, Run, Jump, ...
 *   woman       Idle, Walk, Run (NO jump clip)
 *   cube_woman  Idle, Walk, Run, Jump, ...
 *   banana      (none — static)
 */
export const AVATARS = [
  { id: "wolf", label: "Wolf", emoji: "🐺", url: "/models/avatars/wolf.glb", target: 1.7 },
  { id: "woman", label: "Woman", emoji: "🚶‍♀️", url: "/models/avatars/woman.glb", target: 1.7 },
  { id: "zombie", label: "Zombie", emoji: "🧟", url: "/models/avatars/zombie.glb", target: 1.7 },
  { id: "sharky", label: "Sharky", emoji: "🦈", url: "/models/avatars/sharky.glb", target: 1.7 },
  { id: "chicken_guy", label: "Chicken Guy", emoji: "🐤", url: "/models/avatars/chicken_guy.glb", target: 1.6 },
  { id: "cube_woman", label: "Cube Woman", emoji: "🧊", url: "/models/avatars/cube_woman.glb", target: 1.7 },
  { id: "banana", label: "Banana", emoji: "🍌", url: "/models/avatars/banana.glb", target: 1.6 },
  { id: "chicken", label: "Chicken", emoji: "🐔", url: "/models/avatars/chicken.glb", target: 0.95 },
];

export const DEFAULT_AVATAR = "wolf";

export const AVATAR_BY_ID = Object.fromEntries(AVATARS.map((a) => [a.id, a]));
