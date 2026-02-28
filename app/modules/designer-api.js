/**
 * Designer API — exposes window.designerAPI with a unified exec(method, params)
 * interface for querying and mutating the 3D scene.
 *
 * Also opens a WebSocket to the relay server so external tools (MCP) can call
 * these same methods remotely.
 */

import { scene, camera, updateSun } from './scene.js';
import { ROOMS, addWallFromRecord, removeWallById, setWallColor, getWallColor } from './apartment.js';
import { CATALOG, placed, placeItem, removeItem } from './furniture.js';
import { pushAction } from './history.js';
import { wallRecords } from './wall-builder.js';
import { floorTileRecords, applyTileTexture } from './floor-builder.js';
import { stairRecords } from './stair-builder.js';
import { createWallRecord } from './wall-data.js';
import { autoSave } from './persistence.js';
import * as spatialIndex from './spatial-index.js';

// ── Spatial index rebuild helper ──

function rebuildIndex() {
  spatialIndex.rebuild({
    wallRecords,
    placed,
    floorTileRecords,
    stairRecords,
    rooms: ROOMS,
  });
}

// ── Method dispatch table ──

const methods = {};

// ── Query Methods ──

methods['scene.info'] = () => {
  return {
    roomCount: ROOMS.length,
    wallCount: wallRecords.size,
    furnitureCount: placed.length,
    bounds: { xMin: 0, zMin: 0, xMax: 32, zMax: 32 },
  };
};

methods['scene.query_point'] = ({ x, floor = 0, z }) => {
  rebuildIndex();
  return spatialIndex.queryPoint(x, floor, z);
};

methods['scene.query_box'] = ({ x1, floor = 0, z1, x2, z2 }) => {
  rebuildIndex();
  return spatialIndex.queryBox(x1, floor, z1, x2, z2);
};

methods['scene.get_room_at'] = ({ x, z }) => {
  for (const room of ROOMS) {
    if (x >= room.x && x <= room.x + room.w && z >= room.z && z <= room.z + room.d) {
      return { id: room.id, name: room.name, x: room.x, z: room.z, w: room.w, d: room.d };
    }
  }
  return null;
};

methods['scene.list_rooms'] = () => {
  return ROOMS.map(r => ({ id: r.id, name: r.name, x: r.x, z: r.z, w: r.w, d: r.d }));
};

methods['scene.list_furniture'] = ({ floor, category } = {}) => {
  let list = placed;
  if (floor !== undefined) list = list.filter(m => (m.userData.floor || 0) === floor);
  if (category) list = list.filter(m => m.userData.item && m.userData.item.cat === category);
  return list.map(m => ({
    meshId: m.userData.meshId,
    catalogId: m.userData.furnitureId,
    name: m.userData.item?.name,
    category: m.userData.item?.cat,
    x: m.position.x,
    y: m.position.y,
    z: m.position.z,
    rotY: m.rotation.y,
    floor: m.userData.floor || 0,
    w: m.userData.item?.w,
    h: m.userData.item?.h,
    d: m.userData.item?.d,
  }));
};

methods['scene.list_walls'] = ({ floor } = {}) => {
  const result = [];
  for (const [id, rec] of wallRecords) {
    if (floor !== undefined && (rec.floor || 0) !== floor) continue;
    result.push({
      id: rec.id,
      type: rec.type,
      ...(rec.type === 'h'
        ? { z: rec.z, x1: rec.x1, x2: rec.x2 }
        : { x: rec.x, z1: rec.z1, z2: rec.z2 }),
      H: rec.H,
      T: rec.T,
      floor: rec.floor || 0,
      isOriginal: rec.isOriginal || false,
    });
  }
  return result;
};

methods['scene.get_catalog'] = ({ category } = {}) => {
  let list = CATALOG;
  if (category) list = list.filter(c => c.cat === category);
  return list.map(c => ({ id: c.id, name: c.name, cat: c.cat, w: c.w, h: c.h, d: c.d }));
};

// ── Mutation Methods ──

methods['furniture.place'] = ({ catalogId, x, z, rotY = 0, floor = 0 }) => {
  const item = CATALOG.find(c => c.id === catalogId);
  if (!item) return { error: `Unknown catalog item: ${catalogId}` };

  const mesh = placeItem(catalogId, x, z, rotY, floor);
  if (!mesh) return { error: 'Failed to place item' };

  const meshId = mesh.userData.meshId;
  pushAction({
    undo: () => { removeItem(mesh); autoSave(); },
    redo: () => { scene.add(mesh); placed.push(mesh); autoSave(); },
    label: `Place ${item.name}`,
  });
  autoSave();
  return { ok: true, meshId, catalogId, x, z, rotY, floor };
};

methods['furniture.move'] = ({ meshId, x, z }) => {
  const mesh = placed.find(m => m.userData.meshId === meshId);
  if (!mesh) return { error: `Furniture not found: ${meshId}` };

  const oldX = mesh.position.x;
  const oldZ = mesh.position.z;
  mesh.position.x = x;
  mesh.position.z = z;

  pushAction({
    undo: () => { mesh.position.x = oldX; mesh.position.z = oldZ; autoSave(); },
    redo: () => { mesh.position.x = x; mesh.position.z = z; autoSave(); },
    label: `Move ${mesh.userData.item?.name || 'furniture'}`,
  });
  autoSave();
  return { ok: true, meshId, x, z };
};

methods['furniture.rotate'] = ({ meshId, rotY }) => {
  const mesh = placed.find(m => m.userData.meshId === meshId);
  if (!mesh) return { error: `Furniture not found: ${meshId}` };

  const oldRotY = mesh.rotation.y;
  mesh.rotation.y = rotY;

  pushAction({
    undo: () => { mesh.rotation.y = oldRotY; autoSave(); },
    redo: () => { mesh.rotation.y = rotY; autoSave(); },
    label: `Rotate ${mesh.userData.item?.name || 'furniture'}`,
  });
  autoSave();
  return { ok: true, meshId, rotY };
};

methods['furniture.remove'] = ({ meshId }) => {
  const mesh = placed.find(m => m.userData.meshId === meshId);
  if (!mesh) return { error: `Furniture not found: ${meshId}` };

  const catalogId = mesh.userData.furnitureId;
  const x = mesh.position.x;
  const z = mesh.position.z;
  const rotY = mesh.rotation.y;
  const floor = mesh.userData.floor || 0;

  removeItem(mesh);
  pushAction({
    undo: () => { scene.add(mesh); placed.push(mesh); autoSave(); },
    redo: () => { removeItem(mesh); autoSave(); },
    label: `Remove ${mesh.userData.item?.name || 'furniture'}`,
  });
  autoSave();
  return { ok: true, meshId, catalogId, x, z };
};

methods['wall.add'] = ({ type, x, z, x1, x2, z1, z2, floor = 0 }) => {
  const params = type === 'h'
    ? { z, x1, x2 }
    : { x, z1, z2 };
  const rec = createWallRecord(type, params, floor);
  wallRecords.set(rec.id, rec);
  const mesh = addWallFromRecord(rec);

  pushAction({
    undo: () => { removeWallById(rec.id); wallRecords.delete(rec.id); autoSave(); },
    redo: () => { wallRecords.set(rec.id, rec); addWallFromRecord(rec); autoSave(); },
    label: `Add wall`,
  });
  autoSave();
  return { ok: true, wallId: rec.id };
};

methods['wall.remove'] = ({ wallId }) => {
  const rec = wallRecords.get(wallId);
  if (!rec) return { error: `Wall not found: ${wallId}` };

  removeWallById(wallId);
  wallRecords.delete(wallId);

  pushAction({
    undo: () => { wallRecords.set(wallId, rec); addWallFromRecord(rec); autoSave(); },
    redo: () => { removeWallById(wallId); wallRecords.delete(wallId); autoSave(); },
    label: `Remove wall`,
  });
  autoSave();
  return { ok: true, wallId };
};

methods['wall.set_color'] = ({ roomId, hex }) => {
  const oldHex = getWallColor(roomId);
  setWallColor(roomId, hex);

  pushAction({
    undo: () => { setWallColor(roomId, oldHex); autoSave(); },
    redo: () => { setWallColor(roomId, hex); autoSave(); },
    label: `Wall color ${roomId}`,
  });
  autoSave();
  return { ok: true, roomId, hex };
};

methods['floor.set_texture'] = ({ tileId, texType }) => {
  applyTileTexture(tileId, texType);
  autoSave();
  return { ok: true, tileId, texType };
};

methods['scene.set_sun'] = ({ t }) => {
  updateSun(t);
  return { ok: true, t };
};

methods['camera.look_at'] = ({ x, y, z, tx, ty, tz }) => {
  if (x !== undefined) camera.position.set(x, y, z);
  if (tx !== undefined) camera.lookAt(tx, ty, tz);
  return { ok: true };
};

// ── Unified exec ──

async function exec(method, params = {}) {
  const fn = methods[method];
  if (!fn) return { error: `Unknown method: ${method}` };
  try {
    const result = fn(params);
    return result;
  } catch (err) {
    return { error: err.message };
  }
}

// ── WebSocket client (connects to relay for external MCP calls) ──

let ws = null;
let wsReconnectTimer = null;

function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${proto}//${location.host}/ws`;

  try {
    ws = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log('[DesignerAPI] WebSocket connected');
    if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
  };

  ws.onmessage = async (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    const { reqId, method, params } = msg;
    if (!reqId || !method) return;

    const result = await exec(method, params || {});
    const ok = !result.error;
    ws.send(JSON.stringify({ reqId, ok, ...(ok ? { result } : { error: result.error }) }));
  };

  ws.onclose = () => {
    console.log('[DesignerAPI] WebSocket disconnected');
    ws = null;
    scheduleReconnect();
  };

  ws.onerror = () => {
    // onclose will fire after this
  };
}

function scheduleReconnect() {
  if (wsReconnectTimer) return;
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null;
    connectWS();
  }, 3000);
}

// ── Init ──

export function initDesignerAPI() {
  window.designerAPI = { exec };
  window.spatialIndex = spatialIndex;

  // Initial index build
  rebuildIndex();

  // Connect to WS relay (non-blocking, will retry)
  connectWS();

  console.log('[DesignerAPI] Initialized. Use window.designerAPI.exec(method, params)');
}
