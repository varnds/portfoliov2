/**
 * Avatar roster — the selectable low-poly player models (FBX2glTF / Quaternius
 * exports). Animation clip names vary per model, so Avatar.jsx matches clips by
 * substring (idle / walk / run / jump) rather than by index.
 *
 * All five models have a full Idle / Walk / Run / Jump clip set:
 *   wolf, zombie, sharky, chicken_guy (uses "Sprint" for run), cube_woman.
 */
export const AVATARS = [
  { id: "wolf", label: "Wolf", emoji: "🐺", url: "/models/avatars/wolf.glb", target: 1.7 },
  { id: "zombie", label: "Zombie", emoji: "🧟", url: "/models/avatars/zombie.glb", target: 2.1 },
  { id: "sharky", label: "Sharky", emoji: "🦈", url: "/models/avatars/sharky.glb", target: 1.7 },
  { id: "chicken_guy", label: "Chicken Guy", emoji: "🐤", url: "/models/avatars/chicken_guy.glb", target: 1.6 },
  { id: "cube_woman", label: "Cube Woman", emoji: "🧊", url: "/models/avatars/cube_woman.glb", target: 1.7 },
];

export const DEFAULT_AVATAR = "wolf";

export const AVATAR_BY_ID = Object.fromEntries(AVATARS.map((a) => [a.id, a]));
