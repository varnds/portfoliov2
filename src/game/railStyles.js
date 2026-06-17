/** Shared styling for the left control rail rows (Game / Cam / Player) so the
 *  consolidated panel reads as one tidy, consistent control group. */
const MONO = "'IBM Plex Mono', monospace";
const ACCENT = "#E2725B";

export const RAIL_LABEL = {
  fontFamily: MONO,
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 1.4,
  textTransform: "uppercase",
  color: "#9A8A7A",
  margin: "0 0 5px 2px",
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
    fontSize: 10.5,
    fontWeight: 700,
    padding: "5px 8px",
    borderRadius: 999,
    color: active ? "#fff" : "#5A463A",
    background: active ? ACCENT : "rgba(0,0,0,0.045)",
    transition: "background 0.2s ease, color 0.2s ease",
    whiteSpace: "nowrap",
    lineHeight: 1.1,
  };
}
