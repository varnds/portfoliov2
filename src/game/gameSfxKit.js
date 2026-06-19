// gameSfxKit.js
// Procedural sound-effects kit for "Out to Dry" — a cozy desert laundry world.
// Pure Web Audio API — no audio files, no external libraries.
//
//   import { createSfx } from "./game/gameSfxKit";
//   const sfx = createSfx(audioCtx, masterGain);
//   sfx.drop("voxel"); sfx.footstep(); sfx.gameStart(); sfx.washerStart(); ...
//
// ── SOUND-DESIGN BRIEF ────────────────────────────────────────────────────
// Warm, whimsical, storybook — NOT arcade. Soft, filtered, gentle. One family.
//
// COHESION / PALETTE
//   Tonal center: A MAJOR PENTATONIC (A C# E F# A …). Every musical/UI blip —
//   pickup, load, hang, sockFound, birdChirp, gameStart, gameEnd, and the
//   pitched parts of caught/die — draws ONLY from this scale, so any two
//   sounds that overlap still harmonize and never clash.
//   PHYSICAL sounds (footstep, splash, washer/fan loops) share one warm,
//   lowpass-filtered character — no bright or hissy high noise.
//
// LOUDNESS TIERS (documented peak = approximate target gain at master)
//   T_FAINT  0.045  footstep                      (fires constantly → very soft)
//   T_SOFT   0.075  splash, caught                (incidental physical/comedy)
//   T_MID    0.11   pickup, load, hang, sockFound, birdChirp, die (UI/feedback)
//   T_LOUD   0.16   gameStart, gameEnd            (loudest, still gentle)
//   Loop beds (washer/fan) sit at 0.05–0.16 depending on intensity.
//   Per-sound documented peaks live in comments at each method.
//
// QUALITY RULES (a prior version had to fix these — keep them)
//   • Every gain change is a RAMP. setValueAtTime(FLOOR, t) only at onset, then
//     linear/exponential/setTarget. Exponential ramps target FLOOR (0.0001),
//     never 0. No hard `.value =` at a running time (only construction values).
//   • Every osc / bufferSource that .start()s also gets a scheduled .stop(t)
//     and disconnects on teardown, so nodes never accumulate.
//   • washer + fan loops persist until stop(); held by reference; guarded
//     against double-start and not-running stop; ramp out ~0.25s then disconnect.
//   • Every public method is wrapped so it can NEVER throw. Unusable ctx/dest
//     yields a silent no-op handle.

const FLOOR = 0.0001; // exponential ramps cannot target 0

// ── Pitch palette: A major pentatonic, named for readability ────────────────
const N = {
  A2: 110.0,
  Csharp3: 138.59,
  E3: 164.81,
  Fsharp3: 185.0,
  A3: 220.0,
  Csharp4: 277.18,
  E4: 329.63,
  Fsharp4: 369.99,
  A4: 440.0,
  Csharp5: 554.37,
  E5: 659.25,
  Fsharp5: 739.99,
  A5: 880.0,
  Csharp6: 1108.73,
  E6: 1318.51,
  Fsharp6: 1479.98,
  A6: 1760.0,
};

// Loudness tiers (see brief).
const T_FAINT = 0.045;
const T_SOFT = 0.075;
const T_MID = 0.11;
const T_LOUD = 0.16;

export function createSfx(ctx, dest) {
  // If the audio graph is unusable, hand back silent no-ops so callers are safe.
  if (!ctx || !dest || typeof ctx.createGain !== "function") {
    const noop = () => {};
    return {
      footstep: noop,
      drop: noop,
      die: noop,
      caught: noop,
      splash: noop,
      pickup: noop,
      load: noop,
      hang: noop,
      sockFound: noop,
      birdChirp: noop,
      gameStart: noop,
      gameEnd: noop,
      washerStart: noop,
      washerSetIntensity: noop,
      washerStop: noop,
      fanStart: noop,
      fanSetIntensity: noop,
      fanStop: noop,
    };
  }

  // --- small helpers -------------------------------------------------------

  const now = () => {
    try {
      return ctx.currentTime;
    } catch {
      return 0;
    }
  };

  const rand = (a, b) => a + Math.random() * (b - a);

  // Short noise buffer reused for filtered-noise sweeps / loops.
  let noiseBuffer = null;
  function getNoiseBuffer() {
    if (noiseBuffer) return noiseBuffer;
    const len = Math.max(1, Math.floor(ctx.sampleRate * 1.5));
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

  // ADSR-ish envelope built entirely from ramps.
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
  // `target` may be a sub-graph node so callers can insert filters.
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
    osc.onended = () => {
      try {
        osc.disconnect();
      } catch {
        /* gone */
      }
    };
    disconnectAfter(osc, t0 + dur + 0.05);
    disconnectAfter(g, t0 + dur + 0.05);
    return t0 + dur;
  }

  // A warm lowpass filter node feeding dest — for soft physical timbres.
  function warmLowpass(t0, cutoff = 1200, q = 0.7, holdMs = 1200) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(cutoff, t0);
    lp.Q.setValueAtTime(q, t0);
    lp.connect(dest);
    disconnectAfter(lp, t0 + holdMs / 1000);
    return lp;
  }

  // ========================================================================
  // footstep() — soft single footfall, varied each call.
  // Documented peak ≈ T_FAINT (0.045). Fires once per step → kept very soft.
  // ========================================================================
  function footstep() {
    try {
      const t0 = now() + 0.001;
      // A short burst of lowpass noise (the scuff) + a soft low body thump.
      const dur = rand(0.05, 0.08);
      const lp = warmLowpass(t0, rand(420, 620), 0.9, 400);
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer();
      // random start offset into the noise for variation
      const off = Math.random() * 0.5;
      const g = makeGain(lp);
      // scuff + body thump overlap; each near T_FAINT summed to ~0.083 (≈2× tier)
      // for a constantly-firing sound. Pull the scuff to ~0.55× so the pair lands
      // near T_FAINT and footsteps stay genuinely faint.
      const peak = T_FAINT * rand(0.45, 0.6);
      g.gain.setValueAtTime(FLOOR, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(FLOOR, t0 + dur);
      src.connect(g);
      src.start(t0, off, dur + 0.05);
      src.stop(t0 + dur + 0.05);
      src.onended = () => {
        try {
          src.disconnect();
        } catch {
          /* gone */
        }
      };
      disconnectAfter(src, t0 + dur + 0.1);
      disconnectAfter(g, t0 + dur + 0.1);
      // soft rounded body thump, pitch jittered so steps don't sound robotic
      tone({
        type: "sine",
        freq: rand(95, 130),
        freqEnd: rand(60, 80),
        t0,
        attack: 0.006,
        peak: T_FAINT * rand(0.6, 0.8), // trimmed so scuff+thump ≈ T_FAINT total
        release: rand(0.07, 0.1),
      });
    } catch {
      /* never throw */
    }
  }

  // ========================================================================
  // drop(style) — spawn entrance.
  // Documented peak ≈ T_MID (0.11) for the loudest partial per style.
  // ========================================================================
  function dropMaterialize(t0) {
    // Soft rising shimmer on pentatonic partials.
    const partials = [
      { f0: N.A4, f1: N.A5, det: -6, peak: 0.05 },
      { f0: N.E5, f1: N.E6, det: +5, peak: 0.04 },
      { f0: N.Csharp5, f1: N.Csharp6, det: +10, peak: 0.03 },
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
    // Blocky tick/snap tones rising through the pentatonic — blocks clicking.
    const steps = [N.A3, N.Csharp4, N.E4, N.Fsharp4];
    steps.forEach((f, i) => {
      tone({
        type: "triangle",
        freq: f,
        freqEnd: f * 1.02,
        t0: t0 + i * 0.055,
        attack: 0.004,
        peak: T_MID,
        release: 0.07,
      });
      // tiny soft overtone for blockiness, routed warm so it isn't harsh
      tone({
        type: "triangle",
        freq: f * 2,
        t0: t0 + i * 0.055,
        attack: 0.002,
        peak: 0.03,
        release: 0.03,
        target: warmLowpass(t0 + i * 0.055, 2600, 0.7, 300),
      });
    });
  }

  function dropBeam(t0) {
    // Smooth descending warm hum/whoosh landing on a soft low thump.
    const dur = 0.55;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(2000, t0);
    lp.frequency.exponentialRampToValueAtTime(450, t0 + dur);
    lp.Q.setValueAtTime(1.6, t0);
    lp.connect(dest);
    disconnectAfter(lp, t0 + dur + 0.5);
    tone({
      type: "sawtooth",
      freq: N.A5,
      freqEnd: N.Fsharp3,
      t0,
      attack: 0.06,
      peak: 0.07,
      release: dur,
      target: lp,
    });
    // soft low thump on landing
    tone({
      type: "sine",
      freq: N.A2,
      freqEnd: 70,
      t0: t0 + dur * 0.78,
      attack: 0.01,
      peak: T_MID,
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
    bp.frequency.linearRampToValueAtTime(1400, t0 + swellDur);
    bp.Q.setValueAtTime(0.8, t0);
    const g = makeGain(bp);
    g.gain.setValueAtTime(FLOOR, t0);
    g.gain.linearRampToValueAtTime(0.05, t0 + swellDur * 0.55);
    g.gain.exponentialRampToValueAtTime(FLOOR, t0 + swellDur);
    src.connect(g);
    bp.connect(dest);
    src.start(t0);
    src.stop(t0 + swellDur + 0.05);
    src.onended = () => {
      try {
        src.disconnect();
      } catch {
        /* gone */
      }
    };
    disconnectAfter(src, t0 + swellDur + 0.1);
    disconnectAfter(g, t0 + swellDur + 0.1);
    disconnectAfter(bp, t0 + swellDur + 0.1);
    // rounded thud (pentatonic low)
    tone({
      type: "sine",
      freq: N.E3,
      freqEnd: 90,
      t0: t0 + swellDur * 0.7,
      attack: 0.012,
      peak: T_MID,
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
  // die() — game over, cozy-sad gentle descending "aww". Peak ≈ T_MID (0.11).
  // Pentatonic descent A4 → F#4 → E4 → C#4 with a soft warm pad underneath.
  // ========================================================================
  function die() {
    try {
      const t0 = now() + 0.001;
      const seq = [N.A4, N.Fsharp4, N.E4, N.Csharp4];
      const lp = warmLowpass(t0, 1500, 0.7, 1600);
      seq.forEach((f, i) => {
        tone({
          type: "triangle",
          freq: f,
          t0: t0 + i * 0.18,
          attack: 0.02,
          peak: T_MID - i * 0.015,
          release: 0.3,
          target: lp,
        });
      });
      // gentle low pad sighing down to the tonic
      tone({
        type: "sine",
        freq: N.A3,
        freqEnd: N.A2,
        t0,
        attack: 0.08,
        peak: 0.05,
        release: 0.85,
        target: lp,
      });
    } catch {
      /* never throw */
    }
  }

  // ========================================================================
  // caught() — non-fatal tag, comedic soft "bonk"/yelp. Peak ≈ T_SOFT (0.075).
  // A quick boing: pitched note bends up then a tiny down-flick. Stays warm.
  // ========================================================================
  function caught() {
    try {
      const t0 = now() + 0.001;
      const lp = warmLowpass(t0, 1800, 0.7, 500);
      // comedic "boing": pentatonic note quickly bending up
      tone({
        type: "triangle",
        freq: N.Csharp4,
        freqEnd: N.A4,
        t0,
        attack: 0.006,
        peak: T_SOFT,
        release: 0.13,
        target: lp,
      });
      // little down-flick yelp tail
      tone({
        type: "sine",
        freq: N.E5,
        freqEnd: N.E4,
        t0: t0 + 0.1,
        attack: 0.006,
        peak: T_SOFT * 0.7,
        release: 0.1,
        target: lp,
      });
    } catch {
      /* never throw */
    }
  }

  // ========================================================================
  // splash() — stepping into water, gentle plip. Peak ≈ T_SOFT (0.075).
  // Filtered noise burst + a little downward pitch "ploop". Warm, no hiss.
  // ========================================================================
  function splash() {
    try {
      const t0 = now() + 0.001;
      const dur = 0.22;
      // filtered noise: bandpass sweeping down for a watery plip
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer();
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(1300, t0);
      bp.frequency.exponentialRampToValueAtTime(500, t0 + dur);
      bp.Q.setValueAtTime(1.2, t0);
      // extra lowpass to keep it soft, never splashy-bright
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(2200, t0);
      lp.Q.setValueAtTime(0.7, t0);
      bp.connect(lp);
      lp.connect(dest);
      const g = makeGain(bp);
      g.gain.setValueAtTime(FLOOR, t0);
      // noise burst + the ploop overlap, summing to ~0.12; pull the burst to
      // ~0.6×SOFT so the pair lands near the T_SOFT (0.075) target.
      g.gain.linearRampToValueAtTime(T_SOFT * 0.6, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(FLOOR, t0 + dur);
      src.connect(g);
      src.start(t0, Math.random() * 0.4);
      src.stop(t0 + dur + 0.05);
      src.onended = () => {
        try {
          src.disconnect();
        } catch {
          /* gone */
        }
      };
      disconnectAfter(src, t0 + dur + 0.1);
      disconnectAfter(g, t0 + dur + 0.1);
      disconnectAfter(bp, t0 + dur + 0.1);
      disconnectAfter(lp, t0 + dur + 0.1);
      // soft "ploop" drop — a low sine bending down
      tone({
        type: "sine",
        freq: N.Fsharp4,
        freqEnd: N.A3,
        t0: t0 + 0.01,
        attack: 0.006,
        peak: T_SOFT * 0.85,
        release: 0.16,
      });
    } catch {
      /* never throw */
    }
  }

  // ========================================================================
  // pickup() — grab the denim. Small two-note "up" blip. Peak ≈ T_MID (0.11).
  // ========================================================================
  function pickup() {
    try {
      const t0 = now() + 0.001;
      tone({ type: "sine", freq: N.A4, t0, attack: 0.006, peak: T_MID, release: 0.1 });
      tone({
        type: "sine",
        freq: N.Csharp5,
        t0: t0 + 0.08,
        attack: 0.006,
        peak: T_MID,
        release: 0.13,
      });
    } catch {
      /* never throw */
    }
  }

  // ========================================================================
  // load() — load the washer. Soft rounded pentatonic "thunk". Peak ≈ T_MID.
  // ========================================================================
  function load() {
    try {
      const t0 = now() + 0.001;
      tone({
        type: "sine",
        freq: N.A3,
        freqEnd: N.A2,
        t0,
        attack: 0.008,
        peak: T_MID, // was T_MID+0.05 → with the doubling it peaked ~0.20, hotter
        release: 0.18, //   than the loudest tier; pull to MID so it sits with peers
      });
      tone({
        type: "triangle",
        freq: N.E4,
        freqEnd: N.E3,
        t0,
        attack: 0.006,
        peak: 0.035, // trimmed doubling so the two voices don't sum over-tier
        release: 0.12,
      });
    } catch {
      /* never throw */
    }
  }

  // ========================================================================
  // hang() — hang on the line. Bright-but-warm bell "ding". Peak ≈ T_MID.
  // Pentatonic E6 with a soft fifth-ish overtone (still in-scale: C#6 → bell).
  // ========================================================================
  function hang() {
    try {
      const t0 = now() + 0.001;
      tone({
        type: "sine",
        freq: N.E6,
        t0,
        attack: 0.004,
        peak: T_MID * 0.85, // overlap with the A6 overtone pushed total to ~0.15;
        release: 0.45, //       trim so the bell sums to ~MID with its overtone
      });
      tone({
        type: "sine",
        freq: N.A6,
        t0,
        attack: 0.004,
        peak: 0.03, // was 0.04
        release: 0.3,
      });
    } catch {
      /* never throw */
    }
  }

  // ========================================================================
  // sockFound() — bonus sock sparkle. Ascending pentatonic arpeggio. Peak ≈ T_MID.
  // ========================================================================
  function sockFound() {
    try {
      const t0 = now() + 0.001;
      const freqs = [N.A5, N.Csharp6, N.E6, N.A6];
      freqs.forEach((f, i) => {
        tone({
          type: "sine",
          freq: f,
          t0: t0 + i * 0.05,
          attack: 0.005,
          peak: T_MID * 0.95 - i * 0.01, // was *0.65; arpeggio notes barely overlap
          release: 0.16, //                  so it sat at ~0.07, well under its tier
        });
      });
    } catch {
      /* never throw */
    }
  }

  // ========================================================================
  // birdChirp() — guide bird. Cheerful little chirp on pentatonic. Peak ≈ T_MID.
  // ========================================================================
  function birdChirp() {
    try {
      const t0 = now() + 0.001;
      // quick notes with upward pitch bends, in-scale, soft.
      const notes = [
        { f: N.A5, bend: N.Csharp6, t: 0.0, rel: 0.08 },
        { f: N.Csharp6, bend: N.E6, t: 0.09, rel: 0.07 },
        { f: N.A5, bend: N.E6, t: 0.17, rel: 0.09 },
      ];
      notes.forEach((n) => {
        tone({
          type: "sine",
          freq: n.f,
          freqEnd: n.bend,
          t0: t0 + n.t,
          attack: 0.008,
          peak: 0.095, // was 0.06 → chirps barely overlap, so it sat at ~0.056,
          release: n.rel, //  half its T_MID tier; raise so it reads as a clear blip
        });
      });
    } catch {
      /* never throw */
    }
  }

  // ========================================================================
  // gameStart() — warm welcoming "here we go" chime. Peak ≈ T_LOUD (0.16).
  // Rising pentatonic A4-C#5-E5-A5 with a soft warm pad. Loudest tier.
  // ========================================================================
  function gameStart() {
    try {
      const t0 = now() + 0.001;
      const seq = [N.A4, N.Csharp5, N.E5, N.A5];
      const lp = warmLowpass(t0, 3000, 0.7, 1400);
      seq.forEach((f, i) => {
        tone({
          type: "sine",
          freq: f,
          t0: t0 + i * 0.1,
          attack: 0.01,
          peak: T_LOUD * 0.7,
          release: 0.3,
          target: lp,
        });
        // gentle triangle doubling an octave down for warmth
        tone({
          type: "triangle",
          freq: f / 2,
          t0: t0 + i * 0.1,
          attack: 0.012,
          peak: 0.03, // was 0.04; doublings+pad overlapped, pushing total over tier
          release: 0.25,
          target: lp,
        });
      });
      // soft sustaining tonic pad to land on
      tone({
        type: "sine",
        freq: N.A3,
        t0: t0 + 0.3,
        attack: 0.06,
        peak: 0.045, // was 0.06; trimmed so gameStart lands at ~T_LOUD like gameEnd
        release: 0.7,
        target: lp,
      });
    } catch {
      /* never throw */
    }
  }

  // ========================================================================
  // gameEnd() — happy completion flourish. Peak ≈ T_LOUD (0.16). Loudest tier.
  // Triumphant rising pentatonic run resolving up to the high tonic + sparkle.
  // ========================================================================
  function gameEnd() {
    try {
      const t0 = now() + 0.001;
      const lp = warmLowpass(t0, 3400, 0.7, 1800);
      const run = [N.E4, N.Fsharp4, N.A4, N.Csharp5, N.E5, N.A5];
      run.forEach((f, i) => {
        tone({
          type: "sine",
          freq: f,
          t0: t0 + i * 0.075,
          attack: 0.008,
          peak: T_LOUD * 0.6,
          release: 0.25,
          target: lp,
        });
        tone({
          type: "triangle",
          freq: f / 2,
          t0: t0 + i * 0.075,
          attack: 0.01,
          peak: 0.035,
          release: 0.2,
          target: lp,
        });
      });
      // final resolved high tonic chime + a little sparkle above
      const landAt = t0 + run.length * 0.075;
      tone({
        type: "sine",
        freq: N.A5,
        t0: landAt,
        attack: 0.01,
        peak: T_LOUD * 0.8,
        release: 0.6,
        target: lp,
      });
      tone({
        type: "sine",
        freq: N.E6,
        t0: landAt + 0.03,
        attack: 0.01,
        peak: 0.05,
        release: 0.5,
        target: lp,
      });
      tone({
        type: "sine",
        freq: N.A6,
        t0: landAt + 0.06,
        attack: 0.01,
        peak: 0.035,
        release: 0.45,
        target: lp,
      });
    } catch {
      /* never throw */
    }
  }

  // ========================================================================
  // Washer loop — persistent until washerStop().
  // Documented bed peak ≈ 0.05 (idle) → 0.16 (full spin).
  // ========================================================================
  let washer = null;

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

      // --- low rumble: lowpass-filtered noise -----------------------------
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer();
      noise.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(WASH.baseCutoff, t0);
      lp.Q.setValueAtTime(0.7, t0);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.5, t0); // static mix (construction value)
      noise.connect(lp);
      lp.connect(noiseGain);
      noiseGain.connect(master);

      // --- low oscillator (~72Hz body) ------------------------------------
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(72, t0);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.6, t0);
      sub.connect(subGain);
      subGain.connect(master);

      // --- slosh modulation: LFO on a gain in the signal path -------------
      const sloshGain = ctx.createGain();
      sloshGain.gain.setValueAtTime(0.7, t0); // baseline center
      master.connect(sloshGain);
      sloshGain.connect(dest);

      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(WASH.baseSlosh, t0);
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.setValueAtTime(0.28, t0); // modulation depth
      lfo.connect(lfoDepth);
      lfoDepth.connect(sloshGain.gain);

      noise.start(t0);
      sub.start(t0);
      lfo.start(t0);

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
      washer = null;
      const t = now();

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

  // ========================================================================
  // Fan loop — persistent soft airy breeze until fanStop().
  // Mirrors the washer structure: held by reference, guarded double-start /
  // not-running stop, intensity scales level + brightness. Warm, no hiss.
  // Documented bed peak ≈ 0.035 (idle) → 0.11 (full).
  // ========================================================================
  let fan = null;

  const FAN = {
    baseGain: 0.035, // airy breeze level at x=0
    maxGain: 0.11, // breeze level at x=1
    baseCutoff: 600, // breeze brightness at x=0 (kept low/soft)
    maxCutoff: 1600, // breeze brightness at x=1
    baseWaver: 0.5, // gentle wander LFO Hz at x=0
    maxWaver: 1.4, // wander LFO Hz at x=1
    rampTime: 0.4,
  };

  function fanStart() {
    try {
      if (fan) return; // guard double-start
      const t0 = now();

      const master = ctx.createGain();
      master.gain.setValueAtTime(FLOOR, t0);

      // Airy breeze: lowpass + highpass noise band → soft "shhh", never hiss.
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer();
      noise.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.setValueAtTime(200, t0); // trim the low rumble
      hp.Q.setValueAtTime(0.5, t0);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(FAN.baseCutoff, t0); // soft top
      lp.Q.setValueAtTime(0.6, t0);
      noise.connect(hp);
      hp.connect(lp);
      lp.connect(master);

      // Gentle wandering amplitude so the breeze breathes (LFO on a gain).
      const waverGain = ctx.createGain();
      waverGain.gain.setValueAtTime(0.75, t0); // center
      master.connect(waverGain);
      waverGain.connect(dest);

      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(FAN.baseWaver, t0);
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.setValueAtTime(0.22, t0); // breathing depth
      lfo.connect(lfoDepth);
      lfoDepth.connect(waverGain.gain);

      noise.start(t0);
      lfo.start(t0);

      master.gain.setTargetAtTime(FAN.baseGain, t0, 0.15);

      fan = {
        master,
        waverGain,
        noise,
        hp,
        lp,
        lfo,
        lfoDepth,
        intensity: 0,
      };
    } catch {
      try {
        fanStop();
      } catch {
        /* ignore */
      }
    }
  }

  function fanSetIntensity(x) {
    try {
      if (!fan) return;
      const f = fan;
      const clamped = Math.max(0, Math.min(1, Number(x) || 0));
      const t = now();
      const tc = FAN.rampTime;

      const gain = FAN.baseGain + (FAN.maxGain - FAN.baseGain) * clamped;
      const cutoff = FAN.baseCutoff + (FAN.maxCutoff - FAN.baseCutoff) * clamped;
      const waver = FAN.baseWaver + (FAN.maxWaver - FAN.baseWaver) * clamped;

      f.master.gain.setTargetAtTime(Math.max(gain, FLOOR), t, tc);
      f.lp.frequency.setTargetAtTime(cutoff, t, tc);
      f.lfo.frequency.setTargetAtTime(waver, t, tc);
      f.intensity = clamped;
    } catch {
      /* never throw */
    }
  }

  function fanStop() {
    try {
      if (!fan) return; // guard not-running
      const f = fan;
      fan = null;
      const t = now();

      try {
        f.master.gain.cancelScheduledValues(t);
        f.master.gain.setValueAtTime(
          Math.max(f.master.gain.value || FLOOR, FLOOR),
          t
        );
        f.master.gain.exponentialRampToValueAtTime(FLOOR, t + 0.25);
      } catch {
        /* best-effort */
      }

      const stopAt = t + 0.3;
      [f.noise, f.lfo].forEach((node) => {
        try {
          node.stop(stopAt);
        } catch {
          /* may already be stopped */
        }
      });

      const tail = [
        f.master,
        f.waverGain,
        f.noise,
        f.hp,
        f.lp,
        f.lfo,
        f.lfoDepth,
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
    footstep,
    drop,
    die,
    caught,
    splash,
    pickup,
    load,
    hang,
    sockFound,
    birdChirp,
    gameStart,
    gameEnd,
    washerStart,
    washerSetIntensity,
    washerStop,
    fanStart,
    fanSetIntensity,
    fanStop,
  };
}
