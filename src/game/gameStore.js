/**
 * gameStore — central state for the 3D "discover who I am" play mode.
 *
 * Reactive fields (playing, discovered count, activeReveal, guideTargetId) are
 * exposed via useSyncExternalStore hooks so DOM + R3F components re-render. The
 * avatar position is a plain mutable THREE.Vector3 (`avatarPos`) updated every
 * frame by the Avatar and read directly by Discoverables — NOT reactive, to
 * avoid per-frame React renders.
 *
 * Set-pieces register themselves via useDiscovery(); this store owns the truth
 * of what exists, what's been found, and which target the bird should point to.
 */
import { useSyncExternalStore } from "react";
import * as THREE from "three";
import { DEFAULT_AVATAR } from "./avatarConfig";

// ── Non-reactive shared state ────────────────────────────────────────────────
export const avatarPos = new THREE.Vector3(0, 0, 0);
export let avatarActive = false; // true once the avatar has landed

// Current season accent (live binding) so in-world cues can glow on-theme.
export let themeAccent = "#E2725B";
export function setThemeAccent(hex) {
  if (hex) themeAccent = hex;
}

// id → { position: THREE.Vector3, buried: boolean }
const registry = new Map();

// ── Reactive state ───────────────────────────────────────────────────────────
let state = {
  playing: false,
  landed: false,
  discovered: new Set(), // ids
  truths: [], // resolved truth lines (content wired later)
  activeReveal: null, // { id, title, body } | null
  guideTargetId: null, // nearest undiscovered id (for the bird guide)
  welcomeSeen: false, // welcome card dismissed
  nearTarget: null, // { id, buried } — the discoverable you're standing by
  avatarVariant: DEFAULT_AVATAR, // one of the ids in avatarConfig AVATARS
  cameraMode: "both", // "both" (auto-follow + look-ahead) | "free" (manual)
};

const listeners = new Set();
function emit() {
  state = { ...state }; // new ref so useSyncExternalStore notices
  listeners.forEach((l) => l());
}
function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const getState = () => state;

// ── Actions ──────────────────────────────────────────────────────────────────
export function startGame() {
  if (state.playing) return;
  avatarActive = false;
  state = {
    ...state,
    playing: true,
    landed: false,
    discovered: new Set(),
    truths: [],
    activeReveal: null,
    welcomeSeen: false,
    nearTarget: null,
  };
  emit();
}

export function setAvatarVariant(v) {
  if (state.avatarVariant === v) return;
  state = { ...state, avatarVariant: v };
  emit();
}

export function setCameraMode(m) {
  if (state.cameraMode === m) return;
  state = { ...state, cameraMode: m };
  emit();
}

export function dismissWelcome() {
  if (state.welcomeSeen) return;
  state = { ...state, welcomeSeen: true };
  emit();
}

/** Called by a Discoverable when the avatar enters/leaves its range. */
export function enterNear(id, buried) {
  const nt = state.nearTarget;
  if (nt && nt.id === id) return;
  state = { ...state, nearTarget: { id, buried: !!buried } };
  emit();
}
export function leaveNear(id) {
  if (state.nearTarget && state.nearTarget.id === id) {
    state = { ...state, nearTarget: null };
    emit();
  }
}

export function endGame() {
  avatarActive = false;
  state = { ...state, playing: false, landed: false, activeReveal: null };
  emit();
}

export function setLanded(v) {
  avatarActive = v;
  if (state.landed === v) return;
  state = { ...state, landed: v };
  emit();
}

export function registerDiscoverable(id, position, buried) {
  registry.set(id, { position: new THREE.Vector3(...position), buried: !!buried });
}
export function unregisterDiscoverable(id) {
  registry.delete(id);
}

export function discover(id, reveal) {
  if (state.discovered.has(id)) return;
  const discovered = new Set(state.discovered);
  discovered.add(id);
  state = { ...state, discovered, activeReveal: reveal || null };
  emit();
}

export function closeReveal() {
  if (!state.activeReveal) return;
  state = { ...state, activeReveal: null };
  emit();
}

/** Recompute the nearest undiscovered discoverable to the avatar (bird guide).
 *  Called from a frame loop (throttled by the caller). */
export function refreshGuideTarget() {
  let best = null;
  let bestD = Infinity;
  registry.forEach((d, id) => {
    if (state.discovered.has(id)) return;
    const dist = avatarPos.distanceToSquared(d.position);
    if (dist < bestD) {
      bestD = dist;
      best = id;
    }
  });
  if (best !== state.guideTargetId) {
    state = { ...state, guideTargetId: best };
    emit();
  }
}

export function guideTargetPosition() {
  const t = state.guideTargetId && registry.get(state.guideTargetId);
  return t ? t.position : null;
}

export function totalCount() {
  return registry.size;
}

// ── Hooks ────────────────────────────────────────────────────────────────────
export function useGame() {
  return useSyncExternalStore(subscribe, getState, getState);
}
