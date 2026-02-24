import * as THREE from 'three';
import { scene } from './scene.js';

// ── Constants ──
export const T = 0.35;    // wall thickness (matches schematic line width)
export const H = 3.0;     // wall height
export const DOOR_H = 2.1;

// Keep exports for module compatibility
export const ROOMS = [];
export const floorMeshes = [];
export const wallMeshes = [];
export const ceilingMeshes = [];

export function setCeilingsVisible(_visible) {}

// ── Wall material ──
const wallMat = new THREE.MeshStandardMaterial({
  color: 0xEBE0D0,
  roughness: 0.95,
  metalness: 0.0,
});

// ── Wall helpers ──
function hw(z, x1, x2) {
  const w = x2 - x1;
  if (w < 0.05) return;
  const geo = new THREE.BoxGeometry(w, H, T);
  const mesh = new THREE.Mesh(geo, wallMat);
  mesh.position.set(x1 + w / 2, H / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  wallMeshes.push(mesh);
}

function vw(x, z1, z2) {
  const d = z2 - z1;
  if (d < 0.05) return;
  const geo = new THREE.BoxGeometry(T, H, d);
  const mesh = new THREE.Mesh(geo, wallMat);
  mesh.position.set(x, H / 2, z1 + d / 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  wallMeshes.push(mesh);
}

// ═══════════════════════════════════════════════════════════
// Wall positions from schematic.png pixel scan
// Pixel → World mapping (overlay plane 54×37.5 at pos 24,0.03,17.25):
//   World X = -3 + 54 * (px / 1155)
//   World Z = -1.5 + 37.5 * (py / 855)
// ═══════════════════════════════════════════════════════════

export function buildApartment() {

  // ── EXTERIOR PERIMETER ──

  // North wall — closet/staircase section (protrudes north)
  hw(1.41, 0.83, 12.29);
  // North step — jog south from closet/staircase to bedroom level
  vw(12.29, 1.41, 2.49);
  // North wall — bedroom through courtyard east
  hw(2.49, 12.29, 44.13);

  // West wall — full height
  vw(0.83, 1.41, 31.13);

  // South wall — full width
  hw(31.13, 0.83, 47.12);

  // ── APARTMENT EAST WALL (apartment ↔ courtyard boundary) ──

  // Upper section (top row extends further east)
  vw(31.83, 2.49, 13.28);
  // Horizontal step connecting upper to lower at top-row base
  hw(13.28, 30.15, 31.83);
  // Lower section — above courtyard door
  vw(30.15, 13.28, 19.60);
  // (courtyard door gap: Z = 19.60 → 22.49)
  // Lower section — below courtyard door
  vw(30.15, 22.49, 31.13);

  // ── COURTYARD EAST WALL (L-shaped) ──

  // Upper section (narrower courtyard top)
  vw(44.13, 2.49, 23.17);
  // Horizontal step — courtyard widens toward south
  hw(23.17, 44.13, 47.12);
  // Lower section (wider courtyard bottom)
  vw(47.12, 23.17, 31.13);

  // ── TOP ROW INTERIOR WALLS ──

  // Staircase shaft walls (closet|staircase boundary)
  // No wall at X≈3.36 — pixel scan showed text label only, not a wall
  // Closet extends from west wall (X=0.83) to staircase left wall (X=5.51)
  vw(5.51, 1.41, 13.24);
  // Staircase right shaft wall — stops at Z=12.97 (dark→light at py 331)
  vw(5.93, 1.41, 12.97);
  // Staircase | Bedroom
  vw(11.89, 1.41, 13.24);
  // Bedroom | Bathroom (partial — only bathroom depth)
  vw(25.59, 2.49, 8.67);
  // Bathroom south wall
  hw(8.67, 25.59, 31.83);

  // ── TOP ROW → LIVING ROOM WALL (Z = 13.24, with openings) ──

  // Closet entrance partition (traces schematic lines at py 330/334, X=2.94→3.59)
  hw(13.06, 2.94, 3.59);
  // (staircase opening: X = 5.93 → 12.38)
  // Short segment between staircase opening and bedroom door
  hw(13.24, 12.38, 14.02);
  // (bedroom door: X = 14.02 → 15.94)
  // Main wall — bedroom door to apartment east wall
  hw(13.24, 15.94, 30.15);

  // ── LEFT COLUMN ──

  // Column north wall (separates living room from storage area)
  hw(20.30, 0.83, 11.89);
  // Column east wall — upper segment
  vw(11.89, 20.30, 21.53);
  // (door opening: Z = 21.53 → 23.28 — storage/living room access)
  // Column east wall — lower segment (only to storage|kitchen divider)
  vw(11.89, 23.28, 25.25);

  // ── COLUMN ROOM DIVIDERS ──

  // Interior vertical wall (storage east boundary / rooms partition)
  vw(3.03, 20.30, 25.04);

  // ── BOTTOM ROOMS WALL (Z ≈ 25.04, full-width with door gaps) ──
  // This wall divides living room (above) from bottom rooms (below)

  // Left segment (door gap at far left: X=0.83→2.94)
  hw(25.04, 2.94, 15.10);
  // (door gap: X = 15.10 → 17.00)
  // Middle segment
  hw(25.04, 17.00, 19.50);
  // (door gap: X = 19.50 → 22.20)
  // Right segment (to apartment east wall)
  hw(25.04, 22.20, 30.15);

  // ── BOTTOM ROOMS VERTICAL DIVIDERS ──

  // Guest room | kitchen divider
  vw(9.0, 25.04, 31.13);
  // Room divider 2
  vw(18.50, 25.04, 31.13);
  // Room divider 3
  vw(22.80, 25.04, 31.13);
}
