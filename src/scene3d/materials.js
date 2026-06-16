import * as THREE from "three";

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function createFabricTexture(fabric, baseHex, accentHex) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const base = hexToRgb(baseHex);
  const accent = hexToRgb(accentHex);
  const rand = seededRng(base.r * 17 + base.g * 31 + base.b * 7);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  // Soft cloth grain
  for (let i = 0; i < 2400; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const g = (rand() - 0.5) * 14;
    ctx.fillStyle = `rgba(${base.r + g},${base.g + g},${base.b + g},${0.04 + rand() * 0.05})`;
    ctx.fillRect(x, y, 1.2 + rand(), 1.2 + rand());
  }

  if (fabric === "dots") {
    for (let y = 0; y < size; y += 26) {
      for (let x = 0; x < size; x += 26) {
        const jx = (rand() - 0.5) * 8;
        const jy = (rand() - 0.5) * 8;
        const r = 4.5 + rand() * 3.5;
        ctx.fillStyle = `rgba(${accent.r},${accent.g},${accent.b},${0.55 + rand() * 0.25})`;
        ctx.beginPath();
        ctx.arc(x + 13 + jx, y + 13 + jy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (fabric === "stripe") {
    for (let y = 0; y < size; y += 48) {
      ctx.fillStyle = `rgba(${accent.r},${accent.g},${accent.b},0.42)`;
      ctx.fillRect(0, y, size, 14);
      ctx.fillStyle = `rgba(${accent.r},${accent.g},${accent.b},0.18)`;
      ctx.fillRect(0, y + 18, size, 6);
    }
  } else if (fabric === "weave") {
    for (let y = 0; y < size; y += 34) {
      for (let x = 0; x < size; x += 34) {
        const jx = (rand() - 0.5) * 6;
        const jy = (rand() - 0.5) * 6;
        ctx.fillStyle = `rgba(${accent.r},${accent.g},${accent.b},${0.35 + rand() * 0.2})`;
        ctx.beginPath();
        const cx = x + 17 + jx;
        const cy = y + 17 + jy;
        for (let p = 0; p < 6; p += 1) {
          const a = (p / 6) * Math.PI * 2;
          const px = cx + Math.cos(a) * (5 + rand() * 2);
          const py = cy + Math.sin(a) * (5 + rand() * 2);
          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.4, 1.4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createWoodTexture(baseHex = "#B8895A") {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const base = hexToRgb(baseHex);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i += 1) {
    const y = (i / 40) * size;
    const g = (Math.random() - 0.5) * 22;
    ctx.strokeStyle = `rgba(${base.r + g},${base.g + g},${base.b + g},0.35)`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.random() * 4);
    ctx.bezierCurveTo(size * 0.3, y + 8, size * 0.7, y - 6, size, y + Math.random() * 4);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFabricMaterial(fill, map, accentHex) {
  const sheen = new THREE.Color(accentHex).lerp(new THREE.Color("#FFF6EA"), 0.72);
  return new THREE.MeshPhysicalMaterial({
    color: fill,
    map,
    // Soft matte cloth: high roughness, no metalness, faint fabric sheen. The
    // garment is now a thin single-sided draping sheet, so render both faces.
    roughness: 0.95,
    metalness: 0,
    sheen: 0.4,
    sheenRoughness: 0.85,
    sheenColor: sheen,
    side: THREE.DoubleSide,
  });
}

export const WOOD = { color: "#A07850", roughness: 0.78, metalness: 0.02 };
export const ROPE = { color: "#5C3820", roughness: 0.96, metalness: 0.01 };
export const WICKER = { color: "#DCC4A0", roughness: 0.96, metalness: 0.01 };
