// ── IndexedDB wrapper for courtyard-designer ──

const DB_NAME = 'courtyard-designer';
const DB_VERSION = 2;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('walls')) {
        db.createObjectStore('walls', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('furniture')) {
        db.createObjectStore('furniture', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
      // v2: floor tiles + stairs
      if (!db.objectStoreNames.contains('floorTiles')) {
        db.createObjectStore('floorTiles', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('stairs')) {
        db.createObjectStore('stairs', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function store(name, mode = 'readonly') {
  return openDB().then((db) => db.transaction(name, mode).objectStore(name));
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Walls ──

export async function getAllWalls() {
  return wrap((await store('walls')).getAll());
}

export async function putWall(wall) {
  return wrap((await store('walls', 'readwrite')).put(wall));
}

export async function deleteWall(id) {
  return wrap((await store('walls', 'readwrite')).delete(id));
}

export async function putAllWalls(walls) {
  const db = await openDB();
  const txn = db.transaction('walls', 'readwrite');
  const s = txn.objectStore('walls');
  for (const w of walls) s.put(w);
  return new Promise((resolve, reject) => {
    txn.oncomplete = resolve;
    txn.onerror = () => reject(txn.error);
  });
}

export async function clearWalls() {
  return wrap((await store('walls', 'readwrite')).clear());
}

// ── Furniture ──

export async function getAllFurniture() {
  return wrap((await store('furniture')).getAll());
}

export async function putAllFurniture(items) {
  const db = await openDB();
  const txn = db.transaction('furniture', 'readwrite');
  const s = txn.objectStore('furniture');
  for (const item of items) s.put(item);
  return new Promise((resolve, reject) => {
    txn.oncomplete = resolve;
    txn.onerror = () => reject(txn.error);
  });
}

export async function clearFurniture() {
  return wrap((await store('furniture', 'readwrite')).clear());
}

// ── Meta ──

export async function getMeta(key) {
  return wrap((await store('meta')).get(key));
}

export async function putMeta(key, value) {
  return wrap((await store('meta', 'readwrite')).put({ key, value }));
}

// ── Floor Tiles ──

export async function getAllFloorTiles() {
  return wrap((await store('floorTiles')).getAll());
}

export async function putFloorTile(tile) {
  return wrap((await store('floorTiles', 'readwrite')).put(tile));
}

export async function deleteFloorTile(id) {
  return wrap((await store('floorTiles', 'readwrite')).delete(id));
}

export async function putAllFloorTiles(tiles) {
  const db = await openDB();
  const txn = db.transaction('floorTiles', 'readwrite');
  const s = txn.objectStore('floorTiles');
  for (const t of tiles) s.put(t);
  return new Promise((resolve, reject) => {
    txn.oncomplete = resolve;
    txn.onerror = () => reject(txn.error);
  });
}

export async function clearFloorTiles() {
  return wrap((await store('floorTiles', 'readwrite')).clear());
}

// ── Stairs ──

export async function getAllStairs() {
  return wrap((await store('stairs')).getAll());
}

export async function putStair(stair) {
  return wrap((await store('stairs', 'readwrite')).put(stair));
}

export async function deleteStair(id) {
  return wrap((await store('stairs', 'readwrite')).delete(id));
}

export async function putAllStairs(stairList) {
  const db = await openDB();
  const txn = db.transaction('stairs', 'readwrite');
  const s = txn.objectStore('stairs');
  for (const st of stairList) s.put(st);
  return new Promise((resolve, reject) => {
    txn.oncomplete = resolve;
    txn.onerror = () => reject(txn.error);
  });
}

export async function clearStairs() {
  return wrap((await store('stairs', 'readwrite')).clear());
}
