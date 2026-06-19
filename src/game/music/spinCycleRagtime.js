// spinCycleRagtime.js — procedural "Spin Cycle Ragtime" background music.
//
// A bouncy, quirky, cute-but-slightly-spooky ragtime-flavored loop in the
// spirit of Laura Shigihara's Plants vs. Zombies tunes — but an ORIGINAL
// melody, composed here, not copied from any real song. Built entirely with
// the Web Audio API (no audio files, no external libraries).
//
//   export function createSpinCycleRagtime(ctx, dest)
//     -> { stop(), setIntensity(x) }
//
// `ctx`  : a running AudioContext.
// `dest` : a GainNode already connected toward the speakers. Every node we make
//          routes its output into a local master which connects into `dest`,
//          so the host keeps overall control.
//
// Design / quality rules honored here:
//   * Classic lookahead scheduler: a setInterval (~25ms) that, while
//     nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD, schedules the current
//     16th-note step and advances nextNoteTime. Loops forever.
//   * Every gain change is a ramp. We only setValueAtTime at a note's start,
//     then linearRamp / setTargetAtTime / exponentialRampToValueAtTime. We
//     never assign `.value` at a running time, and exponential ramps always
//     target a ~0.0001 floor (never 0).
//   * Staccato voices: fast attack, quick decay (~0.18–0.25s for the melody).
//   * Every oscillator gets an explicit osc.stop(t); nodes disconnect on
//     `ended` so the graph never accumulates.
//   * Local master peak ~0.22; voice levels balanced so it doesn't clip.
//   * Fully defensive: a no-op handle if ctx/dest are unusable, guarded
//     numeric inputs, and try/catch around scheduling + teardown.

export function createSpinCycleRagtime(ctx, dest) {
  // ---- Defensive no-op fallback ------------------------------------------
  if (!ctx || typeof ctx.createGain !== 'function' || !dest) {
    return { stop() {}, setIntensity() {} };
  }

  const SAFE = (n, fallback) =>
    typeof n === 'number' && isFinite(n) ? n : fallback;
  const clamp01 = (x) => Math.min(1, Math.max(0, SAFE(x, 0)));

  // ---- Local master ------------------------------------------------------
  // Everything routes into `master`, which fades in at start and out on stop.
  const PEAK = 0.22; // local master ceiling — balanced to avoid clipping.
  let master = null;
  let melLP = null; // shared lowpass coloring the plucked melody
  try {
    master = ctx.createGain();
    master.gain.value = 0.0001; // start near-silent; we fade up below.
    master.connect(dest);

    // A gentle lowpass that gives the melody its rounded "plucked" tone.
    melLP = ctx.createBiquadFilter();
    melLP.type = 'lowpass';
    melLP.frequency.value = 2600;
    melLP.Q.value = 0.6;
    melLP.connect(master);
  } catch (e) {
    return { stop() {}, setIntensity() {} };
  }

  const t0 = SAFE(ctx.currentTime, 0);
  try {
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.exponentialRampToValueAtTime(PEAK * 0.85, t0 + 1.2);
  } catch (e) {
    /* ignore */
  }

  // ---- Pitch helpers -----------------------------------------------------
  // Semitone offsets relative to C; convert to frequency. C major home, with
  // playful chromatic mischief (flat-6 = Ab, and a brief A-minor turn).
  const A4 = 440;
  const midiToFreq = (m) => A4 * Math.pow(2, (m - 69) / 12);
  // We work in MIDI note numbers. C4 = 60.
  const C = 60;

  // ---- The HOOK ----------------------------------------------------------
  // Composed melody as MIDI offsets from C4 plus a duration in 16th steps.
  // null = a rest. The hook is a hopping, staccato phrase with a cheeky
  // chromatic passing wiggle (the +1 between E and ... etc). Two 2-bar
  // phrases (A then A') so it answers itself, then leaves room to breathe.
  //
  // Offsets: 0=C 2=D 4=E 5=F 7=G 9=A 11=B 12=C5 ; -1=B3, etc.
  // Chromatic mischief: 3 = Eb (flat-3 wink), 8 = Ab (flat-6), 1 = C#.
  const REST = null;
  // Each entry: [offsetFromC4 or REST, durationInSteps]
  const HOOK_A = [
    [7, 1], [9, 1], [12, 2],   // G A  C(hop)
    [11, 1], [12, 1], [9, 2],  // B C  A
    [7, 1], [8, 1], [9, 1], [7, 1], // G Ab A G  (flat-6 chromatic wiggle)
    [4, 2], [REST, 2],         // E ... rest
  ];
  const HOOK_A2 = [
    [7, 1], [9, 1], [12, 2],   // G A  C
    [11, 1], [12, 1], [14, 2], // B C  D
    [16, 1], [15, 1], [14, 1], [12, 1], // E Eb D C (chromatic descent wiggle)
    [11, 2], [REST, 2],        // B ... rest
  ];
  // A contrasting B section that flirts with A-minor (cute, not dark):
  // built around A and using G#(8) as the leading tone for the wink.
  const HOOK_B = [
    [9, 1], [12, 1], [9, 1], [7, 1],  // A C A G
    [8, 2], [9, 2],                   // Ab(wink) -> A
    [4, 1], [5, 1], [7, 1], [9, 1],   // E F G A
    [7, 2], [REST, 2],                // G ... rest
  ];

  // Phrase order across one loop. Variation comes from a per-loop transform
  // applied in scheduleMelody (octave pops, grace notes, ornaments).
  const PHRASES = [HOOK_A, HOOK_A2, HOOK_B, HOOK_A2];

  // ---- Stride / oom-pah bass --------------------------------------------
  // Chord roots per bar (MIDI offset from C, low octave) and a chord "blip"
  // for the off-beats. A simple cute progression: C  Am  F  G  (I vi IV V)
  // with the vi giving the brief minor turn.
  const CHORDS = [
    { rootLow: C - 24, blip: [C, C + 4, C + 7] },        // C major
    { rootLow: C - 24 + 9, blip: [C + 9, C + 12, C + 16] }, // A minor (A C E)
    { rootLow: C - 24 + 5, blip: [C + 5, C + 9, C + 12] },  // F major
    { rootLow: C - 24 + 7, blip: [C + 7, C + 11, C + 14] }, // G major
  ];

  // ---- Tempo / timing ----------------------------------------------------
  // ~120 BPM. One beat = 0.5s; a 16th step = 0.125s. We use light swing on the
  // off-16ths for a springy ragtime bounce.
  const BPM = 120;
  const SECONDS_PER_BEAT = 60 / BPM;     // 0.5
  const STEP = SECONDS_PER_BEAT / 4;     // 0.125s per 16th
  const STEPS_PER_BAR = 16;
  const SWING = 0.55; // fraction of a step that "and"-16ths get nudged late.

  // ---- Intensity ---------------------------------------------------------
  let intensity = 0;

  // ---- Scheduler state ---------------------------------------------------
  let nextNoteTime = t0 + 0.15; // running pointer (the classic scheduler)
  let stepIndex = 0;            // absolute 16th-step counter since start
  const SCHEDULE_AHEAD = 0.12;  // schedule notes this far ahead (s)
  const INTERVAL_MS = 25;       // scheduler wakeup (ms)

  // Melody phrase cursor: which phrase, and how many steps into it.
  let phraseIdx = 0;
  let phraseStepPos = 0;     // step offset within current phrase
  let hookEventIdx = 0;      // index into the current phrase's event list
  let loopCount = 0;         // increments each time we wrap the phrase list

  // Track active node-groups so stop() can tear everything down cleanly.
  const activeNodes = new Set();
  let stopped = false;

  const rand = () => Math.random();

  // ---- Generic teardown registration ------------------------------------
  function register(group, lastOsc) {
    activeNodes.add(group);
    const cleanup = () => {
      if (group.nodes) {
        group.nodes.forEach((n) => {
          try { n.disconnect(); } catch (e) {}
        });
      }
      activeNodes.delete(group);
    };
    if (lastOsc) lastOsc.onended = cleanup;
    return cleanup;
  }

  // ---- Plucked / pizzicato melody voice ----------------------------------
  // Triangle+saw blend through the shared lowpass. Fast attack, quick decay
  // (~0.18–0.25s) => staccato hop. `dur` is informational; we always cut it
  // short for the staccato feel.
  function playPluck(midi, when, velocity, opts) {
    if (stopped) return;
    const o = opts || {};
    const f = SAFE(midiToFreq(midi), 440);
    const startT = Math.max(SAFE(when, 0), SAFE(ctx.currentTime, 0) + 0.001);
    const vel = clamp01(velocity);
    if (vel <= 0) return;

    // Staccato decay: 0.18..0.25s, a touch longer with intensity.
    const decay = 0.18 + 0.07 * clamp01(0.3 + intensity * 0.7);

    let oscTri, oscSaw, vGain, sGain;
    try {
      vGain = ctx.createGain();
      vGain.connect(melLP);

      const peak = Math.max(0.0008, vel * 0.16);
      vGain.gain.setValueAtTime(0.0001, startT);
      vGain.gain.linearRampToValueAtTime(peak, startT + 0.008); // fast attack
      // Quick exponential decay to a hard floor (staccato).
      vGain.gain.setTargetAtTime(0.0001, startT + 0.02, decay * 0.4);
      vGain.gain.exponentialRampToValueAtTime(0.0001, startT + decay);

      oscTri = ctx.createOscillator();
      oscTri.type = 'triangle';
      oscTri.frequency.setValueAtTime(f, startT);
      oscTri.detune.setValueAtTime((rand() - 0.5) * 5, startT);
      oscTri.connect(vGain);

      // A quieter saw layer adds the plucky "bite". Its own gain so it sits
      // under the triangle and we can balance it.
      sGain = ctx.createGain();
      sGain.gain.setValueAtTime(0.0001, startT);
      sGain.gain.linearRampToValueAtTime(peak * 0.45, startT + 0.006);
      sGain.gain.exponentialRampToValueAtTime(0.0001, startT + decay * 0.8);
      sGain.connect(vGain);

      oscSaw = ctx.createOscillator();
      oscSaw.type = 'sawtooth';
      oscSaw.frequency.setValueAtTime(f, startT);
      oscSaw.detune.setValueAtTime((rand() - 0.5) * 7, startT);
      oscSaw.connect(sGain);

      const stopT = startT + decay + 0.05;
      oscTri.start(startT);
      oscSaw.start(startT);
      oscTri.stop(stopT);
      oscSaw.stop(stopT);

      const group = { nodes: [oscTri, oscSaw, vGain, sGain] };
      register(group, oscTri);
    } catch (e) {
      try { oscTri && oscTri.disconnect(); } catch (_) {}
      try { oscSaw && oscSaw.disconnect(); } catch (_) {}
      try { vGain && vGain.disconnect(); } catch (_) {}
      try { sGain && sGain.disconnect(); } catch (_) {}
    }
    void o;
  }

  // ---- Stride bass: low root (beats 1 & 3) -------------------------------
  function playBassRoot(midi, when, velocity) {
    if (stopped) return;
    const f = SAFE(midiToFreq(midi), 65);
    const startT = Math.max(SAFE(when, 0), SAFE(ctx.currentTime, 0) + 0.001);
    const vel = clamp01(velocity);
    let osc, g;
    try {
      g = ctx.createGain();
      g.connect(master);
      const peak = Math.max(0.0008, vel * 0.20);
      g.gain.setValueAtTime(0.0001, startT);
      g.gain.linearRampToValueAtTime(peak, startT + 0.006); // punchy attack
      g.gain.setTargetAtTime(0.0001, startT + 0.02, 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, startT + 0.22); // short

      osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, startT);
      osc.connect(g);

      const stopT = startT + 0.26;
      osc.start(startT);
      osc.stop(stopT);
      register({ nodes: [osc, g] }, osc);
    } catch (e) {
      try { osc && osc.disconnect(); } catch (_) {}
      try { g && g.disconnect(); } catch (_) {}
    }
  }

  // ---- Stride bass: higher chord blip (beats 2 & 4) ----------------------
  function playChordBlip(midis, when, velocity) {
    if (stopped) return;
    const startT = Math.max(SAFE(when, 0), SAFE(ctx.currentTime, 0) + 0.001);
    const vel = clamp01(velocity);
    if (!Array.isArray(midis) || vel <= 0) return;
    // One shared envelope gain; each chord tone is a small osc into it.
    let g;
    const oscs = [];
    try {
      g = ctx.createGain();
      g.connect(master);
      const peak = Math.max(0.0006, vel * 0.085);
      g.gain.setValueAtTime(0.0001, startT);
      g.gain.linearRampToValueAtTime(peak, startT + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, startT + 0.16); // short blip

      midis.forEach((m) => {
        const f = SAFE(midiToFreq(m), 440);
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, startT);
        o.detune.setValueAtTime((rand() - 0.5) * 6, startT);
        o.connect(g);
        oscs.push(o);
      });

      const stopT = startT + 0.2;
      oscs.forEach((o) => { o.start(startT); o.stop(stopT); });
      register({ nodes: [...oscs, g] }, oscs[0]);
    } catch (e) {
      oscs.forEach((o) => { try { o.disconnect(); } catch (_) {} });
      try { g && g.disconnect(); } catch (_) {}
    }
  }

  // ---- Hand clap on backbeats -------------------------------------------
  // Two quick filtered-noise bursts layered for a fuller clap (~1.2–1.8kHz).
  function playClap(when, velocity) {
    if (stopped) return;
    const startT = Math.max(SAFE(when, 0), SAFE(ctx.currentTime, 0) + 0.001);
    const vel = clamp01(velocity);
    if (vel <= 0) return;

    const makeBurst = (offset, amp, dur) => {
      let src, bp, g;
      try {
        const len = Math.max(1, Math.floor((dur + 0.02) * ctx.sampleRate));
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1);
        src = ctx.createBufferSource();
        src.buffer = buf;

        bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1200 + Math.random() * 600; // 1.2–1.8 kHz
        bp.Q.value = 1.1;

        g = ctx.createGain();
        const peak = Math.max(0.0006, amp);
        const s = startT + offset;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.linearRampToValueAtTime(peak, s + 0.002); // very fast attack
        g.gain.exponentialRampToValueAtTime(0.0001, s + dur);

        src.connect(bp);
        bp.connect(g);
        g.connect(master);

        const stopT = s + dur + 0.03;
        src.start(s);
        src.stop(stopT);
        register({ nodes: [src, bp, g] }, src);
      } catch (e) {
        try { src && src.disconnect(); } catch (_) {}
        try { bp && bp.disconnect(); } catch (_) {}
        try { g && g.disconnect(); } catch (_) {}
      }
    };

    // Two bursts a hair apart => a clap, not a snap.
    makeBurst(0, vel * 0.10, 0.05);
    makeBurst(0.012, vel * 0.085, 0.06);
  }

  // ---- Comedy counter-stab / "wah" --------------------------------------
  // A short pitch-bent, lowpass-swept stab for comic punctuation. Occasional.
  function playWah(midi, when, velocity) {
    if (stopped) return;
    const f = SAFE(midiToFreq(midi), 220);
    const startT = Math.max(SAFE(when, 0), SAFE(ctx.currentTime, 0) + 0.001);
    const vel = clamp01(velocity);
    if (vel <= 0) return;
    let osc, lp, g;
    try {
      g = ctx.createGain();
      lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 6; // resonant for the "wah" vowel
      // Sweep the cutoff up then down for the wah motion.
      lp.frequency.setValueAtTime(400, startT);
      lp.frequency.linearRampToValueAtTime(1800, startT + 0.12);
      lp.frequency.setTargetAtTime(500, startT + 0.14, 0.12);
      lp.connect(g);
      g.connect(master);

      const peak = Math.max(0.0008, vel * 0.10);
      g.gain.setValueAtTime(0.0001, startT);
      g.gain.linearRampToValueAtTime(peak, startT + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, startT + 0.34);

      osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, startT);
      // tiny downward bend for comedy
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, f * 0.94),
        startT + 0.3
      );
      osc.connect(lp);

      const stopT = startT + 0.38;
      osc.start(startT);
      osc.stop(stopT);
      register({ nodes: [osc, lp, g] }, osc);
    } catch (e) {
      try { osc && osc.disconnect(); } catch (_) {}
      try { lp && lp.disconnect(); } catch (_) {}
      try { g && g.disconnect(); } catch (_) {}
    }
  }

  // ---- Swing helper: nudge off-beat 16ths a touch late --------------------
  function swungTime(baseTime, stepInBar) {
    // The "and" of each 8th (odd 16th within an 8th pair) gets pushed late.
    // 16th positions 1,3,5,... are off-16ths.
    const isOff = (stepInBar % 2) === 1;
    if (!isOff) return baseTime;
    return baseTime + STEP * (SWING - 0.5);
  }

  // ---- Melody scheduling -------------------------------------------------
  // We consume the current phrase event-by-event. Each scheduler step we check
  // whether a melody event begins on this absolute step; if so we play it and
  // advance. Variation: per loop we may pop octaves, add grace notes, and a
  // chromatic "wink".
  let melodyNextStartStep = 0; // absolute step at which the next event starts

  function advancePhraseEvent() {
    const phrase = PHRASES[phraseIdx];
    hookEventIdx++;
    if (hookEventIdx >= phrase.length) {
      hookEventIdx = 0;
      phraseIdx++;
      if (phraseIdx >= PHRASES.length) {
        phraseIdx = 0;
        loopCount++;
      }
    }
  }

  function scheduleMelodyForStep(absStep, when, stepInBar) {
    if (absStep !== melodyNextStartStep) return;

    const phrase = PHRASES[phraseIdx];
    const ev = phrase[hookEventIdx];
    if (!ev) {
      // Safety: skip a step if malformed.
      melodyNextStartStep += 1;
      return;
    }
    const [offset, dur] = ev;
    const durSteps = SAFE(dur, 1);

    if (offset !== REST && offset !== null) {
      // Per-loop variation: octave pop on some loops, and a chromatic wink.
      let oct = 0;
      const vary = (loopCount % 2) === 1;
      if (vary && rand() < 0.18) oct = 12;       // occasional octave-up hop
      else if (vary && rand() < 0.08) oct = -12; // rare octave-down

      const t = swungTime(when, stepInBar);
      const accent = (stepInBar % 4 === 0) ? 0.12 : 0;
      const vel = 0.55 + accent + 0.25 * intensity + (rand() - 0.5) * 0.08;
      const midi = C + offset + oct;
      playPluck(midi, t, vel, { dur: durSteps });

      // Grace-note ornament: a quick chromatic neighbor just before longer
      // notes, more likely as intensity rises (cheeky wiggle).
      if (durSteps >= 2 && rand() < 0.22 + intensity * 0.2) {
        const grace = midi - 1; // chromatic lower neighbor
        playPluck(grace, t - STEP * 0.4, vel * 0.5, { dur: 1 });
      }

      // Cute-spooky wink: rarely echo the note a flat-6 / minor-third above,
      // quietly, for the comedic chromatic flavor (about once per loop).
      if (rand() < 0.05 + intensity * 0.05) {
        playPluck(midi + 8, t + STEP * 0.5, vel * 0.32, { dur: 1 }); // +flat6
      }
    }

    // Advance to the next event.
    melodyNextStartStep += durSteps;
    advancePhraseEvent();
  }

  // ---- Per-step orchestration -------------------------------------------
  function scheduleStep(absStep, when) {
    const stepInBar = ((absStep % STEPS_PER_BAR) + STEPS_PER_BAR) % STEPS_PER_BAR;
    const barIndex = Math.floor(absStep / STEPS_PER_BAR);
    const chord = CHORDS[((barIndex % CHORDS.length) + CHORDS.length) % CHORDS.length];

    // ---- Stride bass (oom-pah) ----
    // Beats fall on steps 0,4,8,12. Roots on beats 1 & 3 (steps 0 & 8),
    // chord blips on beats 2 & 4 (steps 4 & 12).
    if (stepInBar === 0) {
      playBassRoot(chord.rootLow, when, 0.85);
    } else if (stepInBar === 8) {
      // beat 3: root again, sometimes the fifth for stride movement.
      const useFifth = rand() < 0.4;
      const note = useFifth ? chord.rootLow + 7 : chord.rootLow;
      playBassRoot(note, when, 0.8);
    } else if (stepInBar === 4 || stepInBar === 12) {
      playChordBlip(chord.blip, when, 0.7 + 0.2 * intensity);
    }

    // ---- Hand claps on backbeats (beats 2 & 4 => steps 4 & 12) ----
    if (stepInBar === 4 || stepInBar === 12) {
      playClap(when, 0.75 + 0.2 * intensity);
    }

    // ---- Comedy "wah": once in a while at a phrase tail (bar end) ----
    if (stepInBar === 14 && rand() < 0.12 + intensity * 0.12) {
      // low-ish stab around the chord root.
      playWah(chord.rootLow + 12, when, 0.6 + 0.2 * intensity);
    }

    // ---- Melody ----
    scheduleMelodyForStep(absStep, when, stepInBar);
  }

  // ---- Classic lookahead scheduler ---------------------------------------
  let timer = null;
  function schedulerTick() {
    if (stopped) return;
    try {
      const now = SAFE(ctx.currentTime, 0);
      // Guard a stalled/suspended clock so we don't flood the graph.
      if (nextNoteTime < now) nextNoteTime = now + 0.03;

      let safety = 0;
      while (nextNoteTime < now + SCHEDULE_AHEAD && safety < 64) {
        scheduleStep(stepIndex, nextNoteTime);
        nextNoteTime += STEP;
        stepIndex++;
        safety++;
      }
    } catch (e) {
      /* never let a scheduling glitch throw */
    }
  }

  try {
    schedulerTick(); // start immediately so audio begins promptly
    timer = setInterval(schedulerTick, INTERVAL_MS);
  } catch (e) {
    /* ignore — stop() still safe */
  }

  // ---- Public API --------------------------------------------------------
  function setIntensity(x) {
    intensity = clamp01(x);
    // Subtly raise level + brighten the melody as the washer "runs". Gentle,
    // never harsh — stays under PEAK and only nudges the filter open.
    try {
      const now = SAFE(ctx.currentTime, 0);
      const target = PEAK * (0.78 + 0.22 * intensity); // ~0.17..0.22
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(target, now, 0.5);

      const cutoff = 2200 + 1400 * intensity; // 2.2k..3.6k — opens slightly
      melLP.frequency.cancelScheduledValues(now);
      melLP.frequency.setTargetAtTime(cutoff, now, 0.5);
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
      master.gain.setValueAtTime(
        Math.max(0.0001, master.gain.value || 0.0001),
        now
      );
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    } catch (e) {
      /* ignore */
    }

    const teardown = () => {
      try {
        activeNodes.forEach((group) => {
          if (!group || !group.nodes) return;
          group.nodes.forEach((n) => {
            try { if (typeof n.stop === 'function') n.stop(); } catch (e) {}
            try { n.disconnect(); } catch (e) {}
          });
        });
        activeNodes.clear();
        try { melLP.disconnect(); } catch (e) {}
        try { master.disconnect(); } catch (e) {}
      } catch (e) {
        /* ignore */
      }
    };

    try {
      setTimeout(teardown, 350);
    } catch (e) {
      teardown();
    }
  }

  return { stop, setIntensity };
}
