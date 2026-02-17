import * as THREE from 'three';
import { ROOMS } from './apartment.js';
import { placed } from './furniture.js';
import { camera } from './scene.js';

const canvas = document.getElementById('minimap');
const ctx = canvas.getContext('2d');

const MIN_X = -0.5;
const MIN_Z = -0.5;
const MAX_X = 17;
const MAX_Z = 12;

const ROOM_COLORS = {
  staircase: '#4a4a5a',
  bedroom:   '#5a5040',
  wc:        '#404855',
  foyer:     '#4a4540',
  corridor:  '#3a3a40',
  living:    '#504a38',
  kitchen:   '#484840',
  bathroom:  '#404855',
  utility:   '#3a3a3a',
};

function toCanvas(x, z) {
  const px = ((x - MIN_X) / (MAX_X - MIN_X)) * canvas.width;
  const pz = ((z - MIN_Z) / (MAX_Z - MIN_Z)) * canvas.height;
  return [px, pz];
}

const _dir = new THREE.Vector3();

export function drawMinimap() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(10, 10, 18, 0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Rooms
  for (const room of ROOMS) {
    const [px, pz] = toCanvas(room.x, room.z);
    const [px2, pz2] = toCanvas(room.x + room.w, room.z + room.d);
    ctx.fillStyle = ROOM_COLORS[room.id] || '#3a3a3a';
    ctx.fillRect(px, pz, px2 - px, pz2 - pz);
    ctx.strokeStyle = 'rgba(200, 169, 110, 0.3)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(px, pz, px2 - px, pz2 - pz);

    ctx.fillStyle = 'rgba(200, 169, 110, 0.6)';
    ctx.font = '8px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(room.name, (px + px2) / 2, (pz + pz2) / 2 + 3);
  }

  // Courtyard
  const [cx1, cz1] = toCanvas(9.35, 0);
  const [cx2, cz2] = toCanvas(16.26, 11.20);
  ctx.fillStyle = 'rgba(100, 140, 100, 0.15)';
  ctx.fillRect(cx1, cz1, cx2 - cx1, cz2 - cz1);
  ctx.strokeStyle = 'rgba(200, 169, 110, 0.3)';
  ctx.strokeRect(cx1, cz1, cx2 - cx1, cz2 - cz1);
  ctx.fillStyle = 'rgba(200, 169, 110, 0.5)';
  ctx.font = '9px Outfit';
  ctx.textAlign = 'center';
  ctx.fillText('Courtyard', (cx1 + cx2) / 2, (cz1 + cz2) / 2 + 3);

  // Furniture dots
  for (const item of placed) {
    const [fx, fz] = toCanvas(item.position.x, item.position.z);
    ctx.fillStyle = '#c8a96e';
    ctx.beginPath();
    ctx.arc(fx, fz, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Camera
  const [camX, camZ] = toCanvas(camera.position.x, camera.position.z);
  ctx.fillStyle = '#ff4444';
  ctx.beginPath();
  ctx.arc(camX, camZ, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Camera direction line
  camera.getWorldDirection(_dir);
  const angle = Math.atan2(_dir.x, _dir.z);
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(camX, camZ);
  ctx.lineTo(camX + Math.sin(angle) * 10, camZ + Math.cos(angle) * 10);
  ctx.stroke();
}
