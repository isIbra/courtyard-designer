import { openDB, getAllWalls, putAllWalls, clearWalls, getAllFurniture, putAllFurniture, clearFurniture } from './db.js';
import { SEED_WALLS } from './wall-data.js';
import { loadWallRecords, clearAllWalls, wallRecords } from './wall-builder.js';
import { placed, placeItem, removeItem } from './furniture.js';

const LS_KEY = 'courtyard-designer-v1';

export async function initPersistence() {
  await openDB();

  // Load walls (or seed on first run)
  let walls = await getAllWalls();
  if (walls.length === 0) {
    await putAllWalls(SEED_WALLS);
    walls = [...SEED_WALLS];
  }
  loadWallRecords(walls);

  // Load furniture from IndexedDB
  let furniture = await getAllFurniture();

  // One-time migration from localStorage
  if (furniture.length === 0) {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const state = JSON.parse(raw);
        if (state.furniture && state.furniture.length > 0) {
          furniture = state.furniture.map((f, i) => ({
            id: `furn_migrated_${i}`,
            type: f.id,
            x: f.x,
            z: f.z,
            rotY: f.rotY,
          }));
          await putAllFurniture(furniture);
          localStorage.removeItem(LS_KEY);
        }
      }
    } catch { /* ignore migration errors */ }
  }

  for (const f of furniture) {
    placeItem(f.type, f.x, f.z, f.rotY);
  }

  return { wallCount: walls.length, furnitureCount: furniture.length };
}

export function saveState() {
  const items = placed.map((m, i) => ({
    id: `furn_${i}_${Date.now()}`,
    type: m.userData.furnitureId,
    x: m.position.x,
    z: m.position.z,
    rotY: m.rotation.y,
  }));
  clearFurniture().then(() => putAllFurniture(items));
  return true;
}

// No-op — initPersistence handles loading now
export function loadState() {
  return false;
}

export function resetState() {
  // Sync: clear scene immediately
  clearAllWalls();
  while (placed.length > 0) removeItem(placed[0]);

  // Sync: reload seed walls into scene
  loadWallRecords([...SEED_WALLS]);

  // Async: persist to DB (fire-and-forget)
  clearWalls().then(() => putAllWalls(SEED_WALLS));
  clearFurniture();
}

let saveTimer = null;
export function autoSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveState(), 1500);
}
