import {
  openDB, getAllWalls, putAllWalls, clearWalls,
  getAllFurniture, putAllFurniture, clearFurniture,
  getAllFloorTiles, putAllFloorTiles, clearFloorTiles,
  getAllStairs, putAllStairs, clearStairs,
  getMeta, putMeta,
} from './db.js';
import { SEED_WALLS } from './wall-data.js';
import { loadWallRecords, clearAllWalls, wallRecords } from './wall-builder.js';
import { placed, placeItem, removeItem } from './furniture.js';
import { loadFloorTiles, clearAllFloorTiles, floorTileRecords } from './floor-builder.js';
import { loadStairs, clearAllStairs, stairRecords } from './stair-builder.js';
import { generateSeedFloorTiles, buildCeilings } from './apartment.js';

const LS_KEY = 'courtyard-designer-v1';

// ── Current logged-in username ──
let currentUsername = null;

export function setUsername(name) {
  currentUsername = name;
}

export function getUsername() {
  return currentUsername;
}

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
            floor: 0,
          }));
          await putAllFurniture(furniture);
          localStorage.removeItem(LS_KEY);
        }
      }
    } catch { /* ignore migration errors */ }
  }

  for (const f of furniture) {
    placeItem(f.type, f.x, f.z, f.rotY, f.floor || 0);
  }

  // Load floor tiles (or seed from ROOMS on first run)
  let floorTiles = await getAllFloorTiles();
  if (floorTiles.length === 0) {
    // Auto-generate from ROOMS array
    floorTiles = generateSeedFloorTiles();
    await putAllFloorTiles(floorTiles);
  }
  loadFloorTiles(floorTiles);

  // Build ceilings from floor tiles
  buildCeilings(floorTiles);

  // Load stairs
  const stairs = await getAllStairs();
  if (stairs.length > 0) {
    loadStairs(stairs);
  }

  return {
    wallCount: walls.length,
    furnitureCount: furniture.length,
    floorTileCount: floorTiles.length,
    stairCount: stairs.length,
  };
}

export function saveState() {
  const items = placed.map((m, i) => ({
    id: `furn_${i}_${Date.now()}`,
    type: m.userData.furnitureId,
    x: m.position.x,
    z: m.position.z,
    rotY: m.rotation.y,
    floor: m.userData.floor || 0,
  }));
  clearFurniture().then(() => putAllFurniture(items));

  // Save floor tiles
  const tiles = [...floorTileRecords.values()];
  clearFloorTiles().then(() => putAllFloorTiles(tiles));

  // Save stairs
  const stairs = [...stairRecords.values()];
  clearStairs().then(() => putAllStairs(stairs));

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
  clearAllFloorTiles();
  clearAllStairs();

  // Sync: reload seed walls + floor tiles into scene
  loadWallRecords([...SEED_WALLS]);
  const seedTiles = generateSeedFloorTiles();
  loadFloorTiles(seedTiles);
  buildCeilings(seedTiles);

  // Async: persist to DB (fire-and-forget)
  clearWalls().then(() => putAllWalls(SEED_WALLS));
  clearFurniture();
  clearFloorTiles().then(() => putAllFloorTiles(seedTiles));
  clearStairs();

  // Sync reset to server too
  if (currentUsername) syncToServer(currentUsername);
}

let saveTimer = null;
let syncTimer = null;

export function autoSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveState();
    // Debounced server sync
    if (currentUsername) {
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => syncToServer(currentUsername), 2000);
    }
  }, 1500);
}

// ── Floor material persistence ──

export async function saveFloorMaterial(roomId, texType) {
  const rec = await getMeta('floorMaterials');
  const map = rec ? rec.value : {};
  map[roomId] = texType;
  await putMeta('floorMaterials', map);
}

export async function loadFloorMaterials() {
  const rec = await getMeta('floorMaterials');
  return rec ? rec.value : {};
}

// ── Server sync ──

export async function syncToServer(username) {
  if (!username) return;
  try {
    const walls = await getAllWalls();
    const furniture = await getAllFurniture();
    const floorTiles = await getAllFloorTiles();
    const stairs = await getAllStairs();
    const floorRec = await getMeta('floorMaterials');
    const floorMaterials = floorRec ? floorRec.value : {};

    await fetch(`/api/state/${encodeURIComponent(username)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walls, furniture, floorMaterials, floorTiles, stairs }),
    });
  } catch (err) {
    console.warn('Server sync failed:', err);
  }
}

export async function loadFromServer(username) {
  if (!username) return false;
  try {
    const res = await fetch(`/api/state/${encodeURIComponent(username)}`);
    const { state } = await res.json();
    if (!state) return false; // new user, no saved data

    // Clear IndexedDB and write server data
    await clearWalls();
    await clearFurniture();
    await clearFloorTiles();
    await clearStairs();

    if (state.walls && state.walls.length > 0) {
      await putAllWalls(state.walls);
    }
    if (state.furniture && state.furniture.length > 0) {
      await putAllFurniture(state.furniture);
    }
    if (state.floorTiles && state.floorTiles.length > 0) {
      await putAllFloorTiles(state.floorTiles);
    }
    if (state.stairs && state.stairs.length > 0) {
      await putAllStairs(state.stairs);
    }
    if (state.floorMaterials) {
      await putMeta('floorMaterials', state.floorMaterials);
    }

    return true; // data was loaded
  } catch (err) {
    console.warn('Failed to load from server:', err);
    return false;
  }
}
