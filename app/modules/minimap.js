// ── Minimap — live floor-filtered top-down view ──

import * as THREE from 'three';
import { placed } from './furniture.js';
import { camera } from './scene.js';
import { wallRecords } from './wall-builder.js';
import { getCurrentFloor } from './floor-manager.js';
import { floorTileRecords } from './floor-builder.js';
import { stairRecords } from './stair-builder.js';

const canvas = document.getElementById('minimap');
const ctx = canvas.getContext('2d');

const MIN_X = -2;
const MIN_Z = -2;
const MAX_X = 50;
const MAX_Z = 34;

// Floor tile colors by texture type
const TEX_COLORS = {
  wood_oak:         '#5a5040',
  wood_walnut:      '#4a3830',
  wood_ash:         '#6a6050',
  wood_herringbone: '#504a38',
  marble_white:     '#8a8a88',
  marble_dark:      '#3a3a40',
  marble_cream:     '#7a7568',
  tile_square:      '#404855',
  tile_hex:         '#485048',
  tile_subway:      '#484840',
  concrete_smooth:  '#4a4a5a',
  concrete_rough:   '#3a3a3a',
  concrete_epoxy:   '#505060',
  stone_travertine: '#5a5548',
  stone_slate:      '#404545',
};

function toCanvas(x, z) {
  const px = ((x - MIN_X) / (MAX_X - MIN_X)) * canvas.width;
  const pz = ((z - MIN_Z) / (MAX_Z - MIN_Z)) * canvas.height;
  return [px, pz];
}

const _dir = new THREE.Vector3();

export function drawMinimap() {
  const currentFloor = getCurrentFloor();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(10, 10, 18, 0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ── Floor tiles on current floor ──
  for (const rec of floorTileRecords.values()) {
    if ((rec.floor || 0) !== currentFloor) continue;
    const [px, pz] = toCanvas(rec.x, rec.z);
    const [px2, pz2] = toCanvas(rec.x + rec.w, rec.z + rec.d);
    ctx.fillStyle = TEX_COLORS[rec.texType] || '#3a3a3a';
    ctx.fillRect(px, pz, px2 - px, pz2 - pz);
    ctx.strokeStyle = 'rgba(200, 169, 110, 0.3)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(px, pz, px2 - px, pz2 - pz);
  }

  // ── Courtyard L-shape (only on floor 0) ──
  if (currentFloor === 0) {
    const OX = 9.10;
    const OZ_FLIP = 11.20;
    const courtyardPts = [
      [0, 0], [0, 7.11], [0.63, 7.11], [0.63, 11.20],
      [5.18, 11.20], [5.18, 3.20], [6.91, 3.20], [6.91, 0],
    ].map(([cx, cy]) => toCanvas(OX + cx, OZ_FLIP - cy));

    ctx.fillStyle = 'rgba(100, 140, 100, 0.15)';
    ctx.beginPath();
    ctx.moveTo(courtyardPts[0][0], courtyardPts[0][1]);
    for (let i = 1; i < courtyardPts.length; i++) {
      ctx.lineTo(courtyardPts[i][0], courtyardPts[i][1]);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(200, 169, 110, 0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(200, 169, 110, 0.5)';
    ctx.font = '9px Outfit';
    ctx.textAlign = 'center';
    const [clx, clz] = toCanvas(OX + 3.0, OZ_FLIP - 5.6);
    ctx.fillText('Courtyard', clx, clz + 3);
  }

  // ── Wall lines from live wall records (filtered by floor) ──
  ctx.strokeStyle = 'rgba(200, 169, 110, 0.7)';
  ctx.lineWidth = 1;
  for (const rec of wallRecords.values()) {
    if ((rec.floor || 0) !== currentFloor) continue;
    if (rec.type === 'h') {
      const [px1, pz] = toCanvas(rec.x1, rec.z);
      const [px2] = toCanvas(rec.x2, rec.z);
      ctx.beginPath();
      ctx.moveTo(px1, pz);
      ctx.lineTo(px2, pz);
      ctx.stroke();
    } else {
      const [px, pz1] = toCanvas(rec.x, rec.z1);
      const [, pz2] = toCanvas(rec.x, rec.z2);
      ctx.beginPath();
      ctx.moveTo(px, pz1);
      ctx.lineTo(px, pz2);
      ctx.stroke();
    }
  }

  // ── Stairs (arrow icons) ──
  ctx.fillStyle = 'rgba(200, 169, 110, 0.6)';
  ctx.font = '10px Outfit';
  ctx.textAlign = 'center';
  for (const rec of stairRecords.values()) {
    if (rec.fromFloor !== currentFloor && rec.toFloor !== currentFloor) continue;
    const [sx, sz] = toCanvas(rec.x, rec.z);
    const arrows = { north: '\u2191', south: '\u2193', east: '\u2192', west: '\u2190' };
    ctx.fillText(arrows[rec.direction] || '\u2191', sx, sz + 4);
  }

  // ── Furniture dots (filtered by floor) ──
  for (const item of placed) {
    if ((item.userData.floor || 0) !== currentFloor) continue;
    const [fx, fz] = toCanvas(item.position.x, item.position.z);
    ctx.fillStyle = '#c8a96e';
    ctx.beginPath();
    ctx.arc(fx, fz, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Camera ──
  const [camX, camZ] = toCanvas(camera.position.x, camera.position.z);
  ctx.fillStyle = '#ff4444';
  ctx.beginPath();
  ctx.arc(camX, camZ, 3.5, 0, Math.PI * 2);
  ctx.fill();

  camera.getWorldDirection(_dir);
  const angle = Math.atan2(_dir.x, _dir.z);
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(camX, camZ);
  ctx.lineTo(camX + Math.sin(angle) * 10, camZ + Math.cos(angle) * 10);
  ctx.stroke();

  // ── Floor level label ──
  ctx.fillStyle = 'rgba(200, 169, 110, 0.8)';
  ctx.font = 'bold 12px Outfit';
  ctx.textAlign = 'left';
  const floorLabel = currentFloor === 0 ? 'G' : `${currentFloor}F`;
  ctx.fillText(floorLabel, 6, 14);
}
