export function blendHex(a, b, t) {
  const parse = (hex) => {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function garmentFill(piece, palette, highlighted) {
  const tinted = palette.clothTint
    ? blendHex(piece.hue, palette.clothTint, 0.3)
    : piece.hue;
  return highlighted ? blendHex(tinted, palette.accent, 0.18) : tinted;
}
