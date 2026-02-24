import * as THREE from 'three';
import { scene, camera, renderer } from './scene.js';
import { addWallFromRecord, removeWallById, wallMeshes, highlightWall, unhighlightWall, H, T } from './apartment.js';
import { putWall, deleteWall as dbDeleteWall } from './db.js';
import { createWallRecord } from './wall-data.js';

// ── State ──
let buildMode = false;
let startPoint = null;
let ghostMesh = null;
let selectedWallId = null;

// In-memory wall records (source of truth, synced to DB)
export const wallRecords = new Map();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const SNAP = 0.25;

function snap(v) {
  return Math.round(v / SNAP) * SNAP;
}

function getFloorHit(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pt = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, pt);
  return pt;
}

// ── Ghost preview material ──
const ghostMat = new THREE.MeshStandardMaterial({
  color: 0xc8a96e,
  transparent: true,
  opacity: 0.4,
});

function updateGhost(startPt, endPt) {
  if (ghostMesh) {
    scene.remove(ghostMesh);
    ghostMesh.geometry.dispose();
    ghostMesh = null;
  }

  const dx = Math.abs(endPt.x - startPt.x);
  const dz = Math.abs(endPt.z - startPt.z);
  if (dx < 0.1 && dz < 0.1) return;

  if (dx >= dz) {
    const x1 = Math.min(startPt.x, endPt.x);
    const x2 = Math.max(startPt.x, endPt.x);
    const w = x2 - x1;
    const geo = new THREE.BoxGeometry(w, H, T);
    ghostMesh = new THREE.Mesh(geo, ghostMat);
    ghostMesh.position.set(x1 + w / 2, H / 2, startPt.z);
  } else {
    const z1 = Math.min(startPt.z, endPt.z);
    const z2 = Math.max(startPt.z, endPt.z);
    const d = z2 - z1;
    const geo = new THREE.BoxGeometry(T, H, d);
    ghostMesh = new THREE.Mesh(geo, ghostMat);
    ghostMesh.position.set(startPt.x, H / 2, z1 + d / 2);
  }

  scene.add(ghostMesh);
}

function clearGhost() {
  if (ghostMesh) {
    scene.remove(ghostMesh);
    ghostMesh.geometry.dispose();
    ghostMesh = null;
  }
}

// ── Public API ──

export function isBuildMode() { return buildMode; }

export function toggleWallBuildMode() {
  buildMode = !buildMode;
  startPoint = null;
  clearGhost();
  renderer.domElement.style.cursor = buildMode ? 'crosshair' : '';
  const btn = document.getElementById('btn-wall');
  if (btn) btn.classList.toggle('active', buildMode);
  if (buildMode) deselectWall();
  return buildMode;
}

export function onWallClick(event) {
  if (!buildMode) return false;

  const pt = getFloorHit(event);
  if (!pt) return false;

  const snapped = { x: snap(pt.x), z: snap(pt.z) };

  if (!startPoint) {
    startPoint = snapped;
    return true;
  }

  // Second click — place wall
  const dx = Math.abs(snapped.x - startPoint.x);
  const dz = Math.abs(snapped.z - startPoint.z);

  if (dx < 0.1 && dz < 0.1) {
    startPoint = null;
    clearGhost();
    return true;
  }

  let rec;
  if (dx >= dz) {
    const x1 = Math.min(startPoint.x, snapped.x);
    const x2 = Math.max(startPoint.x, snapped.x);
    rec = createWallRecord('h', { z: startPoint.z, x1, x2 });
  } else {
    const z1 = Math.min(startPoint.z, snapped.z);
    const z2 = Math.max(startPoint.z, snapped.z);
    rec = createWallRecord('v', { x: startPoint.x, z1, z2 });
  }

  wallRecords.set(rec.id, rec);
  addWallFromRecord(rec);
  putWall(rec); // fire-and-forget

  startPoint = null;
  clearGhost();
  return true;
}

export function onWallMouseMove(event) {
  if (!buildMode || !startPoint) return;

  const pt = getFloorHit(event);
  if (!pt) return;

  const snapped = { x: snap(pt.x), z: snap(pt.z) };
  updateGhost(startPoint, snapped);
}

export function onWallSelect(event) {
  if (buildMode) return false;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const hits = raycaster.intersectObjects(wallMeshes);
  if (hits.length > 0) {
    const wallId = hits[0].object.userData.wallId;
    if (wallId) {
      selectWall(wallId);
      return true;
    }
  }

  deselectWall();
  return false;
}

function selectWall(id) {
  if (selectedWallId) unhighlightWall(selectedWallId);
  selectedWallId = id;
  highlightWall(id);

  const bar = document.getElementById('selection-bar');
  const rec = wallRecords.get(id);
  const label = rec ? (rec.isOriginal ? 'original' : 'custom') : 'wall';
  bar.textContent = `Wall (${label}) — [Del] delete  [Esc] deselect`;
  bar.style.display = 'block';
}

export function deselectWall() {
  if (selectedWallId) {
    unhighlightWall(selectedWallId);
    selectedWallId = null;
    document.getElementById('selection-bar').style.display = 'none';
  }
}

export function deleteSelectedWall() {
  if (!selectedWallId) return false;
  const id = selectedWallId;
  deselectWall();
  removeWallById(id);
  wallRecords.delete(id);
  dbDeleteWall(id); // fire-and-forget
  return true;
}

export function getSelectedWallId() { return selectedWallId; }

export function onWallKeyDown(key) {
  if (key === 'Escape') {
    if (buildMode && startPoint) {
      startPoint = null;
      clearGhost();
      return true;
    }
    if (buildMode) {
      toggleWallBuildMode();
      return true;
    }
    if (selectedWallId) {
      deselectWall();
      return true;
    }
    return false;
  }
  if (key === 'Delete' || key === 'Backspace') {
    return deleteSelectedWall();
  }
  return false;
}

// ── Bulk load (called during init) ──
export function loadWallRecords(records) {
  wallRecords.clear();
  for (const rec of records) {
    wallRecords.set(rec.id, rec);
    addWallFromRecord(rec);
  }
}

// ── Clear all walls from scene ──
export function clearAllWalls() {
  for (const id of [...wallRecords.keys()]) {
    removeWallById(id);
  }
  wallRecords.clear();
}
