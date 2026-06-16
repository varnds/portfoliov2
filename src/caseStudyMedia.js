const SLOT_LABELS = {
  overview: "Overview",
  discovery: "Discovery",
  final: "Final UI",
  exploration: "Exploration",
};

function buildMockupSvg(slot, ink, accent) {
  const label = SLOT_LABELS[slot] || SLOT_LABELS.overview;
  const safeInk = ink || "#141414";
  const safeAccent = accent || "#E11D48";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720" role="img" aria-label="${label}">
  <rect width="1200" height="720" fill="#F7F7F5"/>
  <rect x="64" y="48" width="1072" height="56" rx="8" fill="#FFFFFF" stroke="${safeInk}" stroke-opacity="0.06"/>
  <circle cx="96" cy="76" r="7" fill="${safeAccent}"/>
  <rect x="120" y="68" width="140" height="16" rx="4" fill="${safeInk}" fill-opacity="0.1"/>
  <rect x="64" y="136" width="240" height="520" rx="12" fill="#FFFFFF" stroke="${safeInk}" stroke-opacity="0.06"/>
  <rect x="88" y="168" width="120" height="10" rx="3" fill="${safeInk}" fill-opacity="0.12"/>
  <rect x="88" y="196" width="180" height="8" rx="2" fill="${safeInk}" fill-opacity="0.06"/>
  <rect x="88" y="220" width="156" height="8" rx="2" fill="${safeInk}" fill-opacity="0.06"/>
  <rect x="88" y="268" width="192" height="88" rx="8" fill="${safeAccent}" fill-opacity="0.1"/>
  <rect x="328" y="136" width="808" height="248" rx="14" fill="#FFFFFF" stroke="${safeInk}" stroke-opacity="0.06"/>
  <rect x="360" y="172" width="240" height="14" rx="4" fill="${safeInk}" fill-opacity="0.12"/>
  <rect x="360" y="204" width="420" height="10" rx="3" fill="${safeInk}" fill-opacity="0.06"/>
  <rect x="360" y="228" width="300" height="10" rx="3" fill="${safeInk}" fill-opacity="0.06"/>
  <rect x="360" y="272" width="128" height="40" rx="8" fill="${safeAccent}" fill-opacity="0.16"/>
  <rect x="328" y="408" width="392" height="248" rx="14" fill="#FFFFFF" stroke="${safeInk}" stroke-opacity="0.06"/>
  <rect x="360" y="440" width="200" height="12" rx="3" fill="${safeInk}" fill-opacity="0.1"/>
  <rect x="360" y="468" width="320" height="120" rx="10" fill="${safeInk}" fill-opacity="0.04"/>
  <rect x="744" y="408" width="392" height="248" rx="14" fill="#FFFFFF" stroke="${safeInk}" stroke-opacity="0.06"/>
  <rect x="776" y="440" width="200" height="12" rx="3" fill="${safeInk}" fill-opacity="0.1"/>
  <rect x="776" y="468" width="320" height="120" rx="10" fill="${safeAccent}" fill-opacity="0.08"/>
</svg>`;
}

const mockupCache = new Map();

export function getMockupSrc(_fabric, slot, _hue, ink, accent) {
  const key = `${slot}-${ink}-${accent}`;
  if (mockupCache.has(key)) return mockupCache.get(key);
  const safeSlot = SLOT_LABELS[slot] ? slot : "overview";
  const svg = buildMockupSvg(safeSlot, ink, accent);
  const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  mockupCache.set(key, uri);
  return uri;
}
