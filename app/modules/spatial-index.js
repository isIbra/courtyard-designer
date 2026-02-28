/**
 * Spatial Index — grid-based spatial hash for the 3D scene.
 * Cell size = 1.0 scene unit. Key format: "cx,floor,cz".
 * Kept pure — all data passed via rebuild() params, no direct imports.
 */

const CELL = 1.0;

/** @type {Map<string, Array<{type: string, id: string, data: object}>>} */
const grid = new Map();

function cellKey(cx, floor, cz) {
  return `${cx},${floor},${cz}`;
}

function cellsForBounds(x1, z1, x2, z2) {
  const cxMin = Math.floor(Math.min(x1, x2) / CELL);
  const cxMax = Math.floor(Math.max(x1, x2) / CELL);
  const czMin = Math.floor(Math.min(z1, z2) / CELL);
  const czMax = Math.floor(Math.max(z1, z2) / CELL);
  const cells = [];
  for (let cx = cxMin; cx <= cxMax; cx++) {
    for (let cz = czMin; cz <= czMax; cz++) {
      cells.push([cx, cz]);
    }
  }
  return cells;
}

export function insert(type, id, bounds, data, floor = 0) {
  const { x1, z1, x2, z2 } = bounds;
  const cells = cellsForBounds(x1, z1, x2, z2);
  const descriptor = { type, id, data };
  for (const [cx, cz] of cells) {
    const key = cellKey(cx, floor, cz);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(descriptor);
  }
}

export function remove(type, id, bounds, floor = 0) {
  const { x1, z1, x2, z2 } = bounds;
  const cells = cellsForBounds(x1, z1, x2, z2);
  for (const [cx, cz] of cells) {
    const key = cellKey(cx, floor, cz);
    const arr = grid.get(key);
    if (!arr) continue;
    const filtered = arr.filter(d => !(d.type === type && d.id === id));
    if (filtered.length === 0) grid.delete(key);
    else grid.set(key, filtered);
  }
}

export function queryPoint(x, floor, z) {
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  const key = cellKey(cx, floor, cz);
  return grid.get(key) || [];
}

export function queryBox(x1, floor, z1, x2, z2) {
  const cells = cellsForBounds(x1, z1, x2, z2);
  const seen = new Set();
  const results = [];
  for (const [cx, cz] of cells) {
    const key = cellKey(cx, floor, cz);
    const arr = grid.get(key);
    if (!arr) continue;
    for (const desc of arr) {
      const uid = `${desc.type}:${desc.id}`;
      if (seen.has(uid)) continue;
      seen.add(uid);
      results.push(desc);
    }
  }
  return results;
}

/**
 * Full re-index from all data sources.
 * @param {object} sources
 * @param {Map|object} sources.wallRecords - id -> wallRecord
 * @param {Array} sources.placed - placed furniture meshes
 * @param {Map|object} sources.floorTileRecords - id -> tileRecord
 * @param {Map|object} sources.stairRecords - id -> stairRecord
 * @param {Array} sources.rooms - ROOMS array
 */
export function rebuild(sources) {
  grid.clear();

  const { wallRecords, placed, floorTileRecords, stairRecords, rooms } = sources;

  // Index walls
  if (wallRecords) {
    const entries = wallRecords instanceof Map ? wallRecords.values() : Object.values(wallRecords);
    for (const rec of entries) {
      const floor = rec.floor || 0;
      const halfT = (rec.T || 0.35) / 2;
      let bounds;
      if (rec.type === 'h') {
        bounds = { x1: rec.x1, z1: rec.z - halfT, x2: rec.x2, z2: rec.z + halfT };
      } else {
        bounds = { x1: rec.x - halfT, z1: rec.z1, x2: rec.x + halfT, z2: rec.z2 };
      }
      insert('wall', rec.id, bounds, {
        type: rec.type, id: rec.id,
        ...(rec.type === 'h' ? { z: rec.z, x1: rec.x1, x2: rec.x2 } : { x: rec.x, z1: rec.z1, z2: rec.z2 }),
        H: rec.H, T: rec.T,
      }, floor);
    }
  }

  // Index placed furniture
  if (placed) {
    for (const mesh of placed) {
      const ud = mesh.userData;
      const item = ud.item;
      if (!item) continue;
      const id = ud.meshId || ud.furnitureId || 'unknown';
      const px = mesh.position.x;
      const pz = mesh.position.z;
      const halfW = item.w / 2;
      const halfD = item.d / 2;
      const bounds = { x1: px - halfW, z1: pz - halfD, x2: px + halfW, z2: pz + halfD };
      const floor = ud.floor || 0;
      insert('furniture', id, bounds, {
        meshId: ud.meshId, catalogId: ud.furnitureId,
        x: px, z: pz, rotY: mesh.rotation.y,
        w: item.w, h: item.h, d: item.d, name: item.name,
      }, floor);
    }
  }

  // Index floor tiles
  if (floorTileRecords) {
    const entries = floorTileRecords instanceof Map ? floorTileRecords.values() : Object.values(floorTileRecords);
    for (const rec of entries) {
      const floor = rec.floor || 0;
      const bounds = { x1: rec.x, z1: rec.z, x2: rec.x + rec.w, z2: rec.z + rec.d };
      insert('floor', rec.id, bounds, {
        id: rec.id, x: rec.x, z: rec.z, w: rec.w, d: rec.d, texType: rec.texType,
      }, floor);
    }
  }

  // Index stairs
  if (stairRecords) {
    const entries = stairRecords instanceof Map ? stairRecords.values() : Object.values(stairRecords);
    for (const rec of entries) {
      const w = rec.width || 1.0;
      const l = rec.length || 3.0;
      let bounds;
      if (rec.direction === 'north' || rec.direction === 'south') {
        bounds = { x1: rec.x, z1: rec.z, x2: rec.x + w, z2: rec.z + l };
      } else {
        bounds = { x1: rec.x, z1: rec.z, x2: rec.x + l, z2: rec.z + w };
      }
      const floor = rec.fromFloor || 0;
      insert('stair', rec.id, bounds, {
        id: rec.id, x: rec.x, z: rec.z, direction: rec.direction,
        fromFloor: rec.fromFloor, toFloor: rec.toFloor,
      }, floor);
    }
  }

  // Index rooms (as metadata — useful for get_room_at)
  if (rooms) {
    for (const room of rooms) {
      const bounds = { x1: room.x, z1: room.z, x2: room.x + room.w, z2: room.z + room.d };
      insert('room', room.id, bounds, {
        id: room.id, name: room.name, x: room.x, z: room.z, w: room.w, d: room.d,
      }, 0);
    }
  }
}

export function clear() {
  grid.clear();
}

export function stats() {
  let totalItems = 0;
  for (const arr of grid.values()) totalItems += arr.length;
  return { cells: grid.size, totalItems };
}
