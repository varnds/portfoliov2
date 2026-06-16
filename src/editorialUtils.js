export function luminance(hex) {
  const raw = hex.replace("#", "");
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Season cloth on saturated accents; readable dark type on light accents (e.g. night gold). */
export function heroTextOnAccent(accent, cloth, ink) {
  if (luminance(accent) > 0.58) {
    return luminance(ink) < 0.5 ? ink : "#141414";
  }
  return cloth;
}

export const MONO = "'IBM Plex Mono', ui-monospace, monospace";
export const HEADER = "'Suranna', serif";
export const BODY = "'Source Sans 3', sans-serif";
