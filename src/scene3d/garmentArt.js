import * as THREE from "three";

/**
 * garmentArt — draws each garment as a flat 2D illustration on a transparent
 * canvas (silhouette shape via clipping, printed pattern, accent trim/bands),
 * matching the 2D clothesline art. The texture is then mapped onto a thin flat
 * panel in the 3D scene so the clothes read as "2D drawings standing in a 3D
 * world" that ripple in the breeze — rather than volumetric cloth.
 */

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function mix(hex, target, t) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
const lighten = (hex, t) => mix(hex, "#FFFFFF", t);
const darken = (hex, t) => mix(hex, "#3A2418", t);

// Warm cream cloth base + terracotta line ink, like the 2D pieces.
const BASE = "#F0E6D2";
const BASE_SHADE = "#E7D9BD";
const INK = "#3A2E24";

// ── pattern fills (called inside an active clip path) ───────────────────────────
function fillBase(ctx, w, h, base) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  // faint vertical drape shading so the flat cloth isn't dead-flat
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "rgba(0,0,0,0.06)");
  g.addColorStop(0.5, "rgba(255,255,255,0.05)");
  g.addColorStop(1, "rgba(0,0,0,0.07)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
function dots(ctx, w, h, accent, step = 34, ring = true) {
  for (let y = step * 0.5; y < h; y += step) {
    for (let x = step * 0.5; x < w; x += step) {
      const r = step * 0.13;
      if (ring) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = step * 0.06;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = mix(accent, "#FFFFFF", 0.35);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
function floral(ctx, w, h, accent, step = 70) {
  ctx.fillStyle = accent;
  for (let y = step * 0.5; y < h; y += step) {
    for (let x = step * 0.5; x < w; x += step) {
      const off = ((Math.round(y / step)) % 2) * step * 0.5;
      const cx = x + off;
      const pr = step * 0.085;
      const d = step * 0.16;
      // four petals + center
      [[0, -d], [0, d], [-d, 0], [d, 0]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.ellipse(cx + dx, y + dy, pr, pr * 1.5, dx !== 0 ? Math.PI / 2 : 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.beginPath();
      ctx.arc(cx, y, pr * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
function diagHatch(ctx, w, h, accent) {
  const grey = "#A9A296";
  ctx.lineWidth = 3;
  for (let k = -h; k < w + h; k += 26) {
    ctx.strokeStyle = (Math.round(k / 26) % 2) ? mix(accent, "#FFFFFF", 0.2) : grey;
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k + h, h);
    ctx.stroke();
  }
}
function vSeams(ctx, w, h, accent, n = 4) {
  ctx.strokeStyle = mix(accent, "#FFFFFF", 0.1);
  ctx.lineWidth = 2;
  for (let i = 1; i < n; i += 1) {
    const x = (w * i) / n;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
}

// ── garment silhouettes + details. Each returns canvas px size + world height. ──
// Drawn in a tall transparent canvas; everything outside the clipped path stays
// transparent, so the panel shows only the garment shape.

function paint(cw, ch, hWorld, drawFn) {
  return { cw, ch, hWorld, drawFn };
}

const GARMENTS = {
  // Polka-dot A-line dress with straps, scoop neck and two hem bands.
  LEHENGA: paint(380, 660, 2.1, (ctx, A) => {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(132, 24);                 // left strap top
      ctx.quadraticCurveTo(120, 70, 110, 120);
      ctx.lineTo(86, 250);                 // bodice → waist
      ctx.quadraticCurveTo(40, 470, 48, 632); // A-line skirt left
      ctx.quadraticCurveTo(190, 660, 332, 632); // hem
      ctx.quadraticCurveTo(340, 470, 294, 250); // skirt right
      ctx.lineTo(270, 120);
      ctx.quadraticCurveTo(260, 70, 248, 24); // right strap top
      ctx.quadraticCurveTo(190, 96, 132, 24);  // scoop neckline
      ctx.closePath();
    };
    ctx.save(); path(); ctx.clip();
    fillBase(ctx, A.cw, A.ch, BASE);
    dots(ctx, A.cw, A.ch, A.accent, 34, true);
    // hem bands following the curve
    ctx.lineWidth = 16; ctx.strokeStyle = lighten(A.accent, 0.2);
    ctx.beginPath(); ctx.moveTo(52, 600); ctx.quadraticCurveTo(190, 632, 328, 600); ctx.stroke();
    ctx.lineWidth = 22; ctx.strokeStyle = darken(A.accent, 0.12);
    ctx.beginPath(); ctx.moveTo(50, 628); ctx.quadraticCurveTo(190, 660, 330, 628); ctx.stroke();
    ctx.restore();
    // neckline trim
    ctx.strokeStyle = A.accent; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(132, 24); ctx.quadraticCurveTo(190, 96, 248, 24); ctx.stroke();
  }),

  // Floral jumpsuit: straight body, V-neck, wide split legs with cuffs.
  KURTA: paint(360, 680, 2.1, (ctx, A) => {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(92, 40);
      ctx.lineTo(300, 40);
      ctx.lineTo(300, 470);
      ctx.lineTo(218, 470);
      ctx.lineTo(214, 624);             // right leg inner
      ctx.lineTo(298, 624);
      ctx.lineTo(300, 470 + 4);
      ctx.lineTo(300, 472);
      ctx.lineTo(300, 624);             // right leg outer (kept straight)
      ctx.lineTo(214, 624);
      ctx.lineTo(196, 452);             // crotch notch up
      ctx.lineTo(178, 624);             // left leg inner
      ctx.lineTo(94, 624);
      ctx.lineTo(92, 40);
      ctx.closePath();
    };
    // simpler robust outline (two legs)
    ctx.beginPath();
    ctx.moveTo(92, 40); ctx.lineTo(300, 40);
    ctx.lineTo(300, 624); ctx.lineTo(214, 624);
    ctx.lineTo(198, 452); ctx.lineTo(180, 624);
    ctx.lineTo(94, 624); ctx.closePath();
    ctx.save(); ctx.clip();
    fillBase(ctx, A.cw, A.ch, BASE);
    floral(ctx, A.cw, A.ch, A.accent, 64);
    // cuffs
    ctx.fillStyle = lighten(A.accent, 0.18);
    ctx.fillRect(94, 604, 86, 20);
    ctx.fillRect(214, 604, 86, 20);
    ctx.restore();
    // V-neck
    ctx.strokeStyle = INK; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(196, 40); ctx.lineTo(196, 200);
    ctx.moveTo(168, 44); ctx.lineTo(196, 200); ctx.moveTo(224, 44); ctx.lineTo(196, 200);
    ctx.stroke();
  }),

  // Pants / leggings: waist tapering to two legs with vertical seams + cuffs.
  CHURIDAR: paint(300, 600, 2.0, (ctx, A) => {
    ctx.beginPath();
    ctx.moveTo(60, 36); ctx.lineTo(240, 36);
    ctx.lineTo(232, 320); ctx.lineTo(214, 560); ctx.lineTo(158, 560);
    ctx.lineTo(150, 300); ctx.lineTo(142, 560); ctx.lineTo(86, 560);
    ctx.lineTo(68, 320); ctx.closePath();
    ctx.save(); ctx.clip();
    fillBase(ctx, A.cw, A.ch, BASE_SHADE);
    dots(ctx, A.cw, A.ch, A.accent, 30, false);
    vSeams(ctx, A.cw, A.ch, A.accent, 5);
    ctx.fillStyle = lighten(A.accent, 0.18);
    ctx.fillRect(86, 540, 56, 20); ctx.fillRect(158, 540, 56, 20);
    ctx.restore();
  }),

  // Tights: two close legs, diagonal hatch, knee curves.
  SAREE: paint(260, 620, 2.0, (ctx, A) => {
    ctx.beginPath();
    ctx.moveTo(40, 32); ctx.lineTo(220, 32);
    ctx.lineTo(206, 300); ctx.lineTo(176, 590); ctx.lineTo(140, 590);
    ctx.lineTo(130, 320); ctx.lineTo(120, 590); ctx.lineTo(84, 590);
    ctx.lineTo(54, 300); ctx.closePath();
    ctx.save(); ctx.clip();
    fillBase(ctx, A.cw, A.ch, "#F2EAD9");
    diagHatch(ctx, A.cw, A.ch, A.accent);
    // knee curve stitch lines
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    [430, 470, 510, 550].forEach((y) => {
      ctx.beginPath(); ctx.moveTo(70, y); ctx.quadraticCurveTo(105, y + 14, 132, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(132, y); ctx.quadraticCurveTo(160, y + 14, 192, y); ctx.stroke();
    });
    ctx.restore();
  }),

  // Polka-dot wrap/towel: flat panel, vertical folds, a folded-over top corner
  // showing the peach underside, and a hem band.
  DUPATTA: paint(420, 600, 2.0, (ctx, A) => {
    ctx.beginPath();
    ctx.moveTo(40, 40); ctx.lineTo(380, 40);
    ctx.lineTo(372, 560); ctx.quadraticCurveTo(210, 588, 48, 560); ctx.closePath();
    ctx.save(); ctx.clip();
    fillBase(ctx, A.cw, A.ch, BASE);
    dots(ctx, A.cw, A.ch, A.accent, 32, true);
    vSeams(ctx, A.cw, A.ch, A.accent, 6);
    ctx.lineWidth = 20; ctx.strokeStyle = darken(A.accent, 0.1);
    ctx.beginPath(); ctx.moveTo(50, 548); ctx.quadraticCurveTo(210, 580, 366, 548); ctx.stroke();
    ctx.restore();
    // folded-over top-right corner (peach underside)
    ctx.fillStyle = lighten(A.accent, 0.25);
    ctx.beginPath(); ctx.moveTo(300, 40); ctx.lineTo(380, 40); ctx.lineTo(380, 230);
    ctx.quadraticCurveTo(330, 150, 300, 40); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = A.accent;
    [[345, 120], [360, 180], [330, 90]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 8, y + 6); ctx.lineTo(x - 8, y + 6); ctx.closePath(); ctx.stroke();
    });
  }),

  // Small sock.
  SOCK: paint(150, 260, 1.15, (ctx, A) => {
    ctx.beginPath();
    ctx.moveTo(48, 24); ctx.lineTo(104, 24);
    ctx.lineTo(110, 150); ctx.quadraticCurveTo(112, 200, 80, 232);
    ctx.quadraticCurveTo(44, 240, 40, 200); ctx.lineTo(40, 60); ctx.closePath();
    ctx.save(); ctx.clip();
    fillBase(ctx, A.cw, A.ch, BASE);
    dots(ctx, A.cw, A.ch, A.accent, 24, false);
    ctx.fillStyle = lighten(A.accent, 0.2); ctx.fillRect(40, 24, 70, 16);
    ctx.restore();
  }),
};

const cache = new Map();

/** Returns { texture, w, h } — a transparent garment illustration + world size. */
export function drawGarmentArt(typeKey, accentHex) {
  const key = `${typeKey}|${accentHex}`;
  if (cache.has(key)) return cache.get(key);
  const spec = GARMENTS[typeKey] || GARMENTS.KURTA;
  const canvas = document.createElement("canvas");
  canvas.width = spec.cw;
  canvas.height = spec.ch;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, spec.cw, spec.ch);
  spec.drawFn(ctx, { cw: spec.cw, ch: spec.ch, accent: accentHex });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const out = { texture, w: spec.hWorld * (spec.cw / spec.ch), h: spec.hWorld };
  cache.set(key, out);
  return out;
}
