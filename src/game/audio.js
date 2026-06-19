// audio.js — the sound engine for the 3D world. Procedural Web Audio only (no
// asset files). EVERYTHING is defensive: if Web Audio is missing or any sound
// throws, the visuals are never affected (all calls are guarded no-ops).
//
// Lifecycle:
//   • The AudioContext can't start until a user gesture (browser autoplay policy).
//     installUnlock() arms a one-time pointerdown/keydown listener that resumes it.
//   • audioSetPlaying(true/false) follows the game's playing state (music runs only
//     while playing). setSoundOn toggles a master mute. setVariant swaps the theme.
//   • SFX (sfx.*) + the washer loop are safe no-ops until the context is unlocked.
import { useSyncExternalStore } from "react";
import { createSfx } from "./gameSfxKit";
import { MUSIC_VARIANTS } from "./musicVariants";
import { createAirOnGString } from "./music/airOnGString";

// ── Reactive UI state (sound on/off + chosen music variant) ──────────────────
let state = { soundOn: true, variant: "lounge" };
const listeners = new Set();
function emit() {
  state = { ...state };
  listeners.forEach((l) => l());
}
function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const getState = () => state;
export function useAudio() {
  return useSyncExternalStore(subscribe, getState, getState);
}

// ── Engine internals (non-reactive) ──────────────────────────────────────────
let ctx = null;
let master = null;
let musicBus = null;
let sfxBus = null;
let sfxKit = null;
let music = null;
let unlocked = false;
let playing = false;
let washerOn = false;
let mode = null; // current game mode — Wash Day gets the Bach track

function ensureCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = state.soundOn ? 1 : 0.0001;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.55;
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(master);
    try {
      sfxKit = createSfx(ctx, sfxBus);
    } catch {
      sfxKit = null;
    }
  } catch {
    ctx = null;
  }
  return ctx;
}

function variantById(id) {
  return MUSIC_VARIANTS.find((v) => v.id === id) || MUSIC_VARIANTS[0];
}

function startMusic() {
  if (!ctx || music || !unlocked || !state.soundOn || !playing) return;
  try {
    // Wash Day plays Bach's Air on the G String; other modes use the chosen
    // procedural variant.
    music =
      (mode === "wash"
        ? createAirOnGString(ctx, musicBus)
        : variantById(state.variant).create(ctx, musicBus)) || null;
  } catch {
    music = null;
  }
}

// Follow the active game mode — switching to/from Wash Day swaps the music track.
export function audioSetMode(m) {
  if (mode === m) return;
  mode = m;
  if (playing) {
    stopMusic();
    startMusic();
  }
}
function stopMusic() {
  if (music) {
    try {
      music.stop();
    } catch {
      /* ignore */
    }
    music = null;
  }
}

// Arm a one-time gesture listener that unlocks the audio context (autoplay policy).
let unlockArmed = false;
export function installUnlock() {
  if (unlockArmed || typeof window === "undefined") return;
  unlockArmed = true;
  const handler = () => {
    audioUnlock();
    if (unlocked) {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    }
  };
  window.addEventListener("pointerdown", handler);
  window.addEventListener("keydown", handler);
}

export function audioUnlock() {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  unlocked = true;
  startMusic();
}

export function audioSetPlaying(on) {
  playing = !!on;
  if (playing) startMusic();
  else {
    stopMusic();
    audioWasherStop();
    audioFanStop();
  }
}

export function setSoundOn(on) {
  on = !!on;
  if (state.soundOn === on) return;
  state.soundOn = on;
  emit();
  if (master && ctx) {
    try {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setTargetAtTime(on ? 1 : 0.0001, t, 0.04);
    } catch {
      /* ignore */
    }
  }
  if (on) startMusic();
  else stopMusic();
}

export function setVariant(id) {
  if (state.variant === id) return;
  state.variant = id;
  emit();
  stopMusic();
  startMusic();
}

// ── SFX — safe no-ops until unlocked ─────────────────────────────────────────
const call = (fn, ...args) => {
  try {
    if (sfxKit && typeof sfxKit[fn] === "function") sfxKit[fn](...args);
  } catch {
    /* a sound must never break the app */
  }
};
export const sfx = {
  footstep: () => call("footstep"),
  drop: (style) => call("drop", style),
  die: () => call("die"),
  caught: () => call("caught"),
  splash: () => call("splash"),
  birdChirp: () => call("birdChirp"),
  pickup: () => call("pickup"),
  load: () => call("load"),
  hang: () => call("hang"),
  sockFound: () => call("sockFound"),
  gameStart: () => call("gameStart"),
  gameEnd: () => call("gameEnd"),
};

export function audioWasherStart() {
  if (washerOn) return;
  washerOn = true;
  call("washerStart");
}
export function audioWasherStop() {
  if (!washerOn) return;
  washerOn = false;
  call("washerStop");
}
export function audioWasherIntensity(x) {
  call("washerSetIntensity", x);
}

let fanOn = false;
export function audioFanStart() {
  if (fanOn) return;
  fanOn = true;
  call("fanStart");
}
export function audioFanStop() {
  if (!fanOn) return;
  fanOn = false;
  call("fanStop");
}
export function audioFanIntensity(x) {
  call("fanSetIntensity", x);
}
// While the washer runs, gently swell the music too.
export function audioMusicIntensity(x) {
  if (music && typeof music.setIntensity === "function") {
    try {
      music.setIntensity(x);
    } catch {
      /* ignore */
    }
  }
}
