// musicBox.js — procedural "Cozy Music Box" background music.
//
// A sparse, whimsical wind-up music box / celeste lullaby built entirely with
// the Web Audio API (no audio files, no external libraries).
//
//   export function createMusicBox(ctx, dest)
//     -> { stop(), setIntensity(x) }
//
// `ctx`  : a running AudioContext.
// `dest` : a GainNode already connected toward the speakers. Every node we make
//          routes its output into `dest`, so the host controls overall level.
//
// Design notes / quality rules honored here:
//   * Every gain change is a ramp (linearRampToValueAtTime / setTargetAtTime /
//     exponentialRampToValueAtTime). We never assign `.value` at a running time;
//     the only direct sets happen at construction before anything is scheduled.
//   * Bell envelope: very fast bright attack, then a long smooth decay toward ~0.
//   * Every oscillator gets an explicit osc.stop(t) after it decays.
//   * A lookahead scheduler (setInterval ~120ms) queues notes ~0.4s ahead using
//     a running time pointer derived from ctx.currentTime.
//   * Local master gain stays modest (peak ~0.25).
//   * Everything is wrapped defensively so a bad value can never throw.

export function createMusicBox(ctx, dest) {
  // ---- Defensive no-op fallback ------------------------------------------
  // If we can't get a usable context/destination, return a harmless stub so
  // callers never crash.
  if (!ctx || typeof ctx.createGain !== 'function' || !dest) {
    return { stop() {}, setIntensity() {} };
  }

  const SAFE = (n, fallback) =>
    typeof n === 'number' && isFinite(n) ? n : fallback;
  const clamp01 = (x) => Math.min(1, Math.max(0, SAFE(x, 0)));

  // ---- Local master + a gentle "sparkle" send ----------------------------
  // master: overall level of this music box (peaks ~0.25).
  // A small highpass-ish brightness send rides on intensity.
  let master = null;
  let sparkleGain = null;
  try {
    master = ctx.createGain();
    master.gain.value = 0.0001; // start near-silent; we fade up below.
    master.connect(dest);
  } catch (e) {
    return { stop() {}, setIntensity() {} };
  }

  const PEAK = 0.25; // local master ceiling

  // Fade the whole instrument in smoothly at start.
  const t0 = SAFE(ctx.currentTime, 0);
  try {
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.exponentialRampToValueAtTime(PEAK, t0 + 1.5);
  } catch (e) {
    /* ignore */
  }

  // ---- Musical material ---------------------------------------------------
  // C major pentatonic across two octaves: C D E G A (C4..A5).
  // Frequencies (equal temperament, A4 = 440).
  const SCALE = [
    261.63, // C4
    293.66, // D4
    329.63, // E4
    392.0,  // G4
    440.0,  // A4
    523.25, // C5
    587.33, // D5
    659.25, // E5
    783.99, // G5
    880.0,  // A5
  ];
  // Low roots for occasional grounding (C3, G2).
  const LOW_ROOTS = [130.81, 98.0];

  // Tempo: slow + gentle. One "step" = an eighth-ish pulse with lots of rests.
  const STEP = 0.5; // seconds per step (~120 bpm eighths, but mostly rests)

  // ---- Intensity ----------------------------------------------------------
  let intensity = 0;

  // ---- Scheduler state ----------------------------------------------------
  let nextNoteTime = t0 + 0.25; // running pointer; when the next step plays
  let stepIndex = 0;
  const LOOKAHEAD = 0.4;        // schedule this far ahead (s)
  const INTERVAL_MS = 120;      // how often the scheduler wakes (ms)

  // Track active oscillators so stop() can tear everything down cleanly.
  const activeNodes = new Set();
  let stopped = false;

  // A tiny deterministic-ish randomness helper that stays whimsical but bounded.
  const rand = () => Math.random();

  // ---- Bell voice ---------------------------------------------------------
  // A single music-box "ding": sine fundamental + quiet 2x partial, fast bright
  // attack, long bell-like exponential decay, tiny detune shimmer.
  function playBell(freq, when, velocity) {
    if (stopped) return;
    const f = SAFE(freq, 440);
    const startT = Math.max(SAFE(when, 0), SAFE(ctx.currentTime, 0) + 0.001);
    const vel = clamp01(velocity);
    if (vel <= 0) return;

    // Bell decay length scales a little with intensity (more sparkle -> a touch
    // longer ring), kept within ~0.6..1.2s.
    const decay = 0.6 + 0.6 * clamp01(0.3 + intensity * 0.7);

    let osc, partial, vGain, pGain;
    try {
      osc = ctx.createOscillator();
      vGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, startT);
      // tiny detune shimmer for a hand-wound feel
      osc.detune.setValueAtTime((rand() - 0.5) * 7, startT);

      // Envelope: very fast attack, long smooth exponential decay to ~0.
      const peak = Math.max(0.0008, vel * 0.22);
      vGain.gain.setValueAtTime(0.0001, startT);
      vGain.gain.linearRampToValueAtTime(peak, startT + 0.006); // bright attack
      // exponential settle gives the natural bell shape...
      vGain.gain.setTargetAtTime(0.0001, startT + 0.02, decay * 0.35);
      // ...and a guaranteed hard floor so it truly reaches ~0 before stop().
      vGain.gain.exponentialRampToValueAtTime(0.0001, startT + decay);

      osc.connect(vGain);
      vGain.connect(master);

      // Quiet 2x partial adds bell brightness; louder as intensity rises.
      const partialAmt = 0.12 + 0.18 * intensity; // 0.12..0.30 of fundamental
      partial = ctx.createOscillator();
      pGain = ctx.createGain();
      partial.type = 'sine';
      partial.frequency.setValueAtTime(f * 2, startT);
      partial.detune.setValueAtTime((rand() - 0.5) * 9, startT);
      const pPeak = Math.max(0.0004, peak * partialAmt);
      pGain.gain.setValueAtTime(0.0001, startT);
      pGain.gain.linearRampToValueAtTime(pPeak, startT + 0.004);
      pGain.gain.setTargetAtTime(0.0001, startT + 0.015, decay * 0.22);
      pGain.gain.exponentialRampToValueAtTime(0.0001, startT + decay * 0.8);
      partial.connect(pGain);
      pGain.connect(master);

      const stopT = startT + decay + 0.05;
      osc.start(startT);
      partial.start(startT);
      osc.stop(stopT);
      partial.stop(stopT);

      const group = { nodes: [osc, partial, vGain, pGain] };
      activeNodes.add(group);
      const cleanup = () => {
        try { vGain.disconnect(); } catch (e) {}
        try { pGain.disconnect(); } catch (e) {}
        try { osc.disconnect(); } catch (e) {}
        try { partial.disconnect(); } catch (e) {}
        activeNodes.delete(group);
      };
      osc.onended = cleanup;
    } catch (e) {
      // Clean up whatever we managed to create.
      try { osc && osc.disconnect(); } catch (_) {}
      try { partial && partial.disconnect(); } catch (_) {}
      try { vGain && vGain.disconnect(); } catch (_) {}
      try { pGain && pGain.disconnect(); } catch (_) {}
    }
  }

  // ---- Low grounding root -------------------------------------------------
  // A soft, longer, lower sine to anchor the harmony now and then.
  function playLowRoot(freq, when) {
    if (stopped) return;
    const f = SAFE(freq, 130.81);
    const startT = Math.max(SAFE(when, 0), SAFE(ctx.currentTime, 0) + 0.001);
    let osc, g;
    try {
      osc = ctx.createOscillator();
      g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, startT);
      const peak = 0.07;
      g.gain.setValueAtTime(0.0001, startT);
      g.gain.linearRampToValueAtTime(peak, startT + 0.04); // soft attack
      g.gain.setTargetAtTime(0.0001, startT + 0.1, 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, startT + 2.0);
      osc.connect(g);
      g.connect(master);

      const stopT = startT + 2.1;
      osc.start(startT);
      osc.stop(stopT);
      const group = { nodes: [osc, g] };
      activeNodes.add(group);
      osc.onended = () => {
        try { g.disconnect(); } catch (e) {}
        try { osc.disconnect(); } catch (e) {}
        activeNodes.delete(group);
      };
    } catch (e) {
      try { osc && osc.disconnect(); } catch (_) {}
      try { g && g.disconnect(); } catch (_) {}
    }
  }

  // ---- Step logic: a sparse, nostalgic pentatonic melody ------------------
  // We walk the scale with gentle steps and lots of rests. Probability of a
  // note (vs a rest) rises a little with intensity so it feels more alive.
  let melodyPos = 5; // start around C5
  function scheduleStep(when) {
    const step = stepIndex;

    // Occasional low root to ground the phrase — every 16 steps, softly.
    if (step % 16 === 0) {
      const root = LOW_ROOTS[(step / 16) % 2 === 0 ? 0 : 1] || LOW_ROOTS[0];
      playLowRoot(root, when);
    }

    // Note-vs-rest. Base sparse; intensity adds a touch more density + sparkle.
    const noteChance = 0.42 + 0.22 * intensity; // 0.42..0.64
    const wantNote = rand() < noteChance;

    if (wantNote) {
      // Gentle melodic motion: mostly small steps, occasional small leap.
      const r = rand();
      let move;
      if (r < 0.5) move = rand() < 0.5 ? 1 : -1;
      else if (r < 0.8) move = 0; // repeat note (music-box charm)
      else move = rand() < 0.5 ? 2 : -2;
      melodyPos += move;
      // Reflect off the edges so we stay in range without abrupt jumps.
      if (melodyPos < 0) melodyPos = 1;
      if (melodyPos > SCALE.length - 1) melodyPos = SCALE.length - 2;

      const freq = SCALE[melodyPos] || 523.25;
      // Velocity: gentle, slightly louder on phrase starts, lifted by intensity.
      const accent = step % 8 === 0 ? 0.15 : 0;
      const velocity = 0.45 + accent + 0.25 * intensity + (rand() - 0.5) * 0.1;
      playBell(freq, when, velocity);

      // Sparkle: as intensity rises, occasionally add a soft high octave grace
      // note shortly after, for shimmer.
      if (intensity > 0.25 && rand() < 0.18 + intensity * 0.25) {
        const hi = (SCALE[Math.min(SCALE.length - 1, melodyPos + 5)] || freq * 2);
        playBell(hi, when + STEP * 0.5, velocity * 0.4);
      }
    }
    // else: a rest — silence is part of the vibe.
  }

  // ---- Lookahead scheduler ------------------------------------------------
  let timer = null;
  function schedulerTick() {
    if (stopped) return;
    const now = SAFE(ctx.currentTime, 0);
    // Guard against a stalled/suspended clock so we don't flood the graph.
    if (nextNoteTime < now) nextNoteTime = now + 0.05;

    let safety = 0;
    while (nextNoteTime < now + LOOKAHEAD && safety < 64) {
      scheduleStep(nextNoteTime);
      nextNoteTime += STEP;
      stepIndex++;
      safety++;
    }
  }

  try {
    // Kick once immediately so audio starts without waiting a full interval.
    schedulerTick();
    timer = setInterval(schedulerTick, INTERVAL_MS);
  } catch (e) {
    /* ignore — stop() still safe */
  }

  // ---- Public API ---------------------------------------------------------
  function setIntensity(x) {
    intensity = clamp01(x);
    // Subtle level lift with intensity (kept under PEAK). Gentle ramp, no clicks.
    try {
      const now = SAFE(ctx.currentTime, 0);
      const target = PEAK * (0.8 + 0.2 * intensity); // 0.20..0.25
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(target, now, 0.6);
    } catch (e) {
      /* ignore */
    }
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    try {
      if (timer !== null) clearInterval(timer);
    } catch (e) {}
    timer = null;

    const now = SAFE(ctx.currentTime, 0);
    // Ramp local master to ~0 over ~0.3s, then tear everything down.
    try {
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value || 0.0001), now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    } catch (e) {
      /* ignore */
    }

    const teardown = () => {
      activeNodes.forEach((group) => {
        if (!group || !group.nodes) return;
        group.nodes.forEach((n) => {
          try { if (typeof n.stop === 'function') n.stop(); } catch (e) {}
          try { n.disconnect(); } catch (e) {}
        });
      });
      activeNodes.clear();
      try { master.disconnect(); } catch (e) {}
    };

    // Let the fade finish, then disconnect. Guard with try/catch.
    try {
      setTimeout(teardown, 360);
    } catch (e) {
      teardown();
    }
  }

  return { stop, setIntensity };
}
