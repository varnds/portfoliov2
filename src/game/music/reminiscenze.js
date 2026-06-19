// "Reminiscenze" (1920, Lisanella Gentili), public-domain string arrangement from
// Classicals.de — the background track for the CHASE mode. Same controller shape
// as the procedural variants and the Bach track: createReminiscenze(ctx, dest) →
// { stop(), setIntensity(x) }. Streams via an <audio> element through a
// MediaElementSource so it routes music bus → master (the mute applies).
//
// Level: this recording's RMS is ~0.0515 (peak ~0.528) at full scale — quieter
// than the Bach track, so REMIN_LEVEL is a bit higher to stay audible while still
// sitting WELL UNDER the in-game SFX. Through the music bus (~0.55) the sustained
// bed is RMS ≈ 0.018 (SFX peak ~0.10–0.16), so the chase sounds cut through.
// Tune REMIN_LEVEL to taste — higher = louder music.
const REMIN_LEVEL = 0.65;
const SRC = "/music/reminiscenze.mp3";

export function createReminiscenze(ctx, dest) {
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
    // gentle fade-in so it eases in when the chase begins rather than punching on
    const t = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(REMIN_LEVEL, t + 1.4);
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
    setIntensity(x) {
      try {
        const k = Math.max(0, Math.min(1, x || 0));
        gain.gain.setTargetAtTime(REMIN_LEVEL * (1 + 0.1 * k), ctx.currentTime, 0.4);
      } catch {
        /* ignore */
      }
    },
  };
}
