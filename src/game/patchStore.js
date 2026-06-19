/**
 * patchStore — state machine for PATCHWORK mode (the 5th game). A garment has been
 * torn into PATCHES scattered + hidden across the world. The player explores, finds
 * each patch (a real discovery — no waypoints), and every found patch is stitched
 * onto the incomplete garment they carry. Once all patches are assembled the garment
 * is whole and can be WASHED, then HUNG on the line to finish.
 *
 * Phase flow (mirrors Wash Day's wash→hang→dry, with a long GATHER front):
 *   gather    — explore + collect the hidden patches; each stitches onto the carried
 *               garment. When the last one is found → garment whole → toWasher.
 *   toWasher  — carry the finished garment to the washing machine (press to load).
 *   washing   — at the washer: HOLD to run the drum; washP 0→1 → toPeg.
 *   toPeg     — carry the clean-but-wet garment to the empty peg (press to hang).
 *   drying    — at the peg: HOLD to fan it dry; dryP 0→1 → done.
 *   done      — the patchwork garment hangs clean & dry. The journey is complete.
 *
 * Split of responsibilities:
 *   • PatchWork.jsx (in-world) — owns patch placement + proximity discovery (calls
 *     collectPatch), the assembling carried garment, the washer + peg visuals, and
 *     the timed fills (while `holding`, calls addWash/addDry each frame).
 *   • PatchHud.jsx (DOM)       — progress ("found X of N"), per-phase prompts, the
 *     keys that trigger startWashing/startDrying + toggle `holding`, the finish.
 */
import { useSyncExternalStore } from "react";
import { sfx } from "./audio";

export const PATCH_TOTAL = 6; // how many patches make a whole garment
// The 6 patch colours (shared by the in-world scraps + the corner assembly panel).
export const PATCH_COLORS = ["#E2725B", "#E0A458", "#6FA8A0", "#8C7BD9", "#D96BA0", "#C9A24B"];
export const WASH_TIME = 4.0; // seconds of holding to finish a wash
export const DRY_TIME = 5.0; // seconds of holding to finish drying

const initial = {
  phase: "gather", // gather | toWasher | washing | toPeg | drying | done
  found: 0, // patches discovered + stitched on
  total: PATCH_TOTAL,
  washP: 0, // 0..1 wash progress
  dryP: 0, // 0..1 dry progress
  nearWasher: false, // carrying the whole garment + in range of the washer
  nearPeg: false, // carrying the wet garment + in range of the empty peg
  holding: false, // holding the mini-interaction (spin / fan)
};

let s = { ...initial };
let collectedIds = new Set(); // guards against double-collecting the same patch
const subs = new Set();
function emit() {
  s = { ...s };
  subs.forEach((f) => f());
}
function subscribe(cb) {
  subs.add(cb);
  return () => subs.delete(cb);
}
const getState = () => s;

export function resetPatch() {
  s = { ...initial };
  collectedIds = new Set();
  emit();
}

/** Discover a patch by its id. Returns true if it was newly collected (so the
 *  scene can fly it onto the garment). Auto-completes the garment on the last one. */
export function collectPatch(id) {
  if (s.phase !== "gather") return false;
  if (collectedIds.has(id)) return false;
  collectedIds.add(id);
  const found = s.found + 1;
  const complete = found >= s.total;
  s = { ...s, found, ...(complete ? { phase: "toWasher" } : null) };
  emit();
  sfx.patchFound(); // a soft sparkle of discovery (the stitch plays on attach)
  return true;
}

export function setNearWasher(v) {
  if (s.nearWasher === !!v) return;
  s = { ...s, nearWasher: !!v };
  emit();
}
export function setNearPeg(v) {
  if (s.nearPeg === !!v) return;
  s = { ...s, nearPeg: !!v };
  emit();
}
export function startWashing() {
  if (s.phase !== "toWasher") return;
  s = { ...s, phase: "washing", holding: false };
  emit();
  sfx.load();
}
export function startDrying() {
  if (s.phase !== "toPeg") return;
  s = { ...s, phase: "drying", holding: false };
  emit();
  sfx.hang();
}
export function setHolding(v) {
  if (s.holding === !!v) return;
  s = { ...s, holding: !!v };
  emit();
}
export function addWash(amt) {
  if (s.phase !== "washing") return;
  const washP = Math.min(1, s.washP + amt);
  s = { ...s, washP, ...(washP >= 1 ? { phase: "toPeg", holding: false } : null) };
  emit();
}
export function addDry(amt) {
  if (s.phase !== "drying") return;
  const dryP = Math.min(1, s.dryP + amt);
  const finished = dryP >= 1;
  s = { ...s, dryP, ...(finished ? { phase: "done", holding: false } : null) };
  emit();
  if (finished) sfx.gameEnd(); // the garment is whole, clean & dry — a happy finish
}

export function usePatch() {
  return useSyncExternalStore(subscribe, getState, getState);
}
