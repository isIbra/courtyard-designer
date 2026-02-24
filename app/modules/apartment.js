import * as THREE from 'three';
import { scene } from './scene.js';

// ── Constants ──
export const T = 0.35;
export const H = 3.0;
export const DOOR_H = 2.1;

export const ROOMS = [];
export const floorMeshes = [];
export const wallMeshes = [];
export const ceilingMeshes = [];
export const wallMeshMap = new Map(); // id -> mesh

export function setCeilingsVisible(_visible) {}

// ── Wall materials ──
const wallMat = new THREE.MeshStandardMaterial({
  color: 0xEBE0D0,
  roughness: 0.95,
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
