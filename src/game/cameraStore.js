/**
 * cameraStore — state for the CAMERA play mode ("Develop the roll").
 *
 * Mirrors gameStore.js's useSyncExternalStore pattern so DOM (CameraHud) and
 * R3F (CameraMode) components can share the photographable "subjects", which
 * ones are captured, the current in-range subject, and a one-shot capture
 * event used to fire the white flash + developing Polaroid.
 *
 * Kept entirely SEPARATE from gameStore.js (per the mode contract) — gameStore
 * only owns the avatar/world; this owns the camera game's bookkeeping.
 */
import { useSyncExternalStore } from "react";
import { POND_X, POND_Z } from "../scene3d/coords";

// ── Subjects ──────────────────────────────────────────────────────────────────
// ~6 fixed photographable moments anchored near existing landmarks. `pos` is the
// world [x, y, z] used both for the in-world cue ring and for proximity checks
// (distance is measured on the X/Z ground plane, so the sky subject's height is
// only used to float its cue). Captions are PLACEHOLDER copy.
export const SUBJECTS = [
  {
    id: "laundry",
    pos: [0, 2.4, 0.6],
    hint: "the laundry on the line",
    caption: "Sunlight on the laundry",
  },
  {
    id: "pond",
    pos: [POND_X, 0.8, POND_Z + 2],
    hint: "the bottle in the pond",
    caption: "A message bobbing in the pond",
  },
  {
    id: "tent",
    pos: [14, 1.4, 10],
    hint: "the little camp",
    caption: "The tent by the water",
  },
  {
    id: "tree",
    pos: [22, 2.6, -6],
    hint: "the old tree",
    caption: "The old tree keeping watch",
  },
  {
    id: "grave",
    pos: [-20, 1.0, 2],
    hint: "the quiet marker",
    caption: "A quiet marker in the grass",
  },
  {
    id: "sky",
    pos: [5, 12, 5],
    hint: "the open sky",
    caption: "A balloon adrift in the sky",
  },
];

export const TOTAL_SUBJECTS = SUBJECTS.length;
export const subjectById = (id) => SUBJECTS.find((s) => s.id === id) || null;

// ── Reactive state ─────────────────────────────────────────────────────────────
let state = {
  captured: new Set(), // ids already photographed
  inRange: null, // id of the nearest photographable subject in range, or null
  lastCapture: null, // { id, caption, key } — one-shot, drives flash + Polaroid
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

let captureSeq = 0;

// ── Actions ──────────────────────────────────────────────────────────────────
/** Set which subject is currently framed (in range), or null. No-op if same. */
export function setInRange(id) {
  if (state.inRange === id) return;
  state = { ...state, inRange: id };
  emit();
}

/** Capture the given subject if it's not already captured. Returns true if a new
 *  photo was taken (so the caller can play a shutter sound, etc.). */
export function capture(id) {
  if (!id || state.captured.has(id)) return false;
  const subj = subjectById(id);
  if (!subj) return false;
  const captured = new Set(state.captured);
  captured.add(id);
  captureSeq += 1;
  state = {
    ...state,
    captured,
    lastCapture: { id, caption: subj.caption, key: captureSeq },
  };
  emit();
  return true;
}

/** Clear the captured roll — called when (re)entering camera play. */
export function resetRoll() {
  if (state.captured.size === 0 && !state.inRange && !state.lastCapture) return;
  state = { captured: new Set(), inRange: null, lastCapture: null };
  emit();
}

export function isComplete() {
  return state.captured.size >= TOTAL_SUBJECTS;
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useCamera() {
  return useSyncExternalStore(subscribe, getState, getState);
}
