import * as THREE from 'three';

// ── Procedural Texture Library ──
// All textures are 512×512 Canvas2D — no external files needed.

const cache = new Map();

/** Simple seeded pseudo-random for reproducible textures */
function seededRandom(seed) {
  let s = seed | 0;
  return () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
}

/** Perlin-ish value noise (simple grid interpolation) */
function valueNoise(ctx, w, h, scale, alpha, color) {
  const gw = Math.ceil(w / scale) + 2;
  const gh = Math.ceil(h / scale) + 2;
  const rand = seededRandom(42);
  const grid = Array.from({ length: gw * gh }, () => rand());

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = x / scale;
      const gy = y / scale;
      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      const fx = gx - ix;
      const fy = gy - iy;
      const sfx = fx * fx * (3 - 2 * fx);
      const sfy = fy * fy * (3 - 2 * fy);

      const v00 = grid[iy * gw + ix];
      const v10 = grid[iy * gw + ix + 1];
      const v01 = grid[(iy + 1) * gw + ix];
      const v11 = grid[(iy + 1) * gw + ix + 1];

      const v = (v00 * (1 - sfx) + v10 * sfx) * (1 - sfy) +
                (v01 * (1 - sfx) + v11 * sfx) * sfy;

      const idx = (y * w + x) * 4;
      d[idx]     = Math.min(255, d[idx]     + r * v * alpha);
      d[idx + 1] = Math.min(255, d[idx + 1] + g * v * alpha);
      d[idx + 2] = Math.min(255, d[idx + 2] + b * v * alpha);
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

/** Generate normal map from heightmap canvas (Sobel) */
function generateNormalFromHeight(srcCanvas) {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const srcCtx = srcCanvas.getContext('2d');
  const srcData = srcCtx.getImageData(0, 0, w, h).data;

  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = w;
  dstCanvas.height = h;
  const dstCtx = dstCanvas.getContext('2d');
  const dstImg = dstCtx.createImageData(w, h);
  const dd = dstImg.data;

  function lum(x, y) {
    const cx = ((x % w) + w) % w;
    const cy = ((y % h) + h) % h;
    const i = (cy * w + cx) * 4;
    return (srcData[i] * 0.299 + srcData[i + 1] * 0.587 + srcData[i + 2] * 0.114) / 255;
  }

  const strength = 2.0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = lum(x - 1, y - 1);
      const t  = lum(x,     y - 1);
      const tr = lum(x + 1, y - 1);
      const l  = lum(x - 1, y);
      const r  = lum(x + 1, y);
      const bl = lum(x - 1, y + 1);
      const b  = lum(x,     y + 1);
      const br = lum(x + 1, y + 1);

      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);

      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len; ny /= len; nz /= len;

      const i = (y * w + x) * 4;
      dd[i]     = Math.round((nx * 0.5 + 0.5) * 255);
      dd[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      dd[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      dd[i + 3] = 255;
    }
  }
  dstCtx.putImageData(dstImg, 0, 0);
  return dstCanvas;
}

// ── Texture generators ──

function drawWoodPlanks(ctx, w, h, baseR, baseG, baseB, plankH, grainDensity) {
  const rand = seededRandom(baseR * 100 + baseG * 10 + baseB);
  // Planks
  for (let y = 0; y < h; y += plankH) {
    const variation = (rand() - 0.5) * 30;
    const pr = Math.max(0, Math.min(255, baseR + variation));
    const pg = Math.max(0, Math.min(255, baseG + variation * 0.8));
    const pb = Math.max(0, Math.min(255, baseB + variation * 0.6));
    ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
    ctx.fillRect(0, y, w, plankH - 1);

    // Grain lines
    for (let g = 0; g < grainDensity; g++) {
      const gy = y + rand() * plankH;
      const alpha = 0.05 + rand() * 0.1;
      ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
      ctx.lineWidth = 0.5 + rand();
      ctx.beginPath();
      ctx.moveTo(0, gy);
      let cx = 0;
      while (cx < w) {
        cx += 20 + rand() * 40;
        const cy = gy + (rand() - 0.5) * 3;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    // Gap between planks
    ctx.fillStyle = `rgba(0,0,0,0.3)`;
    ctx.fillRect(0, y + plankH - 1, w, 1);
  }
}

function drawHerringbone(ctx, w, h) {
  const plankW = 64;
  const plankH = 16;
  const rand = seededRandom(7777);

  ctx.fillStyle = '#8B7355';
  ctx.fillRect(0, 0, w, h);

  for (let row = -2; row < h / plankH + 2; row++) {
    for (let col = -2; col < w / plankW + 2; col++) {
      const isEven = (row + col) % 2 === 0;
      const variation = (rand() - 0.5) * 25;
      const r = Math.min(255, 139 + variation);
      const g = Math.min(255, 115 + variation * 0.8);
      const b = Math.min(255, 85 + variation * 0.6);
      ctx.fillStyle = `rgb(${r},${g},${b})`;

      ctx.save();
      const cx = col * plankW;
      const cy = row * plankH;
      ctx.translate(cx + plankW / 2, cy + plankH / 2);
      ctx.rotate(isEven ? Math.PI / 4 : -Math.PI / 4);
      ctx.fillRect(-plankW / 2, -plankH / 2, plankW - 1, plankH - 1);
      ctx.restore();
    }
  }
}

function drawMarble(ctx, w, h, baseR, baseG, baseB, veinColor) {
  // Base color
  ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
  ctx.fillRect(0, 0, w, h);

  // Subtle base variation
  valueNoise(ctx, w, h, 80, 0.15, '#808080');

  // Veins using layered sine curves
  const rand = seededRandom(baseR * 7 + baseG);
  for (let v = 0; v < 8; v++) {
    const startY = rand() * h;
    const amplitude = 30 + rand() * 80;
    const freq = 0.005 + rand() * 0.01;
    const phase = rand() * Math.PI * 2;
    const thickness = 0.5 + rand() * 2;
    const alpha = 0.1 + rand() * 0.2;

    ctx.strokeStyle = veinColor.replace(')', `,${alpha})`).replace('rgb', 'rgba');
    ctx.lineWidth = thickness;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const y = startY + Math.sin(x * freq + phase) * amplitude
                + Math.sin(x * freq * 2.3 + phase * 1.7) * amplitude * 0.3;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawTileSquare(ctx, w, h) {
  const tileSize = 64;
  const grout = 3;
  const rand = seededRandom(5555);

  ctx.fillStyle = '#888'; // grout
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < h; y += tileSize) {
    for (let x = 0; x < w; x += tileSize) {
      const variation = (rand() - 0.5) * 15;
      const r = Math.min(255, 220 + variation);
      const g = Math.min(255, 215 + variation);
      const b = Math.min(255, 210 + variation);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + grout, y + grout, tileSize - grout * 2, tileSize - grout * 2);
    }
  }
}

function drawTileHex(ctx, w, h) {
  const radius = 30;
  const rand = seededRandom(6666);
  ctx.fillStyle = '#888';
  ctx.fillRect(0, 0, w, h);

  const dx = radius * Math.sqrt(3);
  const dy = radius * 1.5;

  for (let row = -1; row < h / dy + 1; row++) {
    for (let col = -1; col < w / dx + 1; col++) {
      const cx = col * dx + (row % 2 === 0 ? 0 : dx / 2);
      const cy = row * dy;

      const variation = (rand() - 0.5) * 20;
      const r = Math.min(255, 200 + variation);
      const g = Math.min(255, 195 + variation);
      const b = Math.min(255, 190 + variation);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i - Math.PI / 6;
        const px = cx + (radius - 2) * Math.cos(angle);
        const py = cy + (radius - 2) * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawTileSubway(ctx, w, h) {
  const tileW = 80;
  const tileH = 36;
  const grout = 2;
  const rand = seededRandom(4444);

  ctx.fillStyle = '#999';
  ctx.fillRect(0, 0, w, h);

  for (let row = 0; row < h / tileH + 1; row++) {
    const offset = (row % 2) * tileW / 2;
    for (let col = -1; col < w / tileW + 1; col++) {
      const x = col * tileW + offset;
      const y = row * tileH;
      const variation = (rand() - 0.5) * 12;
      const r = Math.min(255, 230 + variation);
      const g = Math.min(255, 228 + variation);
      const b = Math.min(255, 225 + variation);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + grout, y + grout, tileW - grout * 2, tileH - grout * 2);
    }
  }
}

function drawConcrete(ctx, w, h, roughLevel) {
  const base = roughLevel === 'rough' ? 140 : 170;
  ctx.fillStyle = `rgb(${base},${base - 5},${base - 10})`;
  ctx.fillRect(0, 0, w, h);

  // Noise dots
  const rand = seededRandom(3333);
  const dotCount = roughLevel === 'rough' ? 8000 : 3000;
  for (let i = 0; i < dotCount; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const alpha = rand() * 0.15;
    const dark = rand() > 0.5;
    ctx.fillStyle = dark ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha * 0.5})`;
    ctx.fillRect(x, y, 1 + rand() * 2, 1 + rand() * 2);
  }

  // Subtle cracks
  if (roughLevel === 'rough') {
    for (let c = 0; c < 5; c++) {
      ctx.strokeStyle = `rgba(0,0,0,${0.05 + rand() * 0.08})`;
      ctx.lineWidth = 0.5 + rand();
      ctx.beginPath();
      let cx = rand() * w, cy = rand() * h;
      ctx.moveTo(cx, cy);
      for (let s = 0; s < 8; s++) {
        cx += (rand() - 0.5) * 60;
        cy += rand() * 40;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  }
}

function drawStone(ctx, w, h, baseR, baseG, baseB, style) {
  ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
  ctx.fillRect(0, 0, w, h);

  valueNoise(ctx, w, h, 40, 0.2, '#606050');

  // Vein patterns
  const rand = seededRandom(baseR * 3 + baseB);
  const veinCount = style === 'travertine' ? 12 : 8;
  for (let v = 0; v < veinCount; v++) {
    const alpha = 0.04 + rand() * 0.08;
    ctx.strokeStyle = style === 'travertine'
      ? `rgba(180,160,120,${alpha})`
      : `rgba(60,70,80,${alpha})`;
    ctx.lineWidth = 1 + rand() * 3;
    ctx.beginPath();
    let sx = rand() * w, sy = rand() * h;
    ctx.moveTo(sx, sy);
    for (let s = 0; s < 6; s++) {
      if (style === 'travertine') {
        sx += (rand() - 0.5) * 100;
        sy += 20 + rand() * 40;
      } else {
        sx += 30 + rand() * 50;
        sy += (rand() - 0.5) * 80;
      }
      ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }
}

function drawConcreteEpoxy(ctx, w, h) {
  // Base: medium gray concrete
  ctx.fillStyle = '#9A9590';
  ctx.fillRect(0, 0, w, h);

  // Subtle aggregate speckles beneath the epoxy
  const rand = seededRandom(8888);
  for (let i = 0; i < 4000; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const size = 1 + rand() * 3;
    const bright = rand() > 0.5;
    const alpha = rand() * 0.08;
    ctx.fillStyle = bright
      ? `rgba(255,255,255,${alpha})`
      : `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle color depth variation (epoxy has slight translucency)
  valueNoise(ctx, w, h, 100, 0.06, '#A0A0B0');

  // Glossy highlight streaks (from trowel/roller marks)
  for (let s = 0; s < 6; s++) {
    const sy = rand() * h;
    const alpha = 0.03 + rand() * 0.04;
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 10 + rand() * 30;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    let cx = 0;
    while (cx < w) {
      cx += 50 + rand() * 100;
      const cy = sy + (rand() - 0.5) * 15;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
}

function drawPlaster(ctx, w, h) {
  ctx.fillStyle = '#E8DDD0';
  ctx.fillRect(0, 0, w, h);
  valueNoise(ctx, w, h, 30, 0.08, '#B0A090');

  // Very subtle speckles
  const rand = seededRandom(2222);
  for (let i = 0; i < 2000; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.fillStyle = `rgba(0,0,0,${rand() * 0.03})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

// ── Canvas generator dispatch ──

function generateTextureCanvas(type) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  switch (type) {
    case 'wood_oak':
      drawWoodPlanks(ctx, size, size, 160, 130, 90, 32, 6);
      break;
    case 'wood_walnut':
      drawWoodPlanks(ctx, size, size, 90, 65, 45, 28, 8);
      break;
    case 'wood_ash':
      drawWoodPlanks(ctx, size, size, 190, 175, 155, 30, 5);
      break;
    case 'wood_herringbone':
      drawHerringbone(ctx, size, size);
      break;
    case 'marble_white':
      drawMarble(ctx, size, size, 240, 238, 235, 'rgb(140,140,150)');
      break;
    case 'marble_dark':
      drawMarble(ctx, size, size, 50, 48, 52, 'rgb(180,170,160)');
      break;
    case 'marble_cream':
      drawMarble(ctx, size, size, 225, 215, 195, 'rgb(160,140,120)');
      break;
    case 'tile_square':
      drawTileSquare(ctx, size, size);
      break;
    case 'tile_hex':
      drawTileHex(ctx, size, size);
      break;
    case 'tile_subway':
      drawTileSubway(ctx, size, size);
      break;
    case 'concrete_smooth':
      drawConcrete(ctx, size, size, 'smooth');
      break;
    case 'concrete_rough':
      drawConcrete(ctx, size, size, 'rough');
      break;
    case 'stone_travertine':
      drawStone(ctx, size, size, 195, 180, 155, 'travertine');
      break;
    case 'stone_slate':
      drawStone(ctx, size, size, 80, 85, 90, 'slate');
      break;
    case 'concrete_epoxy':
      drawConcreteEpoxy(ctx, size, size);
      break;
    case 'plaster':
      drawPlaster(ctx, size, size);
      break;
    default:
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, size, size);
  }

  return canvas;
}

/**
 * Create a procedural texture with optional normal map.
 * @param {string} type - Texture type id
 * @returns {{ map: THREE.CanvasTexture, normalMap: THREE.CanvasTexture|null, roughness: number }}
 */
export function createProceduralTexture(type) {
  if (cache.has(type)) return cache.get(type);

  const canvas = generateTextureCanvas(type);
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  // Generate normal map
  const normalCanvas = generateNormalFromHeight(canvas);
  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;

  // Roughness per type
  let roughness = 0.7;
  if (type.startsWith('marble')) roughness = 0.25;
  else if (type.startsWith('wood')) roughness = 0.65;
  else if (type.startsWith('tile')) roughness = 0.4;
  else if (type === 'concrete_smooth') roughness = 0.8;
  else if (type === 'concrete_rough') roughness = 0.9;
  else if (type === 'concrete_epoxy') roughness = 0.12;
  else if (type.startsWith('stone')) roughness = 0.7;
  else if (type === 'plaster') roughness = 0.92;

  const result = { map, normalMap, roughness };
  cache.set(type, result);
  return result;
}

/** All available texture type IDs */
export const TEXTURE_TYPES = [
  'wood_oak', 'wood_walnut', 'wood_ash', 'wood_herringbone',
  'marble_white', 'marble_dark', 'marble_cream',
  'tile_square', 'tile_hex', 'tile_subway',
  'concrete_smooth', 'concrete_rough', 'concrete_epoxy',
  'stone_travertine', 'stone_slate',
  'plaster',
];

/** Human-readable names for texture types */
export const TEXTURE_NAMES = {
  wood_oak: 'Oak',
  wood_walnut: 'Walnut',
  wood_ash: 'Ash',
  wood_herringbone: 'Herringbone',
  marble_white: 'White Marble',
  marble_dark: 'Dark Marble',
  marble_cream: 'Cream Marble',
  tile_square: 'Square Tile',
  tile_hex: 'Hex Tile',
  tile_subway: 'Subway Tile',
  concrete_smooth: 'Concrete',
  concrete_rough: 'Rough Concrete',
  concrete_epoxy: 'Epoxy Concrete',
  stone_travertine: 'Travertine',
  stone_slate: 'Slate',
  plaster: 'Plaster',
};

/** Preview color for swatches (CSS color string) */
export const TEXTURE_SWATCH_COLORS = {
  wood_oak: '#A0845C',
  wood_walnut: '#5A4130',
  wood_ash: '#BEB09B',
  wood_herringbone: '#8B7355',
  marble_white: '#F0EEEB',
  marble_dark: '#323034',
  marble_cream: '#E1D9C3',
  tile_square: '#DCDAD5',
  tile_hex: '#C8C3BE',
  tile_subway: '#E6E4E1',
  concrete_smooth: '#AAA5A0',
  concrete_rough: '#8C8680',
  concrete_epoxy: '#9A9590',
  stone_travertine: '#C3B49B',
  stone_slate: '#50555A',
  plaster: '#E8DDD0',
};
