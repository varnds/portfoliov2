// gameSfxKit.js
// Procedural sound-effects kit for the Wash Day mini-game.
// Pure Web Audio API — no audio files, no external libraries.
//
//   import { createSfx } from "./game/gameSfxKit";
//   const sfx = createSfx(audioCtx, masterGain);
//   sfx.drop("voxel"); sfx.birdChirp(); sfx.washerStart(); ...
//
// Design notes:
// - Every gain change is a RAMP (setTargetAtTime / linearRampToValueAtTime /
//   exponentialRampToValueAtTime with a tiny 0.0001 floor) — never a hard
//   `.value =` assignment at a running time. This avoids clicks/pops.
// - One-shots schedule osc.stop()/source.stop() so their nodes are released
//   for GC; nothing accumulates.
// - The washer is a persistent loop held by reference so it can be torn down.
//   washerStart() guards against double-start, washerStop() against not-running.
// - Every public method wraps its body in try/catch so a sound can never throw.

const FLOOR = 0.0001; // exponential ramps cannot target 0

export function createSfx(ctx, dest) {
  // --- small helpers -------------------------------------------------------

  const now = () => {
    try {
      return ctx.currentTime;
    } catch {
      return 0;
    }
  };

  // Short noise buffer reused for filtered-noise sweeps (whooshes, settle).
  let noiseBuffer = null;
  function getNoiseBuffer() {
    if (noiseBuffer) return noiseBuffer;
    const len = Math.max(1, Math.floor(ctx.sampleRate * 1.2));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffer = buf;
    return buf;
  }

  // Create a gain node that starts at the floor and is connected toward dest.
  function makeGain(target) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(FLOOR, now());
    g.connect(target || dest);
    return g;
  }

  // A simple ADSR-ish envelope built entirely from ramps.
  // peak at t0+attack, decays toward floor, hard-stops sources at end.
  function envGain(target, t0, attack, peak, release) {
    const g = makeGain(target);
    g.gain.setValueAtTime(FLOOR, t0);
    g.gain.linearRampToValueAtTime(Math.max(peak, FLOOR), t0 + attack);
    g.gain.exponentialRampToValueAtTime(FLOOR, t0 + attack + release);
    return g;
  }

  // Schedule disconnect of a node a little after a time, to release for GC.
  function disconnectAfter(node, t) {
    const ms = Math.max(0, (t - now()) * 1000) + 60;
    setTimeout(() => {
      try {
        node.disconnect();
      } catch {
        /* already gone */
      }
    }, ms);
  }

  // Play a single oscillator tone with an envelope. Returns end time.
  function tone({
    type = "sine",
    freq = 440,
    freqEnd = null,
    t0 = now(),
    attack = 0.01,
    peak = 0.15,
    release = 0.2,
    detune = 0,
    target = dest,
  }) {
    const dur = attack + release;
    const osc = ctx.createOscillator();
    osc.type = type;
    try {
      osc.frequency.setValueAtTime(Math.max(1, freq), t0);
      if (freqEnd && freqEnd !== freq) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(1, freqEnd),
          t0 + dur
        );
      }
      if (detune) osc.detune.setValueAtTime(detune, t0);
    } catch {
      /* param scheduling best-effort */
    }
    const g = envGain(target, t0, attack, peak, release);
    osc.connect(g);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    disconnectAfter(osc, t0 + dur + 0.05);
    disconnectAfter(g, t0 + dur + 0.05);
    return t0 + dur;
  }

  // ========================================================================
  // drop(style)
  // ========================================================================
  function dropMaterialize(t0) {
    // Soft rising shimmer: a few detuned sine partials sweeping upward, light.
    const partials = [
      { f0: 440, f1: 880, det: -6, peak: 0.05 },
      { f0: 660, f1: 1320, det: +5, peak: 0.04 },
      { f0: 880, f1: 1760, det: +10, peak: 0.03 },
    ];
    partials.forEach((p, i) => {
      tone({
        type: "sine",
        freq: p.f0,
        freqEnd: p.f1,
        detune: p.det,
        t0: t0 + i * 0.04,
        attack: 0.12,
        peak: p.peak,
        release: 0.5,
      });
    });
  }

  function dropVoxel(t0) {
    // 3-5 blocky tick/snap tones rising in pitch — blocks clicking together.
    const base = 320;
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      const f = base * Math.pow(1.18, i);
      tone({
        type: "triangle",
        freq: f,
        freqEnd: f * 1.02,
        t0: t0 + i * 0.055,
        attack: 0.004,
        peak: 0.12,
        release: 0.07,
      });
      // tiny square "snap" overtone for blockiness
      tone({
        type: "square",
        freq: f * 2,
        t0: t0 + i * 0.055,
        attack: 0.002,
        peak: 0.03,
        release: 0.03,
      });
    }
  }

  function dropBeam(t0) {
    // Smooth descending sci-fi hum/whoosh landing on a soft low thump.
    const dur = 0.55;
    tone({
      type: "sawtooth",
      freq: 900,
      freqEnd: 180,
      t0,
      attack: 0.06,
      peak: 0.07,
      release: dur,
      // route through a gentle lowpass so the saw stays warm, not harsh
      target: (() => {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(2200, t0);
        lp.frequency.exponentialRampToValueAtTime(500, t0 + dur);
        lp.Q.setValueAtTime(2, t0);
        lp.connect(dest);
        disconnectAfter(lp, t0 + dur + 0.5);
        return lp;
      })(),
    });
    // soft low thump on landing
    tone({
      type: "sine",
      freq: 120,
      freqEnd: 70,
      t0: t0 + dur * 0.78,
      attack: 0.01,
      peak: 0.14,
      release: 0.22,
    });
  }

  function dropSettle(t0) {
    // Airy filtered-noise swell + a soft rounded thud on landing.
    const swellDur = 0.45;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(700, t0);
    bp.frequency.linearRampToValueAtTime(1600, t0 + swellDur);
    bp.Q.setValueAtTime(0.8, t0);
    const g = makeGain(bp);
    g.gain.setValueAtTime(FLOOR, t0);
    g.gain.linearRampToValueAtTime(0.05, t0 + swellDur * 0.55);
    g.gain.exponentialRampToValueAtTime(FLOOR, t0 + swellDur);
    src.connect(g);
    bp.connect(dest);
    src.start(t0);
    src.stop(t0 + swellDur + 0.05);
    disconnectAfter(src, t0 + swellDur + 0.1);
    disconnectAfter(g, t0 + swellDur + 0.1);
    disconnectAfter(bp, t0 + swellDur + 0.1);
    // rounded thud
    tone({
      type: "sine",
      freq: 160,
      freqEnd: 90,
      t0: t0 + swellDur * 0.7,
      attack: 0.012,
      peak: 0.12,
      release: 0.2,
    });
  }

  function drop(style) {
    try {
      const t0 = now() + 0.001;
      switch (style) {
        case "voxel":
          return dropVoxel(t0);
        case "beam":
          return dropBeam(t0);
        case "settle":
          return dropSettle(t0);
        case "materialize":
        default:
          return dropMaterialize(t0);
      }
    } catch {
      /* never throw */
    }
  }

  // ========================================================================
  // birdChirp()
  // ========================================================================
  function birdChirp() {
    try {
      const t0 = now() + 0.001;
      // 2-3 quick notes with upward pitch bends, bright but soft.
      const notes = [
        { f: 1700, bend: 2300, t: 0.0, rel: 0.08 },
        { f: 2100, bend: 2700, t: 0.09, rel: 0.07 },
        { f: 1900, bend: 2500, t: 0.17, rel: 0.09 },
      ];
      notes.forEach((n) => {
        tone({
          type: "sine",
          freq: n.f,
          freqEnd: n.bend,
          t0: t0 + n.t,
          attack: 0.008,
          peak: 0.06,
          release: n.rel,
        });
      });
    } catch {
      /* never throw */
    }
  }

  // ========================================================================
  // Distinct little game blips
  // ========================================================================
  function pickup() {
    // Small two-note "up" blip.
    try {
      const t0 = now() + 0.001;
      tone({ type: "sine", freq: 520, t0, attack: 0.006, peak: 0.1, release: 0.1 });
      tone({
        type: "sine",
        freq: 700,
        t0: t0 + 0.08,
        attack: 0.006,
        peak: 0.1,
        release: 0.13,
      });
    } catch {
      /* never throw */
    }
  }

  function load() {
    // Soft rounded "thunk".
    try {
      const t0 = now() + 0.001;
      tone({
        type: "sine",
        freq: 220,
        freqEnd: 130,
        t0,
        attack: 0.008,
        peak: 0.16,
        release: 0.18,
      });
      tone({
        type: "triangle",
        freq: 330,
        freqEnd: 200,
        t0,
        attack: 0.006,
        peak: 0.05,
        release: 0.12,
      });
    } catch {
      /* never throw */
    }
  }

  function hang() {
    // Bright "ding" — bell-ish with a quick overtone.
    try {
      const t0 = now() + 0.001;
      tone({
        type: "sine",
        freq: 1320,
        t0,
        attack: 0.004,
        peak: 0.11,
        release: 0.45,
      });
      tone({
        type: "sine",
        freq: 1980,
        t0,
        attack: 0.004,
        peak: 0.04,
        release: 0.3,
      });
    } catch {
      /* never throw */
    }
  }

  function sockFound() {
    // Playful little sparkle — quick ascending arpeggio of soft sines.
    try {
      const t0 = now() + 0.001;
      const freqs = [880, 1175, 1568, 2093];
      freqs.forEach((f, i) => {
        tone({
          type: "sine",
          freq: f,
          t0: t0 + i * 0.05,
          attack: 0.005,
          peak: 0.07 - i * 0.008,
          release: 0.16,
        });
      });
    } catch {
      /* never throw */
    }
  }

  // ========================================================================
  // Washer loop — persistent until washerStop()
  // ========================================================================
  // Held by reference so it can be torn down. `washer` is null when stopped.
  let washer = null;

  // Tunables that intensity scales between.
  const WASH = {
    baseGain: 0.05, // overall loop level at x=0
    maxGain: 0.16, // overall loop level at x=1
    baseCutoff: 350, // rumble brightness at x=0
    maxCutoff: 1100, // rumble brightness at x=1
    baseSlosh: 1.1, // slosh LFO Hz at x=0
    maxSlosh: 2.2, // slosh LFO Hz at x=1
    rampTime: 0.4, // smoothing time-constant for intensity changes
  };

  function washerStart() {
    try {
      if (washer) return; // guard double-start
      const t0 = now();

      // Master gain for the whole loop.
      const master = ctx.createGain();
      master.gain.setValueAtTime(FLOOR, t0);
      master.connect(dest);

      // --- low rumble: lowpass-filtered noise -----------------------------
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer();
      noise.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(WASH.baseCutoff, t0);
      lp.Q.setValueAtTime(0.7, t0);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.5, t0); // static mix level (ramped, not live-set)
      noise.connect(lp);
      lp.connect(noiseGain);
      noiseGain.connect(master);

      // --- low oscillator (~60-90Hz body) ---------------------------------
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(72, t0);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.6, t0);
      sub.connect(subGain);
      subGain.connect(master);

      // --- slosh modulation: LFO on a gain in the signal path -------------
      // The whole loop passes through `sloshGain`, whose gain is modulated by
      // an LFO for a wash-wash motion. We center around ~0.7 with depth 0.3.
      const sloshGain = ctx.createGain();
      sloshGain.gain.setValueAtTime(0.7, t0); // baseline center
      master.disconnect();
      master.connect(sloshGain);
      sloshGain.connect(dest);

      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(WASH.baseSlosh, t0);
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.setValueAtTime(0.28, t0); // modulation depth
      lfo.connect(lfoDepth);
      lfoDepth.connect(sloshGain.gain);

      // Start everything.
      noise.start(t0);
      sub.start(t0);
      lfo.start(t0);

      // Ramp the master in smoothly to the base level.
      master.gain.setTargetAtTime(WASH.baseGain, t0, 0.15);

      washer = {
        master,
        sloshGain,
        noise,
        lp,
        noiseGain,
        sub,
        subGain,
        lfo,
        lfoDepth,
        intensity: 0,
      };
    } catch {
      // Best-effort teardown if partially constructed.
      try {
        washerStop();
      } catch {
        /* ignore */
      }
    }
  }

  function washerSetIntensity(x) {
    try {
      if (!washer) return;
      const w = washer;
      const clamped = Math.max(0, Math.min(1, Number(x) || 0));
      const t = now();
      const tc = WASH.rampTime;

      const gain = WASH.baseGain + (WASH.maxGain - WASH.baseGain) * clamped;
      const cutoff =
        WASH.baseCutoff + (WASH.maxCutoff - WASH.baseCutoff) * clamped;
      const slosh = WASH.baseSlosh + (WASH.maxSlosh - WASH.baseSlosh) * clamped;

      // All RAMPS — never hard .value sets at a running time.
      w.master.gain.setTargetAtTime(Math.max(gain, FLOOR), t, tc);
      w.lp.frequency.setTargetAtTime(cutoff, t, tc);
      w.lfo.frequency.setTargetAtTime(slosh, t, tc);
      w.intensity = clamped;
    } catch {
      /* never throw */
    }
  }

  function washerStop() {
    try {
      if (!washer) return; // guard not-running
      const w = washer;
      washer = null; // mark stopped immediately so re-entry is safe
      const t = now();

      // Ramp master gain to ~0 over ~0.25s.
      try {
        w.master.gain.cancelScheduledValues(t);
        w.master.gain.setValueAtTime(
          Math.max(w.master.gain.value || FLOOR, FLOOR),
          t
        );
        w.master.gain.exponentialRampToValueAtTime(FLOOR, t + 0.25);
      } catch {
        /* best-effort */
      }

      const stopAt = t + 0.3;
      [w.noise, w.sub, w.lfo].forEach((node) => {
        try {
          node.stop(stopAt);
        } catch {
          /* may already be stopped */
        }
      });

      // Tear down all nodes after the ramp completes.
      const tail = [
        w.master,
        w.sloshGain,
        w.noise,
        w.lp,
        w.noiseGain,
        w.sub,
        w.subGain,
        w.lfo,
        w.lfoDepth,
      ];
      setTimeout(() => {
        tail.forEach((node) => {
          try {
            node.disconnect();
          } catch {
            /* already gone */
          }
        });
      }, 360);
    } catch {
      /* never throw */
    }
  }

  return {
    drop,
    birdChirp,
    pickup,
    load,
    hang,
    sockFound,
    washerStart,
    washerSetIntensity,
    washerStop,
  };
}
