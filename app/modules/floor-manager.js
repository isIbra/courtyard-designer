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

export function switchFloor(level) {
  if (level < 0 || level >= floors.length) return;
  currentFloor = level;
  updateVisibility();
  if (onFloorChange) onFloorChange(level);
}

/** Show/hide scene objects by userData.floor */
export function updateVisibility() {
  scene.traverse((obj) => {
    if (obj.userData.floor === undefined) return;
    const f = obj.userData.floor;

    if (f === currentFloor) {
      obj.visible = true;
      setOpacity(obj, 1.0);
    } else if (f === currentFloor - 1) {
      // Ghost floor below
      obj.visible = true;
      setOpacity(obj, 0.3);
    } else {
      obj.visible = false;
    }
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
