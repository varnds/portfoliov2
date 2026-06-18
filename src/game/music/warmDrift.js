// warmDrift.js
// Procedural, generative "Warm Drift" ambient music using only the Web Audio API.
// No audio files, no external libraries.
//
// Vibe: slow, cozy, dusk-in-a-warm-desert ambient. Sustained warm pad chords
// through a gentle lowpass, very slow multi-second swells, sparse high bell
// twinkles. Consonant only (pentatonic / major). Slow harmonic movement.
//
// Usage:
//   const inst = createWarmDrift(ctx, destGainNode);
//   inst.setIntensity(0.6); // while the washing machine runs
//   inst.stop();            // safe to call once
//
// Contract notes:
//  - `ctx` is a running AudioContext.
//  - `dest` is a GainNode already connected toward the speakers. We connect ALL
//    of our output into `dest`.
//  - A setInterval lookahead scheduler schedules notes ~0.4s ahead every ~150ms.

export function createWarmDrift(ctx, dest) {
  // ---- Tuning constants -----------------------------------------------------
  const LOOKAHEAD_MS = 150;          // how often the scheduler wakes up
  const SCHEDULE_AHEAD = 0.4;        // seconds of audio scheduled per wake-up
  const MASTER_PEAK = 0.25;          // modest local peak; dest handles overall level
  const CHORD_PERIOD_MIN = 6.0;      // seconds between chord changes (min)
  const CHORD_PERIOD_MAX = 10.0;     // seconds between chord changes (max)
  const BASE_CUTOFF = 760;           // lowpass base cutoff (Hz)

  // A major pentatonic-ish palette in a warm low-mid register (Hz).
  // Root A. Frequencies are consonant; chords are subsets of these.
  // A2, C#3, E3, A3, B3, C#4, E4, F#4, A4
  const A2 = 110.0;
  const Cs3 = 138.59;
  const E3 = 164.81;
  const A3 = 220.0;
  const B3 = 246.94;
  const Cs4 = 277.18;
  const E4 = 329.63;
  const Fs4 = 369.99;
  const A4 = 440.0;

  // A small set of consonant, slowly-shifting pad voicings (all in A major).
  const CHORDS = [
    [A2, E3, A3, Cs4],   // A major (root)
    [A2, E3, Fs4, A4],   // A6 / F#m color
    [A2, E3, B3, E4],    // Aadd9-ish (open fifth + 9)
    [A2, Cs3, E3, A3],   // A major low voicing
    [A2, E3, A3, E4],    // open fifths, very stable
  ];

  // High bell/twinkle notes (upper octaves of the pentatonic).
  const BELLS = [A4, E4 * 2, Fs4 * 2, A4 * 1.5 /* ~E5 */, B3 * 4 /* high B */];

  // ---- Node graph -----------------------------------------------------------
  // Everything feeds: voices -> filter -> master -> dest
  let alive = true;
  const active = new Set();          // OscillatorNodes currently scheduled/playing
  const disposables = new Set();     // any nodes we want to disconnect on stop()

  const master = ctx.createGain();
  master.gain.value = 0.0001;        // start near-silent, ramp up
  disposables.add(master);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = BASE_CUTOFF;
  filter.Q.value = 0.6;              // gentle, no resonant honk
  disposables.add(filter);

  filter.connect(master);
  master.connect(dest);

  // Slow LFO modulating the filter cutoff for gentle movement.
  let lfo = null;
  let lfoGain = null;
  try {
    lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.05;      // ~20s period, very slow drift
    lfoGain = ctx.createGain();
    lfoGain.gain.value = 120;        // +/- 120 Hz around base cutoff
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    disposables.add(lfo);
    disposables.add(lfoGain);
    lfo.start();
    active.add(lfo);
  } catch (e) {
    // If LFO setup fails for any reason, the pad still works without movement.
  }

  // Fade the master in smoothly (multi-second swell into existence).
  try {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(MASTER_PEAK, now + 4.0);
  } catch (e) { /* ignore */ }

  // ---- Intensity ------------------------------------------------------------
  let intensity = 0; // [0,1]

  function applyIntensity() {
    if (!alive) return;
    const x = Math.max(0, Math.min(1, intensity));
    const now = ctx.currentTime;
    try {
      // Subtle level swell: peak ranges from ~0.85x to ~1.0x of MASTER_PEAK.
      const target = MASTER_PEAK * (0.85 + 0.15 * x);
      // setTargetAtTime gives a smooth, click-free approach.
      master.gain.setTargetAtTime(target, now, 0.8);
    } catch (e) { /* ignore */ }
    try {
      // Open the lowpass a little as intensity rises (gentle, never harsh).
      const cutoff = BASE_CUTOFF + 360 * x; // up to ~1120 Hz
      filter.frequency.setTargetAtTime(cutoff, now, 1.2);
    } catch (e) { /* ignore */ }
  }

  function setIntensity(x) {
    if (typeof x !== "number" || !isFinite(x)) return;
    intensity = Math.max(0, Math.min(1, x));
    applyIntensity();
  }

  // ---- Voice helpers --------------------------------------------------------
  // Schedule one sustained pad voice: triangle/sine osc -> per-note gain -> filter.
  // Long attack & release so chords swell rather than click in.
  function schedulePad(freq, startT, dur, peak) {
    if (!alive) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = Math.random() < 0.5 ? "triangle" : "sine";
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() * 2 - 1) * 7; // +/- ~7 cents for warmth

      const g = ctx.createGain();
      g.gain.value = 0.0001;

      osc.connect(g);
      g.connect(filter);

      const attack = Math.min(3.0, dur * 0.4);
      const release = Math.min(3.5, dur * 0.45);
      const sustainEnd = startT + dur - release;

      // Click-free envelope: all ramps, start at ~0.
      g.gain.setValueAtTime(0.0001, startT);
      g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), startT + attack);
      if (sustainEnd > startT + attack) {
        g.gain.setValueAtTime(Math.max(0.0002, peak), sustainEnd);
      }
      g.gain.linearRampToValueAtTime(0.0001, startT + dur);

      osc.start(startT);
      osc.stop(startT + dur + 0.05);

      active.add(osc);
      const cleanup = () => {
        active.delete(osc);
        try { osc.disconnect(); } catch (e) {}
        try { g.disconnect(); } catch (e) {}
      };
      osc.onended = cleanup;
    } catch (e) { /* a single bad voice must not break the loop */ }
  }

  // Schedule one bright bell/twinkle: sine osc with quick-ish attack, long tail.
  function scheduleBell(freq, startT, peak) {
    if (!alive) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() * 2 - 1) * 5;

      const g = ctx.createGain();
      g.gain.value = 0.0001;

      // Bells go straight to master (bypass the dark pad filter) but stay quiet,
      // through their own gentle highpass-ish tone via low peak. Route via a small
      // dedicated lowpass so they're soft, not piercing.
      const bp = ctx.createBiquadFilter();
      bp.type = "lowpass";
      bp.frequency.value = 2600;
      bp.Q.value = 0.5;

      osc.connect(g);
      g.connect(bp);
      bp.connect(master);

      const attack = 0.08;
      const dur = 2.8 + Math.random() * 1.6; // long shimmering tail
      g.gain.setValueAtTime(0.0001, startT);
      g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), startT + attack);
      g.gain.exponentialRampToValueAtTime(0.0002, startT + dur);
      g.gain.linearRampToValueAtTime(0.0001, startT + dur + 0.05);

      osc.start(startT);
      osc.stop(startT + dur + 0.1);

      active.add(osc);
      const cleanup = () => {
        active.delete(osc);
        try { osc.disconnect(); } catch (e) {}
        try { g.disconnect(); } catch (e) {}
        try { bp.disconnect(); } catch (e) {}
      };
      osc.onended = cleanup;
    } catch (e) { /* ignore */ }
  }

  // ---- Generative scheduler -------------------------------------------------
  // `pointer` is the running time pointer (seconds, in ctx.currentTime space)
  // up to which we have already scheduled events.
  let pointer = ctx.currentTime + 0.15;
  let nextChordTime = pointer;
  let nextBellTime = pointer + 2.0 + Math.random() * 4.0;
  let lastChordIndex = -1;

  function pickChordIndex() {
    // Slow harmonic movement: pick a different voicing than last time.
    let idx = Math.floor(Math.random() * CHORDS.length);
    if (idx === lastChordIndex) idx = (idx + 1) % CHORDS.length;
    lastChordIndex = idx;
    return idx;
  }

  function scheduleChordAt(t) {
    const chord = CHORDS[pickChordIndex()];
    const period = CHORD_PERIOD_MIN + Math.random() * (CHORD_PERIOD_MAX - CHORD_PERIOD_MIN);
    // Overlap chords slightly so there's never a silent gap (cross-fade feel).
    const dur = period + 2.5;
    // Per-voice peak kept low; chord of 4 voices stays under master headroom.
    const perVoicePeak = 0.06;
    for (let i = 0; i < chord.length; i++) {
      // Stagger voice entries a touch for an organic bloom.
      const stagger = i * (0.15 + Math.random() * 0.25);
      schedulePad(chord[i], t + stagger, dur - stagger, perVoicePeak);
    }
    return period;
  }

  function tick() {
    if (!alive) return;
    try {
      const horizon = ctx.currentTime + SCHEDULE_AHEAD;

      // Schedule chord changes whose start falls within the horizon.
      while (nextChordTime < horizon) {
        const period = scheduleChordAt(nextChordTime);
        nextChordTime += period;
      }

      // Schedule sparse bell twinkles within the horizon.
      while (nextBellTime < horizon) {
        // Occasionally skip to keep them sparse and unpredictable.
        if (Math.random() < 0.7) {
          const freq = BELLS[Math.floor(Math.random() * BELLS.length)];
          const bellPeak = 0.035 + Math.random() * 0.03;
          scheduleBell(freq, nextBellTime, bellPeak);
        }
        // Next bell in a wide, irregular window.
        nextBellTime += 5.0 + Math.random() * 9.0;
      }

      // Advance the running pointer (kept for clarity / debugging).
      pointer = horizon;
    } catch (e) {
      // Never let a scheduling error kill the interval.
    }
  }

  // Kick off immediately, then on the lookahead interval.
  tick();
  let timer = setInterval(tick, LOOKAHEAD_MS);

  // ---- Teardown -------------------------------------------------------------
  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    alive = false;

    // Stop scheduling new events.
    try { if (timer) clearInterval(timer); } catch (e) {}
    timer = null;

    const now = ctx.currentTime;

    // Smooth fade of the local master to silence (no hard set, no click).
    try {
      master.gain.cancelScheduledValues(now);
      // Anchor at current value so the ramp starts cleanly.
      const cur = (typeof master.gain.value === "number") ? master.gain.value : MASTER_PEAK;
      master.gain.setValueAtTime(Math.max(0.0001, cur), now);
      master.gain.linearRampToValueAtTime(0.0001, now + 0.3);
    } catch (e) { /* ignore */ }

    // After the fade, stop every oscillator and disconnect everything.
    setTimeout(() => {
      try {
        const t = ctx.currentTime;
        active.forEach((osc) => {
          try { osc.onended = null; } catch (e) {}
          try { osc.stop(t); } catch (e) {}
          try { osc.disconnect(); } catch (e) {}
        });
        active.clear();
      } catch (e) {}

      try {
        disposables.forEach((n) => {
          try { n.disconnect(); } catch (e) {}
        });
        disposables.clear();
      } catch (e) {}
    }, 350);
  }

  // Apply any starting intensity (default 0 -> near-peak modest level).
  applyIntensity();

  return {
    stop,
    setIntensity,
  };
}
