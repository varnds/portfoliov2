// sunlitHum.js — procedural "Sunlit Hum" generative background music.
//
// A gentle, hopeful, folk-ish fingerpicked piece built entirely with the
// Web Audio API (no audio files, no external libs). A soft plucked arpeggio
// cycles a warm I–V–vi–IV progression in C major / pentatonic, over a quiet
// sustained root drone. Light, airy, warm-afternoon vibe.
//
// Contract:
//   export function createSunlitHum(ctx, dest) -> { stop(), setIntensity(x) }
//   - ctx: a running AudioContext
//   - dest: a GainNode already connected toward the speakers
//   - connects ALL nodes into `dest`
//   - lookahead scheduler (setInterval ~120ms) schedules notes ~0.4s ahead
//   - stop(): ramp local master to 0 over ~0.3s, then stop/disconnect; idempotent
//   - setIntensity(x in [0,1]): gently raise level + a touch of brightness

export function createSunlitHum(ctx, dest) {
  // --- defensive guards: never throw on a bad context/dest ---------------
  if (!ctx || typeof ctx.createGain !== 'function') {
    return { stop() {}, setIntensity() {} };
  }

  const now0 = () => {
    const t = ctx.currentTime;
    return Number.isFinite(t) ? t : 0;
  };

  const clamp = (v, lo, hi) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return lo;
    return n < lo ? lo : n > hi ? hi : n;
  };

  // --- local master + a gentle low-pass for "airy, warm" ----------------
  const master = ctx.createGain();
  master.gain.value = 0.0001; // start near-silent; fade in below

  // Soft low-pass keeps everything mellow; brightness opens slightly with intensity.
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2600;
  tone.Q.value = 0.0001;

  // A touch of high-shelf "shimmer" we lift very subtly with intensity.
  const air = ctx.createBiquadFilter();
  air.type = 'highshelf';
  air.frequency.value = 3500;
  air.gain.value = 0; // dB

  tone.connect(air);
  air.connect(master);
  try {
    master.connect(dest);
  } catch {
    // If dest is unusable, fall back to a no-op handle.
    return { stop() {}, setIntensity() {} };
  }

  // Fade the local master up gently to a modest peak (~0.22).
  let basePeak = 0.18; // raised slightly by intensity, capped well under 0.25
  const startT = now0();
  try {
    master.gain.setValueAtTime(0.0001, startT);
    master.gain.exponentialRampToValueAtTime(basePeak, startT + 1.2);
  } catch {
    /* ignore */
  }

  // --- musical material --------------------------------------------------
  // C major. I–V–vi–IV = C, G, Am, F. Pentatonic-flavoured arpeggio tones.
  // Frequencies (Hz). Each chord = a set of upper voices for the pluck
  // arpeggio plus a bass root for the drone.
  const CHORDS = [
    { root: 65.41, // C2
      arp: [261.63, 329.63, 392.0, 523.25, 392.0, 329.63] }, // C E G C' G E
    { root: 49.0, // G1
      arp: [246.94, 293.66, 392.0, 587.33, 392.0, 293.66] }, // B D G D' G D
    { root: 55.0, // A1
      arp: [220.0, 329.63, 440.0, 659.25, 440.0, 329.63] },  // A E A' E' A' E
    { root: 43.65, // F1
      arp: [261.63, 349.23, 440.0, 523.25, 440.0, 349.23] }, // C F A C' A F
  ];

  // Tempo: ~72 BPM feel. We place arpeggio plucks on eighth-ish subdivisions.
  const BPM = 72;
  const beatDur = 60 / BPM;        // ~0.833s per beat
  const stepDur = beatDur / 2;     // eighth notes -> ~0.417s per pluck
  const stepsPerChord = 8;         // 4 beats per chord

  // --- drone: one sustained, detuned root voice per chord ----------------
  // We keep a single managed pair of oscillators and just re-target their
  // frequency on chord changes (cheaper + smoother than spawning per chord).
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.0001;
  droneGain.connect(tone);

  const droneOscs = [];
  let droneOk = true;
  try {
    for (let i = 0; i < 2; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = CHORDS[0].root;
      o.detune.value = i === 0 ? -4 : 4; // slight detune for warmth
      o.connect(droneGain);
      o.start(startT);
      droneOscs.push(o);
    }
    // gentle drone level (quiet warmth underneath)
    droneGain.gain.setValueAtTime(0.0001, startT);
    droneGain.gain.exponentialRampToValueAtTime(0.09, startT + 2.0);
  } catch {
    droneOk = false;
  }

  // Track active pluck nodes so we can stop them on teardown.
  const activeVoices = new Set();

  // Schedule one plucked note. Triangle/sine with quick attack + exp decay.
  function pluck(freq, t, dur, vel) {
    if (!Number.isFinite(freq) || freq <= 0) return;
    if (!Number.isFinite(t)) return;
    const when = Math.max(t, now0());

    let osc, vca;
    try {
      osc = ctx.createOscillator();
      vca = ctx.createGain();
    } catch {
      return;
    }

    // Mix triangle body with a hint of sine handled by filter; triangle gives
    // a soft folk pluck. Slight detune per-note for organic warmth.
    osc.type = 'triangle';
    try {
      osc.frequency.setValueAtTime(freq, when);
    } catch {
      try { osc.frequency.value = freq; } catch { /* ignore */ }
    }
    try {
      osc.detune.setValueAtTime((Math.random() - 0.5) * 8, when);
    } catch {
      /* ignore */
    }

    const peak = clamp(0.16 * (vel ?? 1), 0.0001, 0.22);
    const attack = 0.010; // ~10ms quick attack
    const decay = Math.max(0.4, dur); // 0.4–0.8s percussive decay

    // Envelope: quick linear attack, then exponential-ish decay to near 0.
    try {
      vca.gain.setValueAtTime(0.0001, when);
      vca.gain.linearRampToValueAtTime(peak, when + attack);
      vca.gain.exponentialRampToValueAtTime(0.0006, when + attack + decay);
      // hard floor ramp so it truly reaches ~0 before we stop the node
      vca.gain.linearRampToValueAtTime(0.0, when + attack + decay + 0.05);
    } catch {
      /* ignore */
    }

    try {
      osc.connect(vca);
      vca.connect(tone);
    } catch {
      return;
    }

    const stopT = when + attack + decay + 0.08;
    try {
      osc.start(when);
      osc.stop(stopT); // always schedule a stop so nodes don't accumulate
    } catch {
      /* ignore */
    }

    activeVoices.add(osc);
    osc.onended = () => {
      activeVoices.delete(osc);
      try { vca.disconnect(); } catch { /* ignore */ }
      try { osc.disconnect(); } catch { /* ignore */ }
    };
  }

  // --- lookahead scheduler ----------------------------------------------
  const LOOKAHEAD_MS = 120;     // run the scheduler every ~120ms
  const SCHEDULE_AHEAD = 0.4;   // schedule notes within the next ~0.4s

  let nextNoteTime = startT + 0.25; // running pointer for the next pluck
  let stepIndex = 0;                // global step counter

  function scheduleStep(step, when) {
    const chordIndex = Math.floor(step / stepsPerChord) % CHORDS.length;
    const chord = CHORDS[chordIndex];
    const localStep = step % stepsPerChord;

    // Re-target the drone roots at the start of each chord.
    if (droneOk && localStep === 0) {
      for (let i = 0; i < droneOscs.length; i++) {
        try {
          droneOscs[i].frequency.setTargetAtTime(chord.root, when, 0.25);
        } catch {
          /* ignore */
        }
      }
    }

    // Arpeggio: cycle through the chord's tones, gentle velocity sway.
    const arp = chord.arp;
    const note = arp[localStep % arp.length];

    // Soft accent on beat (every 2 steps); lighter on off-beats.
    const onBeat = localStep % 2 === 0;
    const vel = onBeat ? 0.95 : 0.7;
    // pluck duration varies a touch for life (0.45–0.75s)
    const dur = 0.45 + (onBeat ? 0.28 : 0.12);

    pluck(note, when, dur, vel);

    // Occasionally add a soft higher octave sparkle on downbeats.
    if (localStep === 0) {
      pluck(note * 2, when + 0.012, 0.6, 0.4);
    }
  }

  let timer = null;
  function tick() {
    const horizon = now0() + SCHEDULE_AHEAD;
    // Schedule every note whose start falls within the lookahead window.
    let guard = 0;
    while (nextNoteTime < horizon && guard < 64) {
      scheduleStep(stepIndex, nextNoteTime);
      nextNoteTime += stepDur;
      stepIndex++;
      guard++;
    }
  }

  try {
    timer = setInterval(tick, LOOKAHEAD_MS);
  } catch {
    timer = null;
  }
  // run one pass immediately so sound begins promptly
  tick();

  // --- intensity ---------------------------------------------------------
  function setIntensity(x) {
    const v = clamp(x, 0, 1);
    const t = now0();
    // Raise master peak modestly (0.18 -> ~0.24), staying under 0.25.
    basePeak = 0.18 + 0.06 * v;
    try {
      master.gain.setTargetAtTime(clamp(basePeak, 0.0001, 0.24), t, 0.4);
    } catch {
      /* ignore */
    }
    // Open the low-pass a touch + lift air shelf gently for brightness.
    try {
      tone.frequency.setTargetAtTime(2600 + 1400 * v, t, 0.5);
    } catch {
      /* ignore */
    }
    try {
      air.gain.setTargetAtTime(2.5 * v, t, 0.5); // up to +2.5 dB shimmer
    } catch {
      /* ignore */
    }
    // A little more warmth in the drone as it grows.
    try {
      droneGain.gain.setTargetAtTime(0.09 + 0.03 * v, t, 0.5);
    } catch {
      /* ignore */
    }
  }

  // --- stop --------------------------------------------------------------
  let stopped = false;
  function stop() {
    if (stopped) return; // safe to call once
    stopped = true;

    if (timer !== null) {
      try { clearInterval(timer); } catch { /* ignore */ }
      timer = null;
    }

    const t = now0();
    // Ramp local master to ~0 over ~0.3s, then stop/disconnect everything.
    try {
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value || 0.0001), t);
      master.gain.linearRampToValueAtTime(0.0, t + 0.3);
    } catch {
      /* ignore */
    }
    try {
      droneGain.gain.cancelScheduledValues(t);
      droneGain.gain.linearRampToValueAtTime(0.0, t + 0.3);
    } catch {
      /* ignore */
    }

    const killAt = t + 0.32;

    // Stop drones.
    for (const o of droneOscs) {
      try { o.stop(killAt); } catch { /* ignore */ }
    }
    // Stop any still-active plucks.
    for (const o of activeVoices) {
      try { o.stop(killAt); } catch { /* ignore */ }
    }

    // Disconnect after the fade so we don't cut audio abruptly.
    const cleanup = () => {
      for (const o of droneOscs) {
        try { o.disconnect(); } catch { /* ignore */ }
      }
      for (const o of activeVoices) {
        try { o.disconnect(); } catch { /* ignore */ }
      }
      activeVoices.clear();
      try { droneGain.disconnect(); } catch { /* ignore */ }
      try { tone.disconnect(); } catch { /* ignore */ }
      try { air.disconnect(); } catch { /* ignore */ }
      try { master.disconnect(); } catch { /* ignore */ }
    };

    try {
      setTimeout(cleanup, 380);
    } catch {
      cleanup();
    }
  }

  return { stop, setIntensity };
}
