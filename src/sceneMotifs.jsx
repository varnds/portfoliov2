import React from "react";

/** Decorative clothesline rope — hangs above the card content */
export function MotifClothesline({ ink, accent, width = "100%" }) {
  return (
    <svg
      className="motif-clothesline"
      viewBox="0 0 400 28"
      preserveAspectRatio="none"
      aria-hidden
      style={{ width, height: 28, display: "block" }}
    >
      <path
        d="M0 8 Q100 22 200 10 T400 12"
        fill="none"
        stroke={ink}
        strokeWidth="1.5"
        strokeOpacity="0.35"
        className="motif-rope-sway"
      />
      <circle cx="200" cy="10" r="5" fill={accent} opacity="0.85" />
      <rect x="196" y="2" width="8" height="6" rx="1" fill="#C68A4E" />
    </svg>
  );
}

/** Home-scene sky — same gradient stops, sun glow, and soft clouds */
export function MotifSeasonSky({ sky1, sky2, sky3, sun, ink, showSun = true, className = "" }) {
  const uid = React.useId().replace(/:/g, "");
  return (
    <svg
      className={`motif-season-sky ${className}`.trim()}
      viewBox="0 0 400 220"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={`ov-sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky1} />
          <stop offset="55%" stopColor={sky2} />
          <stop offset="100%" stopColor={sky3} />
        </linearGradient>
        <radialGradient id={`ov-sunGlow-${uid}`} cx="78%" cy="22%" r="40%">
          <stop offset="0%" stopColor={sun || sky2} stopOpacity="0.4" />
          <stop offset="35%" stopColor={sky2} stopOpacity="0.18" />
          <stop offset="100%" stopColor={sky2} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`ov-sunDisk-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={sun || sky2} stopOpacity="1" />
          <stop offset="62%" stopColor={sun || sky2} stopOpacity="0.92" />
          <stop offset="82%" stopColor={sun || sky2} stopOpacity="0.28" />
          <stop offset="100%" stopColor={sun || sky2} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="220" fill={`url(#ov-sky-${uid})`} />
      {showSun && (
        <>
          <rect width="400" height="220" fill={`url(#ov-sunGlow-${uid})`} />
          <circle cx="312" cy="48" r="30" fill={`url(#ov-sunDisk-${uid})`} />
        </>
      )}
      <g fill="#FFFFFF" opacity="0.72">
        <ellipse cx="72" cy="58" rx="38" ry="13" />
        <ellipse cx="48" cy="64" rx="26" ry="10" />
        <ellipse cx="94" cy="65" rx="28" ry="9" />
      </g>
      <g fill="#FFFFFF" opacity="0.58">
        <ellipse cx="248" cy="78" rx="34" ry="12" />
        <ellipse cx="226" cy="84" rx="24" ry="9" />
        <ellipse cx="268" cy="85" rx="26" ry="8" />
      </g>
      {showSun && (
        <g stroke={ink} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.35">
          <path d="M28 118 q8 -7 15 0 q7 -7 14 0" />
          <path d="M58 128 q6 -5 11 0 q5 -5 11 0" />
        </g>
      )}
    </svg>
  );
}

/** Same hill paths as the home SVG scene */
export function MotifSeasonHills({ hill1, hill2, hill3, className = "" }) {
  return (
    <svg
      className={`motif-season-hills ${className}`.trim()}
      viewBox="-320 360 1680 280"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
    >
      <path
        d="M -320 640 L -320 440 Q 250 370, 550 450 T 1360 410 L 1360 640 Z"
        fill={hill1}
      />
      <path
        d="M -320 640 L -320 480 Q 350 430, 750 480 T 1360 450 L 1360 640 Z"
        fill={hill2}
      />
      <path
        d="M -320 640 L -320 500 Q 150 470, 450 515 T 1360 495 L 1360 640 Z"
        fill={hill3}
      />
    </svg>
  );
}

/** @deprecated use MotifSeasonSky */
export function MotifSkyStrip(props) {
  return <MotifSeasonSky {...props} className="motif-sky-strip" />;
}

/** @deprecated use MotifSeasonHills */
export function MotifHills(props) {
  return <MotifSeasonHills {...props} className="motif-hills" />;
}

/** Subtle SVG fabric pattern tile */
export function MotifFabricPattern({ fabric, ink, accent, opacity = 0.06 }) {
  const id = `fabric-${fabric}`;
  return (
    <svg className="motif-fabric" width="100%" height="100%" aria-hidden>
      <defs>
        {fabric === "weave" && (
          <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M0 8 L8 0 M-2 2 L2 -2 M6 10 L10 6" stroke={ink} strokeWidth="0.6" opacity={opacity * 8} />
          </pattern>
        )}
        {fabric === "dots" && (
          <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="5" cy="5" r="1.2" fill={accent} opacity={opacity * 10} />
          </pattern>
        )}
        {fabric === "stripe" && (
          <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke={ink} strokeWidth="1" opacity={opacity * 8} />
          </pattern>
        )}
        {fabric === "plain" && (
          <pattern id={id} width="1" height="1">
            <rect width="1" height="1" fill="transparent" />
          </pattern>
        )}
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** Small clothespin marker for section breaks */
export function MotifClothespin({ accent }) {
  return (
    <span className="motif-peg" aria-hidden>
      <svg width="14" height="18" viewBox="0 0 14 18">
        <rect x="3" y="0" width="8" height="5" rx="1" fill="#C68A4E" />
        <path d="M4 5 L4 16 Q7 17 10 16 L10 5 Z" fill={accent} opacity="0.75" />
      </svg>
    </span>
  );
}

/** Garment swatch — hue + fabric hint from the clicked piece */
export function MotifGarmentSwatch({ hue, fabric, accent, ink }) {
  return (
    <div className="motif-garment-swatch" style={{ background: hue, borderColor: `${ink}18` }}>
      <div className="motif-garment-swatch-inner">
        <MotifFabricPattern fabric={fabric} ink={ink} accent={accent} opacity={0.12} />
      </div>
      <span className="motif-garment-pin" style={{ background: accent }} />
    </div>
  );
}
