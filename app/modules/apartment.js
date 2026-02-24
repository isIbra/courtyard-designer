import * as THREE from 'three';
import { scene } from './scene.js';
import { createProceduralTexture } from './textures.js';

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

// ── Build textured floors and ceilings for every room ──
export function buildRoomFloors() {
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0xF5F0E8,
    roughness: 0.9,
    metalness: 0.0,
  });

  for (const room of ROOMS) {
    const y = room.yOffset || 0;

    // Floor
    const tex = createProceduralTexture(room.floorType);
    const repeatX = room.w / 2;
    const repeatZ = room.d / 2;
    const floorMap = tex.map.clone();
    floorMap.repeat.set(repeatX, repeatZ);
    floorMap.wrapS = THREE.RepeatWrapping;
    floorMap.wrapT = THREE.RepeatWrapping;
    floorMap.needsUpdate = true;

    const floorNormal = tex.normalMap.clone();
    floorNormal.repeat.set(repeatX, repeatZ);
    floorNormal.wrapS = THREE.RepeatWrapping;
    floorNormal.wrapT = THREE.RepeatWrapping;
    floorNormal.needsUpdate = true;

    const floorMat = new THREE.MeshStandardMaterial({
      map: floorMap,
      normalMap: floorNormal,
      normalScale: new THREE.Vector2(0.3, 0.3),
      roughness: tex.roughness,
      metalness: 0.0,
    });

    const floorGeo = new THREE.PlaneGeometry(room.w, room.d);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(room.x + room.w / 2, y + 0.005, room.z + room.d / 2);
    floorMesh.receiveShadow = true;
    floorMesh.name = `floor_${room.id}`;
    floorMesh.userData.roomId = room.id;
    floorMesh.userData.isFloor = true;
    scene.add(floorMesh);
    floorMeshes.push(floorMesh);

    // Ceiling
    const ceilGeo = new THREE.PlaneGeometry(room.w, room.d);
    const ceilMesh = new THREE.Mesh(ceilGeo, ceilingMat);
    ceilMesh.rotation.x = Math.PI / 2;
    ceilMesh.position.set(room.x + room.w / 2, H - 0.005, room.z + room.d / 2);
    ceilMesh.name = `ceiling_${room.id}`;
    scene.add(ceilMesh);
    ceilingMeshes.push(ceilMesh);
  }

  // ── Courtyard L-shaped floor (wall-data.js coordinates) ──
  // Shape uses (worldX, -worldZ) so that after rotation.x = -π/2 it maps to (X, 0, Z)
  // Vertices in CCW order (viewed from +Z) so normals face +Z → +Y after rotation
  const cyShape = new THREE.Shape();
  cyShape.moveTo(31.83, -13.28);  // West jog
  cyShape.lineTo(30.15, -13.28);  // West step
  cyShape.lineTo(30.15, -31.13);  // SW
  cyShape.lineTo(47.12, -31.13);  // SE
  cyShape.lineTo(47.12, -23.17);  // East jog
  cyShape.lineTo(44.13, -23.17);  // East step
  cyShape.lineTo(44.13, -2.49);   // NE upper
  cyShape.lineTo(31.83, -2.49);   // NW
  cyShape.closePath();

  const cyGeo = new THREE.ShapeGeometry(cyShape);

  // Normalize UVs to 0..1 based on bounding box
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
  scene.add(cyFloor);
  floorMeshes.push(cyFloor);
}

/** Apply a saved texture to a room's floor mesh */
export function applyFloorTexture(roomId, texType) {
  const floorMesh = scene.getObjectByName(`floor_${roomId}`);
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
  let mesh;

  if (rec.type === 'h') {
    const w = rec.x2 - rec.x1;
    if (w < 0.05) return null;
    mesh = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, wallT), wallMat);
    mesh.position.set(rec.x1 + w / 2, wallH / 2, rec.z);
  } else {
    const d = rec.z2 - rec.z1;
    if (d < 0.05) return null;
    mesh = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, d), wallMat);
    mesh.position.set(rec.x, wallH / 2, rec.z1 + d / 2);
  }

  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.wallId = rec.id;
  mesh.userData.wallRecord = rec;
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
