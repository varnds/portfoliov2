// Bach — Air on the G String (BWV 1068), public-domain woodwinds+strings arrangement.
// A FILE-backed background track for Wash Day, wrapped in the same controller
// interface as the procedural variants: createAirOnGString(ctx, dest) →
// { stop(), setIntensity(x) }. It streams via an <audio> element routed through a
// MediaElementSource so it goes through the music bus → master (mute applies).
//
// Level: the recording's RMS is ~0.089 (peak ~0.516) at full scale. BACH_LEVEL is
// tuned low so, through the music bus (~0.55), the music sits as a gentle bed
// (RMS ≈ 0.02) well UNDER the game SFX (which peak ~0.10–0.16). Tune BACH_LEVEL to
// taste — higher = louder music.
const BACH_LEVEL = 0.45;
const SRC = "/music/air-on-the-g-string.mp3";

export function createAirOnGString(ctx, dest) {
  if (!ctx || !dest) return { stop() {}, setIntensity() {} };
  let el = null;
  let node = null;
  let gain = null;
  let stopped = false;
  try {
    gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.connect(dest);
    el = new Audio(SRC);
    el.loop = true;
    el.preload = "auto";
    node = ctx.createMediaElementSource(el);
    node.connect(gain);
    el.play().catch(() => {
      /* if the browser blocks playback (no gesture yet) it stays silent — harmless */
    });
    // gentle fade-in so it eases in rather than punching on
    const t = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(BACH_LEVEL, t + 1.4);
  } catch {
    return { stop() {}, setIntensity() {} };
  }
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        try { el.pause(); } catch { /* ignore */ }
        try { node.disconnect(); } catch { /* ignore */ }
        try { gain.disconnect(); } catch { /* ignore */ }
      }, 460);
    },
    // while the washer runs, lift the music a hair — but keep it gentle.
    setIntensity(x) {
      try {
        const k = Math.max(0, Math.min(1, x || 0));
        gain.gain.setTargetAtTime(BACH_LEVEL * (1 + 0.12 * k), ctx.currentTime, 0.4);
      } catch {
        /* ignore */
      }
    },
  };
}
