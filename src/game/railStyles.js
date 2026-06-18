/** Shared styling for the left control rail rows (Game / Cam / Player) — kept
 *  tight + consistent so the panel reads as one slim control group. */
const MONO = "'IBM Plex Mono', monospace";
const ACCENT = "#E2725B";

export const RAIL_LABEL = {
  fontFamily: MONO,
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: 1.3,
  textTransform: "uppercase",
  color: "#A89886",
  margin: "0 0 4px 2px",
};

export const RAIL_ROW = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
};

export function railChip(active) {
  return {
    border: active ? `1px solid ${ACCENT}` : "1px solid transparent",
    cursor: "pointer",
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: 700,
    padding: "4px 7px",
    borderRadius: 7,
    color: active ? "#fff" : "#6B574A",
    background: active ? ACCENT : "rgba(0,0,0,0.04)",
    transition: "background 0.2s ease, color 0.2s ease",
    whiteSpace: "nowrap",
    lineHeight: 1.1,
  };
}
