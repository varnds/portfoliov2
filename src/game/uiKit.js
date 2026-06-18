/** uiKit — one shared set of tokens so every play-mode HUD surface (rail, status
 *  pills, modal cards, primary buttons) reads as ONE cohesive system instead of
 *  a pile of slightly-different boxes. */
export const ACCENT = "#E2725B";
export const INK = "#3A2A20";
export const SUBINK = "#5A463A";
export const MUTE = "#9A8A7A";
export const MONO = "'IBM Plex Mono', monospace";
export const DISPLAY = "'Fraunces', serif";

// The one frosted-glass surface shared by every floating HUD panel/pill.
export const glass = {
  background: "rgba(255,253,247,0.82)",
  backdropFilter: "blur(12px) saturate(150%)",
  WebkitBackdropFilter: "blur(12px) saturate(150%)",
  border: "1px solid rgba(255,255,255,0.55)",
  boxShadow: "0 8px 22px rgba(58,42,32,0.14)",
};

// A small status pill (RUN!, lives, captions…).
export const pill = {
  ...glass,
  display: "flex",
  alignItems: "center",
  gap: 7,
  padding: "7px 13px",
  borderRadius: 999,
  fontFamily: MONO,
};

// A solid modal card (welcome, game-over, reveal).
export const card = {
  background: "#FFFDF7",
  borderRadius: 16,
  border: "1px solid rgba(226,114,91,0.14)",
  boxShadow: "0 20px 50px rgba(58,42,32,0.20)",
};

// The primary terracotta action button (size with padding/fontSize per use).
export const primaryBtn = {
  border: "none",
  cursor: "pointer",
  fontFamily: MONO,
  fontWeight: 700,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: "#fff",
  background: ACCENT,
  borderRadius: 999,
  boxShadow: "0 8px 20px rgba(226,114,91,0.30)",
};
