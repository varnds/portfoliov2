/**
 * sockStore — state for the SOCKS game mode (laundry hunt).
 *
 * Kept deliberately separate from gameStore.js: this owns only the socks loop
 * (how many you're carrying, how many made it into the basket, and whether the
 * round is won). Mirrors gameStore's pattern: a module-level `state` object,
 * an `emit()` that swaps the ref so useSyncExternalStore notices, a `subscribe`,
 * and a `useSockGame()` hook for DOM + R3F consumers.
 *
 * SockHunt (in-Canvas) drives the truth (pickups + deposits); SockHud and
 * AboutOverlay are read-only consumers.
 */
import { useSyncExternalStore } from "react";
import { sfx } from "./audio";

export const SOCK_GOAL = 5;

let state = {
  carrying: 0, // socks the avatar is currently holding (not yet deposited)
  inBasket: 0, // socks delivered to the laundry basket
  done: false, // true once inBasket >= SOCK_GOAL → AboutOverlay
};

const listeners = new Set();
function emit() {
  state = { ...state }; // new ref so useSyncExternalStore re-renders
  listeners.forEach((l) => l());
}
function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const getState = () => state;

/** Reset for a fresh round — called when a new socks game starts. */
export function resetSocks() {
  state = { carrying: 0, inBasket: 0, done: false };
  emit();
}

/** Avatar picked up a sock → carry it. */
export function pickUpSock() {
  state = { ...state, carrying: state.carrying + 1 };
  emit();
  sfx.pickup();
}

/** Avatar reached the basket while carrying → deposit everything carried. */
export function depositSocks() {
  if (state.carrying <= 0) return 0;
  const dropped = state.carrying;
  const inBasket = Math.min(SOCK_GOAL, state.inBasket + dropped);
  const done = inBasket >= SOCK_GOAL;
  state = { ...state, carrying: 0, inBasket, done };
  emit();
  if (done) sfx.gameEnd(); // all five in → finish flourish
  else sfx.load(); // a soft thunk as the socks drop into the basket
  return dropped;
}

export function useSockGame() {
  return useSyncExternalStore(subscribe, getState, getState);
}
