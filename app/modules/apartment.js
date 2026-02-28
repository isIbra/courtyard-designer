import * as THREE from 'three';
import { scene } from './scene.js';
import { createProceduralTexture } from './textures.js';
import { FLOOR_HEIGHT } from './floor-manager.js';

// ── Constants ──
export const T = 0.35;
export const H = 3.0;
export const DOOR_H = 2.1;

export const ROOMS = [
  { id: 'closet',       name: 'Closet',       x: 0.83,  z: 1.41,  w: 4.68,  d: 11.65, floorType: 'wood_oak' },
  { id: 'staircase',    name: 'Staircase',    x: 5.93,  z: 1.41,  w: 5.96,  d: 11.56, floorType: 'concrete_smooth' },
  { id: 'bedroom',      name: 'Bedroom',      x: 11.89, z: 2.49,  w: 19.94, d: 10.75, floorType: 'wood_walnut' },
  { id: 'bathroom',     name: 'Bathroom',     x: 25.59, z: 2.49,  w: 6.24,  d: 6.18,  floorType: 'tile_square',     yOffset: 0.015 },
  { id: 'living',       name: 'Living Room',  x: 0.83,  z: 13.24, w: 29.32, d: 7.06,  floorType: 'wood_herringbone' },
  { id: 'living_south', name: 'Living South', x: 11.89, z: 20.30, w: 18.26, d: 4.74,  floorType: 'wood_herringbone' },
  { id: 'storage',      name: 'Storage',      x: 0.83,  z: 20.30, w: 2.20,  d: 4.74,  floorType: 'concrete_rough',  yOffset: 0.015 },
  { id: 'kitchen',      name: 'Kitchen',      x: 3.03,  z: 20.30, w: 8.86,  d: 4.74,  floorType: 'tile_subway',     yOffset: 0.015 },
  { id: 'guestroom',    name: 'Guest Room',   x: 0.83,  z: 25.04, w: 8.17,  d: 6.09,  floorType: 'wood_ash' },
  { id: 'room2',        name: 'Room 2',       x: 9.0,   z: 25.04, w: 9.50,  d: 6.09,  floorType: 'wood_oak' },
  { id: 'room3',        name: 'Room 3',       x: 18.50, z: 25.04, w: 4.30,  d: 6.09,  floorType: 'wood_oak' },
  { id: 'room4',        name: 'Room 4',       x: 22.80, z: 25.04, w: 7.35,  d: 6.09,  floorType: 'wood_walnut' },
];

export const floorMeshes = [];
export const wallMeshes = [];
export const ceilingMeshes = [];
export const wallMeshMap = new Map(); // id -> mesh

export function setCeilingsVisible(visible) {
  for (const mesh of ceilingMeshes) mesh.visible = visible;
}

// ── Build courtyard L-shaped floor (always built, not a floor tile) ──
export function buildCourtyardFloor() {
  const cyShape = new THREE.Shape();
  cyShape.moveTo(31.83, -13.28);
  cyShape.lineTo(30.15, -13.28);
  cyShape.lineTo(30.15, -31.13);
  cyShape.lineTo(47.12, -31.13);
  cyShape.lineTo(47.12, -23.17);
  cyShape.lineTo(44.13, -23.17);
  cyShape.lineTo(44.13, -2.49);
  cyShape.lineTo(31.83, -2.49);
  cyShape.closePath();

  const cyGeo = new THREE.ShapeGeometry(cyShape);

  const cyUv = cyGeo.attributes.uv;
  const cxMin = 30.15, cxMax = 47.12;
  const cyMin = -31.13, cyMax = -2.49;
  for (let i = 0; i < cyUv.count; i++) {
    cyUv.setX(i, (cyUv.getX(i) - cxMin) / (cxMax - cxMin));
    cyUv.setY(i, (cyUv.getY(i) - cyMin) / (cyMax - cyMin));
  }
  cyUv.needsUpdate = true;

  const cyTex = createProceduralTexture('stone_travertine');
  const cyRepeatX = (cxMax - cxMin) / 3;
  const cyRepeatZ = (cyMax - cyMin) / 3;

  const cyMap = cyTex.map.clone();
  cyMap.repeat.set(cyRepeatX, cyRepeatZ);
  cyMap.wrapS = THREE.RepeatWrapping;
  cyMap.wrapT = THREE.RepeatWrapping;
  cyMap.needsUpdate = true;

  const cyNormal = cyTex.normalMap.clone();
  cyNormal.repeat.set(cyRepeatX, cyRepeatZ);
  cyNormal.wrapS = THREE.RepeatWrapping;
  cyNormal.wrapT = THREE.RepeatWrapping;
  cyNormal.needsUpdate = true;

  const cyFloorMat = new THREE.MeshStandardMaterial({
    map: cyMap,
    normalMap: cyNormal,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughness: cyTex.roughness,
    metalness: 0.0,
  });

  const cyFloor = new THREE.Mesh(cyGeo, cyFloorMat);
  cyFloor.rotation.x = -Math.PI / 2;
  cyFloor.position.y = 0.005;
  cyFloor.receiveShadow = true;
  cyFloor.name = 'floor_courtyard';
  cyFloor.userData.roomId = 'courtyard';
  cyFloor.userData.isFloor = true;
  cyFloor.userData.floor = 0;
  scene.add(cyFloor);
  floorMeshes.push(cyFloor);
}

/** Generate seed floor tile records from ROOMS array (for first-load migration) */
export function generateSeedFloorTiles() {
  return ROOMS.map((room) => ({
    id: `ft_seed_${room.id}`,
    x: room.x,
    z: room.z,
    w: room.w,
    d: room.d,
    floor: 0,
    texType: room.floorType,
    yOffset: room.yOffset || 0,
    roomId: room.id,
  }));
}

// ── Build ceilings for floor tiles (called after floor tiles are loaded) ──
export function buildCeilings(floorTileRecords) {
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0xF5F0E8,
    roughness: 0.9,
    metalness: 0.0,
  });

  for (const rec of floorTileRecords) {
    const floorLevel = rec.floor || 0;
    const yBase = floorLevel * FLOOR_HEIGHT;
    const ceilGeo = new THREE.PlaneGeometry(rec.w, rec.d);
    const ceilMesh = new THREE.Mesh(ceilGeo, ceilingMat.clone());
    ceilMesh.rotation.x = Math.PI / 2;
    ceilMesh.position.set(rec.x + rec.w / 2, yBase + H - 0.005, rec.z + rec.d / 2);
    ceilMesh.name = `ceiling_${rec.id}`;
    ceilMesh.userData.floor = floorLevel;
    scene.add(ceilMesh);
    ceilingMeshes.push(ceilMesh);
  }
}

// Legacy — kept for backward compat, delegates to new system
export function buildRoomFloors() {
  buildCourtyardFloor();
}

/** Apply a saved texture to a room's floor mesh */
export function applyFloorTexture(roomId, texType) {
  let floorMesh = scene.getObjectByName(`floor_${roomId}`);
  if (!floorMesh) {
    // Look for seed floor tile for this room
    floorMesh = scene.getObjectByName(`floorTile_ft_seed_${roomId}`);
  }
  if (!floorMesh) return;

  const tex = createProceduralTexture(texType);
  const mat = floorMesh.material;

  // Calculate repeat
  let repeatX = 2, repeatZ = 2;
  if (roomId === 'courtyard') {
    repeatX = 6;
    repeatZ = 10;
  } else if (floorMesh.geometry.parameters) {
    repeatX = (floorMesh.geometry.parameters.width || 4) / 2;
    repeatZ = (floorMesh.geometry.parameters.height || 4) / 2;
  }

  const newMap = tex.map.clone();
  newMap.repeat.set(repeatX, repeatZ);
  newMap.wrapS = THREE.RepeatWrapping;
  newMap.wrapT = THREE.RepeatWrapping;
  newMap.needsUpdate = true;

  const newNormal = tex.normalMap.clone();
  newNormal.repeat.set(repeatX, repeatZ);
  newNormal.wrapS = THREE.RepeatWrapping;
  newNormal.wrapT = THREE.RepeatWrapping;
  newNormal.needsUpdate = true;

  mat.map = newMap;
  mat.normalMap = newNormal;
  mat.normalScale.set(0.3, 0.3);
  mat.roughness = tex.roughness;
  mat.color.setHex(0xffffff);
  mat.needsUpdate = true;
}

// ── Wall materials ──
const plasterTex = createProceduralTexture('plaster');
const wallMap = plasterTex.map.clone();
wallMap.repeat.set(4, 4);
wallMap.wrapS = THREE.RepeatWrapping;
wallMap.wrapT = THREE.RepeatWrapping;
wallMap.needsUpdate = true;

const wallNormal = plasterTex.normalMap.clone();
wallNormal.repeat.set(4, 4);
wallNormal.wrapS = THREE.RepeatWrapping;
wallNormal.wrapT = THREE.RepeatWrapping;
wallNormal.needsUpdate = true;

const wallMat = new THREE.MeshStandardMaterial({
  color: 0xEBE0D0,
  map: wallMap,
  normalMap: wallNormal,
  normalScale: new THREE.Vector2(0.15, 0.15),
  roughness: 0.92,
  metalness: 0.0,
});

// ── Wall Color System ──

/** Default wall colors per room (warm off-white variants) */
export const ROOM_WALL_COLORS = {
  closet:       '#EBE0D0',
  staircase:    '#E8DDD0',
  bedroom:      '#EDE5D8',
  bathroom:     '#F0EDE8',
  living:       '#EBE0D0',
  living_south: '#EBE0D0',
  storage:      '#E5DDD0',
  kitchen:      '#F0EBE0',
  guestroom:    '#EDE5D8',
  room2:        '#EBE0D0',
  room3:        '#EBE0D0',
  room4:        '#EDE5D8',
};

/** Preset wall color palette */
export const WALL_COLOR_PALETTE = [
  { name: 'Plaster',       hex: '#EBE0D0' },
  { name: 'Warm White',    hex: '#F5F0E8' },
  { name: 'Linen',         hex: '#F0E8D8' },
  { name: 'Sage',          hex: '#C5CDB8' },
  { name: 'Slate Blue',    hex: '#A0AAB8' },
  { name: 'Dusty Rose',    hex: '#D4B0A8' },
  { name: 'Terracotta',    hex: '#C08060' },
  { name: 'Sand',          hex: '#D4C4A0' },
  { name: 'Charcoal',      hex: '#484848' },
  { name: 'Midnight',      hex: '#2A2A38' },
  { name: 'Olive',         hex: '#808060' },
  { name: 'Blush',         hex: '#E8C8C0' },
];

/** Current active wall colors (modified at runtime) */
const activeWallColors = { ...ROOM_WALL_COLORS };

/** Check if a wall mesh belongs to a room by position overlap */
function wallBelongsToRoom(wallMesh, room) {
  const rec = wallMesh.userData.wallRecord;
  if (!rec) return false;
  const margin = 0.5; // tolerance

  if (rec.type === 'h') {
    // Horizontal wall at z — check if z is near room top/bottom edges and x overlaps
    const roomZ1 = room.z;
    const roomZ2 = room.z + room.d;
    const zNear = Math.abs(rec.z - roomZ1) < margin || Math.abs(rec.z - roomZ2) < margin ||
                  (rec.z > roomZ1 - margin && rec.z < roomZ2 + margin);
    const xOverlap = rec.x1 < (room.x + room.w + margin) && rec.x2 > (room.x - margin);
    return zNear && xOverlap;
  } else {
    // Vertical wall at x — check if x is near room left/right edges and z overlaps
    const roomX1 = room.x;
    const roomX2 = room.x + room.w;
    const xNear = Math.abs(rec.x - roomX1) < margin || Math.abs(rec.x - roomX2) < margin ||
                  (rec.x > roomX1 - margin && rec.x < roomX2 + margin);
    const zOverlap = rec.z1 < (room.z + room.d + margin) && rec.z2 > (room.z - margin);
    return xNear && zOverlap;
  }
}

/** Set wall color for a specific room */
export function setWallColor(roomId, hex) {
  activeWallColors[roomId] = hex;
  const room = ROOMS.find(r => r.id === roomId);
  if (!room) return;

  const color = new THREE.Color(hex);
  for (const mesh of wallMeshes) {
    if (wallBelongsToRoom(mesh, room)) {
      // Clone material if still shared
      if (mesh.material === wallMat) {
        mesh.material = wallMat.clone();
      }
      mesh.material.color.copy(color);
      mesh.material.map = null;
      mesh.material.needsUpdate = true;
    }
  }
}

/** Get current wall color for a room */
export function getWallColor(roomId) {
  return activeWallColors[roomId] || ROOM_WALL_COLORS[roomId] || '#EBE0D0';
}

/** Get all current wall colors */
export function getAllWallColors() {
  return { ...activeWallColors };
}

/** Load saved wall colors (from persistence) */
export function loadWallColors(saved) {
  if (!saved) return;
  for (const [roomId, hex] of Object.entries(saved)) {
    activeWallColors[roomId] = hex;
    setWallColor(roomId, hex);
  }
}

/** Set color for a specific individual wall by wallId */
export function setIndividualWallColor(wallId, hex) {
  const mesh = wallMeshMap.get(wallId);
  if (!mesh) return;
  // Clone material if still shared
  if (mesh.material === wallMat) {
    mesh.material = wallMat.clone();
  }
  mesh.material.color.set(hex);
  mesh.material.map = null;
  mesh.material.needsUpdate = true;
  mesh.userData.customColor = hex;
}

/** Get current color for a specific individual wall */
export function getIndividualWallColor(wallId) {
  const mesh = wallMeshMap.get(wallId);
  return mesh?.userData.customColor || null;
}

const highlightMat = new THREE.MeshStandardMaterial({
  color: 0xc8a96e,
  roughness: 0.8,
  metalness: 0.1,
  emissive: 0x332200,
  emissiveIntensity: 0.15,
});

// ── Data-driven wall creation ──
export function addWallFromRecord(rec) {
  const wallH = rec.H || H;
  const wallT = rec.T || T;
  const floorLevel = rec.floor || 0;
  const yBase = floorLevel * FLOOR_HEIGHT;
  let mesh;

  if (rec.type === 'h') {
    const w = rec.x2 - rec.x1;
    if (w < 0.05) return null;
    mesh = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, wallT), wallMat);
    mesh.position.set(rec.x1 + w / 2, wallH / 2 + yBase, rec.z);
  } else {
    const d = rec.z2 - rec.z1;
    if (d < 0.05) return null;
    mesh = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, d), wallMat);
    mesh.position.set(rec.x, wallH / 2 + yBase, rec.z1 + d / 2);
  }

  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.wallId = rec.id;
  mesh.userData.wallRecord = rec;
  mesh.userData.floor = floorLevel;
  scene.add(mesh);
  wallMeshes.push(mesh);
  wallMeshMap.set(rec.id, mesh);
  return mesh;
}

export function removeWallById(id) {
  const mesh = wallMeshMap.get(id);
  if (!mesh) return;
  scene.remove(mesh);
  const idx = wallMeshes.indexOf(mesh);
  if (idx !== -1) wallMeshes.splice(idx, 1);
  wallMeshMap.delete(id);
  mesh.geometry.dispose();
}

export function highlightWall(id) {
  const mesh = wallMeshMap.get(id);
  if (mesh) {
    mesh._origMat = mesh.material;
    mesh.material = highlightMat;
  }
}

export function unhighlightWall(id) {
  const mesh = wallMeshMap.get(id);
  if (mesh && mesh._origMat) {
    mesh.material = mesh._origMat;
    delete mesh._origMat;
  }
}
