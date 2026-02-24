// ── Floor Builder — Satisfactory-style floor platform placement ──

import * as THREE from 'three';
import { scene, camera, renderer } from './scene.js';
import { getCurrentFloor, getYBase } from './floor-manager.js';
import { createProceduralTexture } from './textures.js';
import { putFloorTile, deleteFloorTile as dbDeleteTile } from './db.js';
import { pushAction } from './history.js';

// ── State ──
let buildMode = false;
let startPoint = null;
let ghostMesh = null;
let selectedTileId = null;

export const floorTileRecords = new Map();
export const floorTileMeshes = new Map(); // id -> mesh

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const SNAP = 1.0; // 1m grid for floors (coarser than wall 0.25m)

function snap(v) {
  return Math.round(v / SNAP) * SNAP;
}

function getFloorHit(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const yBase = getYBase(getCurrentFloor());
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -yBase);
  const pt = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, pt);
  return pt;
}

// ── Ghost preview ──
const ghostMat = new THREE.MeshStandardMaterial({
  color: 0xc8a96e,
  transparent: true,
  opacity: 0.35,
  side: THREE.DoubleSide,
});

function updateGhost(startPt, endPt) {
  if (ghostMesh) {
    scene.remove(ghostMesh);
    ghostMesh.geometry.dispose();
    ghostMesh = null;
  }

  const x1 = Math.min(startPt.x, endPt.x);
  const x2 = Math.max(startPt.x, endPt.x);
  const z1 = Math.min(startPt.z, endPt.z);
  const z2 = Math.max(startPt.z, endPt.z);
  const w = x2 - x1;
  const d = z2 - z1;
  if (w < 0.5 && d < 0.5) return;

  const geo = new THREE.PlaneGeometry(Math.max(w, 0.5), Math.max(d, 0.5));
  ghostMesh = new THREE.Mesh(geo, ghostMat);
  ghostMesh.rotation.x = -Math.PI / 2;
  const yBase = getYBase(getCurrentFloor());
  ghostMesh.position.set((x1 + x2) / 2, yBase + 0.01, (z1 + z2) / 2);
  scene.add(ghostMesh);
}

function clearGhost() {
  if (ghostMesh) {
    scene.remove(ghostMesh);
    ghostMesh.geometry.dispose();
    ghostMesh = null;
  }
}

// ── Highlight material for selection ──
const highlightMat = new THREE.MeshStandardMaterial({
  color: 0xc8a96e,
  roughness: 0.8,
  metalness: 0.1,
  emissive: 0x332200,
  emissiveIntensity: 0.15,
});

// ── Create mesh from record ──
function createTileMesh(rec) {
  const tex = createProceduralTexture(rec.texType || 'concrete_smooth');
  const repeatX = rec.w / 2;
  const repeatZ = rec.d / 2;

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

  const mat = new THREE.MeshStandardMaterial({
    map: floorMap,
    normalMap: floorNormal,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughness: tex.roughness,
    metalness: 0.0,
  });

  const geo = new THREE.PlaneGeometry(rec.w, rec.d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  const yBase = (rec.floor || 0) * 3.0;
  const yOffset = rec.yOffset || 0;
  mesh.position.set(rec.x + rec.w / 2, yBase + 0.005 + yOffset, rec.z + rec.d / 2);
  mesh.receiveShadow = true;
  mesh.name = `floorTile_${rec.id}`;
  mesh.userData.tileId = rec.id;
  mesh.userData.tileRecord = rec;
  mesh.userData.floor = rec.floor || 0;
  mesh.userData.isFloor = true;

  return mesh;
}

// ── Public API ──

export function isFloorBuildMode() { return buildMode; }

export function toggleFloorBuildMode() {
  buildMode = !buildMode;
  startPoint = null;
  clearGhost();
  renderer.domElement.style.cursor = buildMode ? 'crosshair' : '';
  const btn = document.getElementById('btn-floor');
  if (btn) btn.classList.toggle('active', buildMode);
  if (buildMode) deselectTile();
  return buildMode;
}

export function onFloorClick(event) {
  if (!buildMode) return false;

  const pt = getFloorHit(event);
  if (!pt) return false;

  const snapped = { x: snap(pt.x), z: snap(pt.z) };

  if (!startPoint) {
    startPoint = snapped;
    return true;
  }

  // Second click — place floor tile
  const x1 = Math.min(startPoint.x, snapped.x);
  const x2 = Math.max(startPoint.x, snapped.x);
  const z1 = Math.min(startPoint.z, snapped.z);
  const z2 = Math.max(startPoint.z, snapped.z);
  const w = x2 - x1;
  const d = z2 - z1;

  if (w < 0.5 && d < 0.5) {
    startPoint = null;
    clearGhost();
    return true;
  }

  const floor = getCurrentFloor();
  const rec = {
    id: `ft_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    x: x1,
    z: z1,
    w: Math.max(w, 1),
    d: Math.max(d, 1),
    floor,
    texType: 'concrete_smooth',
  };

  addFloorTile(rec);
  putFloorTile(rec); // fire-and-forget

  const savedRec = { ...rec };
  pushAction({
    label: 'Place floor tile',
    undo() {
      removeFloorTile(savedRec.id);
      dbDeleteTile(savedRec.id);
    },
    redo() {
      addFloorTile(savedRec);
      putFloorTile(savedRec);
    },
  });

  startPoint = null;
  clearGhost();
  return true;
}

export function onFloorMouseMove(event) {
  if (!buildMode || !startPoint) return;

  const pt = getFloorHit(event);
  if (!pt) return;

  const snapped = { x: snap(pt.x), z: snap(pt.z) };
  updateGhost(startPoint, snapped);
}

export function onFloorSelect(event) {
  if (buildMode) return false;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const meshArr = [...floorTileMeshes.values()];
  const hits = raycaster.intersectObjects(meshArr);
  if (hits.length > 0) {
    const tileId = hits[0].object.userData.tileId;
    if (tileId) {
      selectTile(tileId);
      return true;
    }
  }
  return false;
}

function selectTile(id) {
  if (selectedTileId) deselectTile();
  selectedTileId = id;
  const mesh = floorTileMeshes.get(id);
  if (mesh) {
    mesh._origMat = mesh.material;
    mesh.material = highlightMat;
  }
  const bar = document.getElementById('selection-bar');
  bar.textContent = `Floor tile — [Del] delete  [Esc] deselect`;
  bar.style.display = 'block';
}

export function deselectTile() {
  if (selectedTileId) {
    const mesh = floorTileMeshes.get(selectedTileId);
    if (mesh && mesh._origMat) {
      mesh.material = mesh._origMat;
      delete mesh._origMat;
    }
    selectedTileId = null;
    document.getElementById('selection-bar').style.display = 'none';
  }
}

export function deleteSelectedTile() {
  if (!selectedTileId) return false;
  const id = selectedTileId;
  const savedRec = floorTileRecords.get(id) ? { ...floorTileRecords.get(id) } : null;
  deselectTile();
  removeFloorTile(id);
  dbDeleteTile(id); // fire-and-forget

  if (savedRec) {
    pushAction({
      label: 'Delete floor tile',
      undo() {
        addFloorTile(savedRec);
        putFloorTile(savedRec);
      },
      redo() {
        removeFloorTile(savedRec.id);
        dbDeleteTile(savedRec.id);
      },
    });
  }
  return true;
}

export function getSelectedTileId() { return selectedTileId; }

export function onFloorKeyDown(key) {
  if (key === 'Escape') {
    if (buildMode && startPoint) {
      startPoint = null;
      clearGhost();
      return true;
    }
    if (buildMode) {
      toggleFloorBuildMode();
      return true;
    }
    if (selectedTileId) {
      deselectTile();
      return true;
    }
    return false;
  }
  if (key === 'Delete' || key === 'Backspace') {
    return deleteSelectedTile();
  }
  return false;
}

// ── Add/remove floor tiles ──

export function addFloorTile(rec) {
  floorTileRecords.set(rec.id, rec);
  const mesh = createTileMesh(rec);
  scene.add(mesh);
  floorTileMeshes.set(rec.id, mesh);
  return mesh;
}

export function removeFloorTile(id) {
  const mesh = floorTileMeshes.get(id);
  if (mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    floorTileMeshes.delete(id);
  }
  floorTileRecords.delete(id);
}

// ── Bulk load ──
export function loadFloorTiles(records) {
  for (const rec of records) {
    addFloorTile(rec);
  }
}

// ── Clear all ──
export function clearAllFloorTiles() {
  for (const id of [...floorTileMeshes.keys()]) {
    removeFloorTile(id);
  }
}

// ── Apply texture to a specific tile ──
export function applyTileTexture(tileId, texType, _skipHistory = false) {
  const rec = floorTileRecords.get(tileId);
  if (!rec) return;
  const oldTexType = rec.texType;
  rec.texType = texType;

  if (!_skipHistory && oldTexType !== texType) {
    pushAction({
      label: 'Change tile texture',
      undo() { applyTileTexture(tileId, oldTexType, true); },
      redo() { applyTileTexture(tileId, texType, true); },
    });
  }

  // Recreate mesh
  const oldMesh = floorTileMeshes.get(tileId);
  if (oldMesh) {
    scene.remove(oldMesh);
    oldMesh.geometry.dispose();
  }

  const mesh = createTileMesh(rec);
  scene.add(mesh);
  floorTileMeshes.set(tileId, mesh);

  // Persist
  putFloorTile(rec);
}
