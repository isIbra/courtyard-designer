// ── Floor Manager — multi-floor state + visibility ──

import { scene } from './scene.js';

export const FLOOR_HEIGHT = 3.0;

let currentFloor = 0;
const floors = [{ level: 0, name: 'Ground' }];

// Callbacks for UI updates
let onFloorChange = null;

export function setOnFloorChange(cb) { onFloorChange = cb; }

export function getCurrentFloor() { return currentFloor; }

export function getYBase(level) { return level * FLOOR_HEIGHT; }

export function getFloorCount() { return floors.length; }

export function getFloors() { return floors; }

export function addFloor() {
  const level = floors.length;
  const name = level === 0 ? 'Ground' : `Floor ${level}`;
  floors.push({ level, name });
  switchFloor(level);
  return level;
}

/** Auto-create all floor levels up to (and including) the given level */
export function ensureFloor(level) {
  while (floors.length <= level) {
    const l = floors.length;
    floors.push({ level: l, name: l === 0 ? 'Ground' : `Floor ${l}` });
  }
  if (onFloorChange) onFloorChange(currentFloor);
}

export function switchFloor(level) {
  if (level < 0) return;
  // Auto-create floor levels as needed (Satisfactory-style)
  ensureFloor(level);
  currentFloor = level;
  updateVisibility();
  if (onFloorChange) onFloorChange(level);
}

/** Show all floors — Satisfactory-style seamless building (everything visible) */
export function updateVisibility() {
  scene.traverse((obj) => {
    if (obj.userData.floor === undefined) return;
    obj.visible = true;
    setOpacity(obj, 1.0);
  });
}

function setOpacity(obj, opacity) {
  obj.traverse((child) => {
    if (!child.isMesh) return;
    const mat = child.material;
    if (!mat) return;

    if (opacity < 1) {
      // Store original state if not already
      if (mat._origTransparent === undefined) {
        mat._origTransparent = mat.transparent;
        mat._origOpacity = mat.opacity;
      }
      mat.transparent = true;
      mat.opacity = opacity;
      mat.needsUpdate = true;
    } else if (mat._origTransparent !== undefined) {
      // Restore
      mat.transparent = mat._origTransparent;
      mat.opacity = mat._origOpacity;
      delete mat._origTransparent;
      delete mat._origOpacity;
      mat.needsUpdate = true;
    }
  });
}
