import { placed, placeItem, removeItem } from './furniture.js';

const STORAGE_KEY = 'courtyard-designer-v1';

export function saveState() {
  const state = {
    version: 1,
    furniture: placed.map((m) => ({
      id: m.userData.furnitureId,
      x: m.position.x,
      z: m.position.z,
      rotY: m.rotation.y,
    })),
    roomMaterials: {},  // TODO: per-room material overrides
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    const state = JSON.parse(raw);
    if (!state.furniture) return false;

    // Clear existing
    while (placed.length > 0) {
      removeItem(placed[0]);
    }

    // Restore furniture
    for (const f of state.furniture) {
      placeItem(f.id, f.x, f.z, f.rotY);
    }

    return true;
  } catch {
    return false;
  }
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  while (placed.length > 0) {
    removeItem(placed[0]);
  }
}

// Auto-save debounced
let saveTimer = null;
export function autoSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveState(), 1500);
}
