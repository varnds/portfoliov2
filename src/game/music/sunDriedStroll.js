// sunDriedStroll.js
// "Sun-Dried Stroll" — an original, procedural, looping cozy-folk background tune.
// Warm desert-afternoon stroll: whistle lead, fingerpicked ukulele, brushed shaker, root bass.
// Web Audio API only. No audio files, no external libraries.
//
// export function createSunDriedStroll(ctx, dest)
//   ctx  = running AudioContext
//   dest = a GainNode connected toward the speakers; ALL output connects into dest.
//   returns { stop(), setIntensity(x) }

export function createSunDriedStroll(ctx, dest) {
  // ---- Defensive guard: if ctx/dest unusable, return an inert handle. ----
  const noop = { stop() {}, setIntensity() {} };
  if (!ctx || typeof ctx.createGain !== 'function' || !dest || typeof dest.connect !== 'function') {
    return noop;
  }

  const FLOOR = 0.0001; // exponential ramps target this, never 0.

  // ===================== Musical constants =====================
  const BPM = 92;                 // relaxed stroll
  const SPB = 60 / BPM;           // seconds per beat
  const STEPS_PER_BEAT = 2;       // eighth-note grid
  const STEP_DUR = SPB / STEPS_PER_BEAT;
  const STEPS_PER_BAR = STEPS_PER_BEAT * 4; // 4/4 -> 8 eighth steps per bar
  const SWING = 0.16;             // light lilt: delay the off-eighths a touch

  // Equal-temperament helper. A4 = 440.
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // G major. Note names -> midi (octave numbers standard, middle C = C4 = 60).
  const N = {
    G2: 43, D3: 50, E3: 52, G3: 55, A3: 57, B3: 59,
    C4: 60, D4: 62, E4: 64, FS4: 66, G4: 67, A4: 69, B4: 71,
    C5: 72, D5: 74, E5: 76, FS5: 78, G5: 79,
  };

  // Chord progression: G -> Em -> C -> D, one chord per bar (loops).
  // Each chord: { root (bass midi), tones: [arpeggio midi pool] }
  const PROG = [
    { root: N.G2, tones: [N.G3, N.B3, N.D4, N.G4] }, // G major
    { root: N.E3, tones: [N.E3, N.G3, N.B3, N.E4] }, // E minor
    { root: N.C4 - 12, tones: [N.C4, N.E4, N.G4, N.C5] }, // C major (root C3)
    { root: N.D3, tones: [N.D4, N.FS4, N.A4, N.D5] }, // D major
  ];

  // Fingerpicking pattern over the 8 eighth-steps of a bar.
  // Indices into chord.tones (gentle travis-ish roll), null = rest/space.
  // Plucks favor off-beats so the tune breathes.
  const PICK = [0, 2, 1, 3, 0, 2, 1, null];

  // Whistle melody: an original, simple strolling line spanning all 4 bars.
  // Lots of rests (null) so it breathes. Each entry on the eighth grid.
  // 4 bars * 8 steps = 32 steps.
  const MELODY = [
    // Bar 1 (over G): rise gently
    N.D4, null, N.G4, null, N.A4, null, N.B4, null,
    // Bar 2 (over Em): hang, then dip
    N.B4, null, null, N.A4, null, N.G4, null, null,
    // Bar 3 (over C): lift to the bright note, leave space
    N.E4, null, N.G4, null, N.C5, null, null, null,
    // Bar 4 (over D): turn the phrase home with a little lilt
    N.B4, null, N.A4, null, N.FS4, null, N.D4, null,
  ];

  // ===================== Local master =====================
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  // soft fade-in to working level
  master.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.8);
  master.connect(dest);

  // A gentle global lowpass to keep everything warm.
  const warmth = ctx.createBiquadFilter();
  warmth.type = 'lowpass';
  warmth.frequency.setValueAtTime(4200, ctx.currentTime);
  warmth.Q.setValueAtTime(0.6, ctx.currentTime);
  warmth.connect(master);

  // ===================== Intensity (the washer running) =====================
  // x in [0,1] lifts level + brightness subtly.
  let intensity = 0;
  function setIntensity(x) {
    try {
      let v = typeof x === 'number' && isFinite(x) ? x : 0;
      if (v < 0) v = 0;
      if (v > 1) v = 1;
      intensity = v;
      if (stopped) return;
      const now = ctx.currentTime;
      // master level: 0.18 .. 0.22 (peak target ~0.22)
      const level = 0.18 + 0.04 * intensity;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(master.gain.value, FLOOR), now);
      master.gain.setTargetAtTime(level, now, 0.4);
      // brightness: 4200 .. 5600 Hz
      const cutoff = 4200 + 1400 * intensity;
      warmth.frequency.cancelScheduledValues(now);
      warmth.frequency.setTargetAtTime(cutoff, now, 0.4);
    } catch (_) { /* ignore */ }
  }

  // ===================== Noise buffer (for shaker) =====================
  let noiseBuffer = null;
  try {
    const len = Math.floor(ctx.sampleRate * 0.2);
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  } catch (_) { noiseBuffer = null; }

  // ===================== Voice synths =====================

  // Safe stop+disconnect-on-ended helper for any source node.
  function autoCleanup(node, stopTime) {
    try {
      node.onended = () => { try { node.disconnect(); } catch (_) {} };
      node.stop(stopTime);
    } catch (_) {
      try { node.disconnect(); } catch (__) {}
    }
  }

  // WHISTLE lead: pure sine, gentle vibrato, soft attack + smooth release.
  function playWhistle(freq, t, dur, vel) {
    try {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      // vibrato (~5.5Hz, small depth), eased in so onset is pure
      const vib = ctx.createOscillator();
      vib.type = 'sine';
      vib.frequency.setValueAtTime(5.5, t);
      const vibGain = ctx.createGain();
      vibGain.gain.setValueAtTime(FLOOR, t);
      // depth in Hz scales with pitch a touch; small
      const depth = Math.max(2.2, freq * 0.006);
      vibGain.gain.exponentialRampToValueAtTime(depth, t + 0.18);
      vib.connect(vibGain);
      vibGain.connect(osc.frequency);

      const g = ctx.createGain();
      const peak = 0.16 * vel;
      g.gain.setValueAtTime(FLOOR, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.03);            // soft ~30ms attack
      g.gain.setTargetAtTime(peak * 0.7, t + 0.03, dur * 0.5);   // gentle sustain droop
      const relStart = t + Math.max(0.08, dur * 0.85);
      g.gain.setValueAtTime(Math.max(peak * 0.45, FLOOR), relStart);
      g.gain.exponentialRampToValueAtTime(FLOOR, t + dur + 0.18); // smooth release

      osc.connect(g);
      g.connect(warmth);

      const end = t + dur + 0.22;
      autoCleanup(osc, end);
      autoCleanup(vib, end);
      vib.start(t);
      osc.start(t);
    } catch (_) { /* ignore one note */ }
  }

  // UKULELE-ish pluck: 2 slightly detuned partials (triangle + saw) -> lowpass,
  // fast attack ~6ms + medium decay ~0.35s.
  function playPluck(freq, t, vel) {
    try {
      const g = ctx.createGain();
      const peak = 0.075 * vel;
      g.gain.setValueAtTime(FLOOR, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.006);          // fast attack
      g.gain.exponentialRampToValueAtTime(FLOOR, t + 0.35);     // medium decay

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2400, t);
      lp.frequency.exponentialRampToValueAtTime(900, t + 0.35); // pluck closes down
      lp.Q.setValueAtTime(0.7, t);

      const o1 = ctx.createOscillator();
      o1.type = 'triangle';
      o1.frequency.setValueAtTime(freq, t);
      const o2 = ctx.createOscillator();
      o2.type = 'sawtooth';
      o2.frequency.setValueAtTime(freq * 1.004, t); // slight detune
      const o2g = ctx.createGain();
      o2g.gain.setValueAtTime(0.45, t); // saw quieter for warmth

      o1.connect(lp);
      o2.connect(o2g);
      o2g.connect(lp);
      lp.connect(g);
      g.connect(warmth);

      const end = t + 0.4;
      autoCleanup(o1, end);
      autoCleanup(o2, end);
      o1.start(t);
      o2.start(t);
    } catch (_) { /* ignore */ }
  }

  // Low ROOT bass pluck on beat 1.
  function playBass(freq, t, vel) {
    try {
      const g = ctx.createGain();
      const peak = 0.13 * vel;
      g.gain.setValueAtTime(FLOOR, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.012);
      g.gain.exponentialRampToValueAtTime(FLOOR, t + 0.6);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(700, t);
      lp.frequency.exponentialRampToValueAtTime(220, t + 0.6);

      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq, t);

      o.connect(lp);
      lp.connect(g);
      g.connect(warmth);

      autoCleanup(o, t + 0.66);
      o.start(t);
    } catch (_) { /* ignore */ }
  }

  // BRUSHED SHAKER: highpassed noise burst, quiet, short decay ~0.05s.
  function playShaker(t, vel) {
    if (!noiseBuffer) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(5000, t);
      hp.Q.setValueAtTime(0.5, t);

      const g = ctx.createGain();
      const peak = 0.03 * vel;
      g.gain.setValueAtTime(FLOOR, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.005);
      g.gain.exponentialRampToValueAtTime(FLOOR, t + 0.05);

      src.connect(hp);
      hp.connect(g);
      g.connect(master); // shaker bypasses warmth lowpass to keep its air, but stays quiet

      const end = t + 0.12;
      src.onended = () => { try { src.disconnect(); } catch (_) {} };
      try { src.stop(end); } catch (_) { try { src.disconnect(); } catch (__) {} }
      src.start(t);
    } catch (_) { /* ignore */ }
  }

  // ===================== Scheduler (classic lookahead) =====================
  let stopped = false;
  let step = 0;                 // global eighth-step index
  let nextNoteTime = ctx.currentTime + 0.12;
  const LOOKAHEAD = 0.12;       // schedule window
  const TICK_MS = 25;           // setInterval cadence

  function scheduleStep(s, time) {
    try {
      const barIdx = Math.floor(s / STEPS_PER_BAR) % PROG.length;
      const inBar = s % STEPS_PER_BAR;        // 0..7
      const chord = PROG[barIdx];
      const intMul = 0.85 + 0.3 * intensity;  // subtle velocity lift with intensity

      // --- Bass on beat 1 of the bar ---
      if (inBar === 0) {
        playBass(midi(chord.root), time, 1.0 * intMul);
      }

      // --- Ukulele fingerpicking ---
      const pickIdx = PICK[inBar];
      if (pickIdx !== null && pickIdx !== undefined) {
        const tone = chord.tones[pickIdx % chord.tones.length];
        // off-beat eighths a touch softer & varied for a gentle roll
        const onBeat = inBar % 2 === 0;
        const vel = (onBeat ? 0.85 : 1.0) * intMul;
        playPluck(midi(tone), time, vel);
      }

      // --- Brushed shaker on the off-beats (the "and" of each beat) ---
      if (inBar % 2 === 1) {
        playShaker(time, (0.8 + 0.4 * intensity));
      }

      // --- Whistle melody (loops every 4 bars = 32 steps) ---
      const melIdx = s % MELODY.length;
      const note = MELODY[melIdx];
      if (note !== null && note !== undefined) {
        // length until next non-null melody event (so notes breathe & connect)
        let span = 1;
        for (let k = 1; k <= MELODY.length; k++) {
          const n2 = MELODY[(melIdx + k) % MELODY.length];
          if (n2 !== null && n2 !== undefined) break;
          span++;
        }
        const dur = span * STEP_DUR * 0.92;
        playWhistle(midi(note), time, dur, 1.0 * intMul);
      }
    } catch (_) { /* never let one step kill the loop */ }
  }

  function advance() {
    // swing: delay off-eighths slightly for the lilt
    const isOff = step % 2 === 1;
    nextNoteTime += STEP_DUR * (isOff ? 1 - SWING : 1 + SWING);
    step++;
  }

  let intervalId = null;
  function tick() {
    if (stopped) return;
    try {
      while (nextNoteTime < ctx.currentTime + LOOKAHEAD) {
        // schedule the off-swing offset into the actual time we pass down
        const isOff = step % 2 === 1;
        const swingOffset = isOff ? STEP_DUR * SWING : 0;
        scheduleStep(step, nextNoteTime + swingOffset);
        advance();
      }
    } catch (_) { /* keep looping */ }
  }

  try {
    intervalId = setInterval(tick, TICK_MS);
    tick(); // prime immediately
  } catch (_) {
    return noop;
  }

  // ===================== Teardown =====================
  function stop() {
    if (stopped) return; // idempotent
    stopped = true;
    try {
      if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
    } catch (_) {}
    try {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(master.gain.value, FLOOR), now);
      master.gain.linearRampToValueAtTime(FLOOR, now + 0.3); // ramp to ~0 over 0.3s
    } catch (_) {}
    setTimeout(() => {
      try { master.disconnect(); } catch (_) {}
      try { warmth.disconnect(); } catch (_) {}
    }, 350);
  }

  return { stop, setIntensity };
}
