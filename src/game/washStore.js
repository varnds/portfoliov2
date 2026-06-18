/**
 * washStore — state machine for WASH DAY mode (the 4th game): find the dirty
 * denim jacket, wash it, dry it on the line, then About Me unlocks.
 *
 * Phase flow:
 *   seek        — the muddy jacket is somewhere in the yard; walk to it to grab.
 *   carryDirty  — carrying the muddy jacket; bring it to the washing machine.
 *   washing     — at the washer: HOLD to run the drum (cozy timer + mini-interaction);
 *                 washP fills 0→1, then → carryWet.
 *   carryWet    — carrying the clean-but-wet jacket; bring it to the empty peg.
 *   drying      — at the peg: HOLD to fan it dry; dryP fills 0→1 (cloth lightens +
 *                 billows), then → done.
 *   done        — jacket hangs clean & dry; the line is complete → About reveal.
 *
 * Split of responsibilities (so two agents don't collide):
 *   • WashDay.jsx (in-world)  — owns proximity (sets nearWasher/nearPeg, calls
 *     pickUpJacket), visualizes the washer + jacket states, and advances the
 *     timed fills each frame: while `holding`, calls addWash/addDry(dt).
 *   • WashHud.jsx (DOM)       — owns the bird narration + per-phase prompts, the
 *     F-key / button that triggers startWashing/startDrying and toggles `holding`,
 *     the progress bars, and the final About reveal.
 */
import { useSyncExternalStore } from "react";
import { sfx } from "./audio";

export const WASH_TIME = 4.0; // seconds of holding to finish a wash
export const DRY_TIME = 5.0; // seconds of holding to finish drying

const initial = {
  phase: "seek", // seek | carryDirty | washing | carryWet | drying | done
  washP: 0, // 0..1 wash progress
  dryP: 0, // 0..1 dry progress
  nearPanel: false, // player (seeking) is in range of the muddy denim to grab (press G)
  nearWasher: false, // player (carrying dirty) is in range of the washer
  nearPeg: false, // player (carrying wet) is in range of the empty peg
  holding: false, // the player is holding the mini-interaction (spin / fan)
};

let s = { ...initial };
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

export function resetWash() {
  s = { ...initial };
  emit();
}
export function pickUpJacket() {
  if (s.phase !== "seek") return;
  s = { ...s, phase: "carryDirty" };
  emit();
  sfx.pickup();
}
export function setNearPanel(v) {
  if (s.nearPanel === !!v) return;
  s = { ...s, nearPanel: !!v };
  emit();
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
  if (s.phase !== "carryDirty") return;
  s = { ...s, phase: "washing", holding: false };
  emit();
  sfx.load();
}
export function startDrying() {
  if (s.phase !== "carryWet") return;
  s = { ...s, phase: "drying", holding: false };
  emit();
  sfx.hang();
}
export function setHolding(v) {
  if (s.holding === !!v) return;
  s = { ...s, holding: !!v };
  emit();
}
/** Advance the wash fill by `amt` (already dt/WASH_TIME). Auto-advances phase. */
export function addWash(amt) {
  if (s.phase !== "washing") return;
  const washP = Math.min(1, s.washP + amt);
  s = { ...s, washP, ...(washP >= 1 ? { phase: "carryWet", holding: false } : null) };
  emit();
}
export function addDry(amt) {
  if (s.phase !== "drying") return;
  const dryP = Math.min(1, s.dryP + amt);
  s = { ...s, dryP, ...(dryP >= 1 ? { phase: "done", holding: false } : null) };
  emit();
}

export function useWash() {
  return useSyncExternalStore(subscribe, getState, getState);
}
