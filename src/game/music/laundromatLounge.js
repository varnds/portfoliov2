// laundromatLounge.js
//
// Procedural, generative, LOOPING background-music track built with the Web
// Audio API only — no audio files, no external libraries.
//
//   export function createLaundromatLounge(ctx, dest)
//       -> { stop(), setIntensity(x) }
//
// Style: "Laundromat Lounge" — an ORIGINAL cheerful, quirky, jazzy-lounge tune
// in the SPIRIT of the Nintendo Wii "Mii Channel" lobby music (no melody is
// copied; the phrases below are composed fresh). Swung ~112 BPM, C major,
// I–VI–ii–V loop (Cmaj7 → A7 → Dm7 → G7), lots of breathing space.
//
// Architecture: classic Chris Wilson "two clocks" lookahead scheduler. A
// setInterval (~25ms) wakes up and, while the next step falls inside the
// lookahead window, schedules that step's events on the precise Web Audio
// clock and advances the step pointer. The music evolves forever because the
// melody/comp are chosen with light randomness against a deterministic chord
// grid, so it loops harmonically but never plays a rigid identical phrase.

export function createLaundromatLounge(ctx, dest) {
  // ---- Defensive guard: hand back an inert handle if we can't run. ----------
  const noop = {
    stop() {},
    setIntensity() {},
  };
  if (!ctx || typeof ctx.createGain !== 'function' || !dest) {
    return noop;
  }

  // ---- Musical constants ----------------------------------------------------
  const BPM = 112;
  const SPB = 60 / BPM;            // seconds per quarter-note beat (~0.5357s)
  const STEPS_PER_BEAT = 2;        // we think in 8th notes
  const STEP_COUNT = STEPS_PER_BEAT; // steps in one beat

  // Triplet swing: the off-beat 8th lands at ~2/3 of the beat, not 1/2.
  // On-beat 8th starts at 0; off-beat 8th starts at SWING * SPB.
  const SWING = 2 / 3;

  // Note frequencies (equal temperament, A4 = 440). MIDI-ish helper.
  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  // MIDI numbers for reference: C4 = 60.
  // Chord grid — one chord per bar, 4-bar loop (I VI ii V in C major).
  // Each chord lists: root midi, chord tones (for comp/lead), bass anchors.
  const CHORDS = [
    {
      name: 'Cmaj7',
      root: 48,                                   // C3
      tones: [60, 64, 67, 71],                    // C E G B
      lead: [60, 62, 64, 67, 69, 71, 72, 76],     // chord + passing tones
      bassTargets: [48, 52, 55, 59],              // C E G B (around C3)
    },
    {
      name: 'A7',
      root: 45,                                   // A2
      tones: [57, 61, 64, 67],                    // A C# E G
      lead: [57, 61, 64, 66, 67, 69, 73, 76],
      bassTargets: [45, 49, 52, 55],              // A C# E G
    },
    {
      name: 'Dm7',
      root: 50,                                   // D3
      tones: [62, 65, 69, 72],                    // D F A C
      lead: [62, 65, 67, 69, 72, 74, 77, 81],
      bassTargets: [50, 53, 57, 60],              // D F A C
    },
    {
      name: 'G7',
      root: 43,                                   // G2
      tones: [55, 59, 62, 65],                    // G B D F
      lead: [55, 59, 62, 65, 67, 71, 74, 77],
      bassTargets: [43, 47, 50, 53],              // G B D F
    },
  ];
  const BARS = CHORDS.length;        // 4-bar loop
  const BEATS_PER_BAR = 4;

  // ---- Local master + tone-shaping chain ------------------------------------
  // Everything we make connects into `master`. `master` -> `brightness` (a
  // gentle lowpass we open a touch with intensity) -> dest.
  let master, brightness;
  try {
    master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    // Swell in so we don't pop on start.
    master.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.8);

    brightness = ctx.createBiquadFilter();
    brightness.type = 'lowpass';
    brightness.frequency.setValueAtTime(2600, ctx.currentTime);
    brightness.Q.setValueAtTime(0.4, ctx.currentTime);

    master.connect(brightness);
    brightness.connect(dest);
  } catch (e) {
    return noop;
  }

  // Track every node with a scheduled lifetime so teardown can sweep anything
  // still alive. Nodes self-remove on 'ended'.
  const liveNodes = new Set();
  const track = (node) => {
    if (!node) return node;
    liveNodes.add(node);
    return node;
  };
  const releaseOnEnded = (osc, ...extra) => {
    try {
      osc.onended = () => {
        try { osc.disconnect(); } catch (_) {}
        liveNodes.delete(osc);
        for (const n of extra) {
          try { n.disconnect(); } catch (_) {}
          liveNodes.delete(n);
        }
      };
    } catch (_) {}
  };

  // ---- Intensity state ------------------------------------------------------
  // setIntensity swells level + opens brightness a touch. Kept subtle.
  let intensity = 0.5;
  const clamp01 = (x) => {
    const n = Number(x);
    if (!isFinite(n)) return intensity;
    return n < 0 ? 0 : n > 1 ? 1 : n;
  };

  // ---- Voice: MARIMBA lead (the star) ---------------------------------------
  // Sine fundamental + a quieter 4x partial, ~3ms attack, exp-ish decay
  // ~0.3–0.45s, with a tiny upward pitch blip at onset for the wooden "tok".
  function marimba(t, midi, dur, vel) {
    try {
      const f = hz(midi);
      const g = track(ctx.createGain());
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vel, t + 0.003);            // ~3ms attack
      const decay = Math.min(0.45, Math.max(0.3, dur * 0.95));
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);

      // Fundamental sine.
      const o1 = track(ctx.createOscillator());
      o1.type = 'sine';
      o1.frequency.setValueAtTime(f * 1.03, t);                  // pitch blip up
      o1.frequency.exponentialRampToValueAtTime(f, t + 0.02);    // settle = "tok"

      // Quiet 4x partial for wooden shimmer.
      const o2 = track(ctx.createOscillator());
      o2.type = 'sine';
      o2.frequency.setValueAtTime(f * 4, t);
      const g2 = track(ctx.createGain());
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.linearRampToValueAtTime(0.16, t + 0.003);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + decay * 0.55);

      o1.connect(g);
      o2.connect(g2);
      g2.connect(g);
      g.connect(master);

      const end = t + decay + 0.05;
      o1.start(t); o2.start(t);
      o1.stop(end); o2.stop(end);
      releaseOnEnded(o1, g, g2);
      releaseOnEnded(o2);
    } catch (_) {}
  }

  // ---- Voice: WALKING upright BASS ------------------------------------------
  // Triangle quarter notes, short percussive decay.
  function bass(t, midi, dur) {
    try {
      const f = hz(midi);
      const g = track(ctx.createGain());
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.012);
      const decay = Math.min(0.42, dur * 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);

      const o = track(ctx.createOscillator());
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, t);

      // Slight lowpass to keep the upright woody, not buzzy.
      const lp = track(ctx.createBiquadFilter());
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(900, t);

      o.connect(lp);
      lp.connect(g);
      g.connect(master);

      const end = t + decay + 0.04;
      o.start(t);
      o.stop(end);
      releaseOnEnded(o, lp, g);
    } catch (_) {}
  }

  // ---- Voice: FINGER SNAPS (beats 2 & 4) ------------------------------------
  // Very short bandpass-filtered noise burst, ~2kHz, decay ~0.05s.
  let noiseBuffer = null;
  function getNoise() {
    if (noiseBuffer) return noiseBuffer;
    try {
      const len = Math.floor(ctx.sampleRate * 0.2);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      noiseBuffer = buf;
    } catch (_) {
      noiseBuffer = null;
    }
    return noiseBuffer;
  }
  function snap(t) {
    try {
      const buf = getNoise();
      if (!buf) return;
      const src = track(ctx.createBufferSource());
      src.buffer = buf;

      const bp = track(ctx.createBiquadFilter());
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2000 + Math.random() * 400, t); // ~1.8–2.5kHz
      bp.Q.setValueAtTime(6, t);

      const g = track(ctx.createGain());
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);     // decay ~0.05s

      src.connect(bp);
      bp.connect(g);
      g.connect(master);

      const end = t + 0.08;
      src.start(t);
      src.stop(end);
      // BufferSource also fires 'ended'.
      releaseOnEnded(src, bp, g);
    } catch (_) {}
  }

  // ---- Voice: soft VIBRAPHONE comp ------------------------------------------
  // Sine with a gentle ~5Hz amplitude tremolo, quiet chord stabs, long decay.
  function vibraphone(t, midi, dur, vel) {
    try {
      const f = hz(midi);
      const g = track(ctx.createGain());
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vel, t + 0.02);
      const decay = Math.min(1.6, Math.max(0.6, dur));
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);

      const o = track(ctx.createOscillator());
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t);

      // Tremolo: an LFO (~5Hz) modulating a tremolo gain in [0.7..1.0]-ish.
      const trem = track(ctx.createGain());
      trem.gain.setValueAtTime(0.85, t);
      const lfo = track(ctx.createOscillator());
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(5, t);
      const lfoDepth = track(ctx.createGain());
      lfoDepth.gain.setValueAtTime(0.15, t);
      lfo.connect(lfoDepth);
      lfoDepth.connect(trem.gain);

      o.connect(trem);
      trem.connect(g);
      g.connect(master);

      const end = t + decay + 0.05;
      o.start(t); lfo.start(t);
      o.stop(end); lfo.stop(end);
      releaseOnEnded(o, trem, g);
      releaseOnEnded(lfo, lfoDepth);
    } catch (_) {}
  }

  // ---- Voice: stray WHISTLE -------------------------------------------------
  // Soft sine with light vibrato holding an occasional long note.
  function whistle(t, midi, dur) {
    try {
      const f = hz(midi);
      const g = track(ctx.createGain());
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.08);
      g.gain.setTargetAtTime(0.05, t + 0.1, 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      const o = track(ctx.createOscillator());
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t);

      // Light vibrato.
      const vib = track(ctx.createOscillator());
      vib.type = 'sine';
      vib.frequency.setValueAtTime(5.5, t);
      const vibDepth = track(ctx.createGain());
      vibDepth.gain.setValueAtTime(f * 0.006, t);
      vib.connect(vibDepth);
      vibDepth.connect(o.frequency);

      o.connect(g);
      g.connect(master);

      const end = t + dur + 0.06;
      o.start(t); vib.start(t);
      o.stop(end); vib.stop(end);
      releaseOnEnded(o, g);
      releaseOnEnded(vib, vibDepth);
    } catch (_) {}
  }

  // ---------------------------------------------------------------------------
  // Sequencer state. We count in 8th-note steps. Position derived from a global
  // step counter so we always know bar / beat / off-beat.
  // ---------------------------------------------------------------------------
  let step = 0;                 // global 8th-note step, increments forever
  let nextNoteTime = 0;         // Web Audio time of the NEXT step to schedule

  // Remember last lead note so the walking bass and call-and-response feel
  // connected; and so the melody varies instead of repeating rigidly.
  let lastLeadMidi = 67;
  let prevBassMidi = 48;

  // A simple deterministic-ish but evolving pick: light randomness.
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // The "leave RESTS so it breathes" map: probability the lead plays on a given
  // step. On-beats more likely than off-beats; certain steps are silent to
  // create call-and-response. Indexed by step-within-bar (0..7 for 8 8ths/bar).
  // Lower numbers = more space.
  const LEAD_DENSITY = [0.85, 0.35, 0.55, 0.65, 0.45, 0.7, 0.3, 0.5];

  // Compute the precise start time of an 8th-note step relative to its beat,
  // applying triplet swing to off-beats.
  function stepStartTime(baseBeatTime, isOffBeat) {
    return isOffBeat ? baseBeatTime + SWING * SPB : baseBeatTime;
  }

  // Schedule everything that happens AT a given global 8th-note step.
  function scheduleStep(stepIndex, when) {
    try {
      const barInLoop = Math.floor(stepIndex / (BEATS_PER_BAR * STEPS_PER_BEAT)) % BARS;
      const stepInBar = stepIndex % (BEATS_PER_BAR * STEPS_PER_BEAT); // 0..7
      const beatInBar = Math.floor(stepInBar / STEPS_PER_BEAT);       // 0..3
      const isOffBeat = (stepInBar % STEPS_PER_BEAT) === 1;

      const chord = CHORDS[barInLoop];
      const nextChord = CHORDS[(barInLoop + 1) % BARS];

      // ---- BASS: walking quarter notes on the down 8th of each beat. --------
      if (!isOffBeat) {
        let target;
        if (beatInBar === 0) {
          target = chord.root;                       // land the root on beat 1
        } else if (beatInBar === 3) {
          // Beat 4: chromatic approach toward the NEXT chord's root.
          const nextRoot = nextChord.root;
          const approach = nextRoot + (Math.random() < 0.5 ? -1 : 1);
          target = approach;
        } else {
          // Beats 2–3: walk through chord tones / fifth.
          target = pick(chord.bassTargets);
        }
        // Keep motion smooth-ish: nudge toward stepwise from previous.
        if (Math.abs(target - prevBassMidi) > 7 && beatInBar !== 0) {
          target += target > prevBassMidi ? -12 : 12;
        }
        prevBassMidi = target;
        bass(when, target, SPB);
      }

      // ---- SNAPS: beats 2 & 4 (on the down 8th of those beats). -------------
      if (!isOffBeat && (beatInBar === 1 || beatInBar === 3)) {
        snap(when);
      }

      // ---- VIBRAPHONE comp: quiet stabs on some off-beats. ------------------
      // Comp on the off-beat of beat 2, and occasionally off-beat of beat 4.
      if (isOffBeat && (beatInBar === 1 || (beatInBar === 3 && Math.random() < 0.5))) {
        // Two/three-note quiet voicing from chord tones, mid register.
        const voicing = chord.tones.slice(0, 3);
        for (let i = 0; i < voicing.length; i++) {
          // Spread voices a hair in time for a soft roll.
          vibraphone(when + i * 0.012, voicing[i], SPB * 1.4, 0.05);
        }
      }

      // ---- MARIMBA lead: syncopated, call-and-response, with rests. ---------
      const density = LEAD_DENSITY[stepInBar] * (0.85 + intensity * 0.3);
      if (Math.random() < density) {
        // Choose a note: prefer stepwise motion from lastLeadMidi within the
        // chord's lead set, sometimes leap, sometimes repeat — keeps it
        // hummable and varied (never a rigid identical loop).
        const palette = chord.lead;
        let choice;
        const r = Math.random();
        if (r < 0.55) {
          // Nearest few notes around the last note (stepwise feel).
          const near = palette
            .slice()
            .sort((a, b) => Math.abs(a - lastLeadMidi) - Math.abs(b - lastLeadMidi))
            .slice(0, 4);
          choice = pick(near);
        } else if (r < 0.85) {
          choice = pick(palette);                    // a leap / fresh color
        } else {
          choice = lastLeadMidi;                     // gentle repeat
        }
        lastLeadMidi = choice;

        // Velocity: a touch louder on beats, softer on off-beats; swell with
        // intensity. Keep the marimba clearly the star.
        const base = isOffBeat ? 0.16 : 0.22;
        const vel = base + intensity * 0.06 + Math.random() * 0.03;

        // Slightly longer notes on phrase-ends (beat 4) so it sings.
        const dur = beatInBar === 3 ? SPB * 0.8 : SPB * 0.55;
        marimba(when, choice, dur, vel);
      }

      // ---- WHISTLE: occasional long held note at the top of a 4-bar loop. ---
      // Fires rarely, only at the start of bar 0 or bar 2, holds ~2 bars.
      if (stepInBar === 0 && (barInLoop === 0 || barInLoop === 2) && Math.random() < 0.22) {
        // A high chord tone, an octave up, soft and floaty.
        const top = chord.tones[Math.floor(Math.random() * chord.tones.length)] + 12;
        whistle(when + SPB * 0.5, top, SPB * (3 + Math.random() * 2));
      }
    } catch (_) {
      // One bad value must never break the scheduler loop.
    }
  }

  // ---- The classic "two clocks" lookahead scheduler -------------------------
  const LOOKAHEAD_MS = 25;        // how often the timer wakes
  const SCHEDULE_AHEAD = 0.12;    // how far ahead (s) we schedule

  // Duration of one 8th-note step, accounting for swing: on->off is the long
  // part of the triplet (SWING * SPB), off->next-on is the short remainder.
  function stepDuration(stepIndex) {
    const stepInBar = stepIndex % STEPS_PER_BEAT; // 0 = on-beat, 1 = off-beat
    if (stepInBar === 0) {
      return SWING * SPB;            // on-beat lasts until the swung off-beat
    }
    return (1 - SWING) * SPB;        // off-beat lasts until the next beat
  }

  let timerId = null;
  let stopped = false;

  function scheduler() {
    if (stopped) return;
    try {
      // While the next step falls inside the lookahead window, schedule it.
      while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
        scheduleStep(step, nextNoteTime);
        nextNoteTime += stepDuration(step);
        step += 1;
      }
    } catch (_) {
      // Never let the interval throw; just wait for the next tick.
    }
  }

  // Kick things off a hair in the future so the first events aren't late.
  try {
    nextNoteTime = ctx.currentTime + 0.1;
    timerId = setInterval(scheduler, LOOKAHEAD_MS);
    scheduler(); // prime immediately
  } catch (_) {
    // If we somehow can't schedule, fall back to inert (still allow teardown).
  }

  // ---- Public API -----------------------------------------------------------
  function setIntensity(x) {
    intensity = clamp01(x);
    if (stopped) return;
    try {
      const now = ctx.currentTime;
      // Gently swell master level: ~0.16 at x=0 up to ~0.21 at x=1.
      const targetGain = 0.16 + intensity * 0.05;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(targetGain, now, 0.4);
      // Open brightness a touch: ~2300Hz dim → ~3400Hz bright. Never harsh.
      const targetCut = 2300 + intensity * 1100;
      brightness.frequency.cancelScheduledValues(now);
      brightness.frequency.setTargetAtTime(targetCut, now, 0.5);
    } catch (_) {}
  }

  function stop() {
    if (stopped) return;            // idempotent
    stopped = true;
    try {
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
    } catch (_) {}

    try {
      const now = ctx.currentTime;
      // Ramp local master to ~0 over ~0.3s (exp toward a small floor).
      master.gain.cancelScheduledValues(now);
      // Anchor current value so the ramp is smooth.
      try { master.gain.setValueAtTime(master.gain.value, now); } catch (_) {}
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    } catch (_) {}

    // After the fade, hard-stop & disconnect every node that's still alive.
    setTimeout(() => {
      try {
        for (const n of liveNodes) {
          try { if (typeof n.stop === 'function') n.stop(); } catch (_) {}
          try { n.disconnect(); } catch (_) {}
        }
        liveNodes.clear();
      } catch (_) {}
      try { master.disconnect(); } catch (_) {}
      try { brightness.disconnect(); } catch (_) {}
    }, 350);
  }

  // Apply initial intensity (sets master/brightness toward starting state).
  setIntensity(intensity);

  return { stop, setIntensity };
}
