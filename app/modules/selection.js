// ── Selection — multi-select, box select, group move ──

import * as THREE from 'three';
import { camera, renderer } from './scene.js';
import { getCurrentFloor, getYBase } from './floor-manager.js';
import { wallRecords } from './wall-builder.js';
import { wallMeshMap, wallMeshes } from './apartment.js';
import { placed } from './furniture.js';
import { floorTileMeshes, floorTileRecords } from './floor-builder.js';
import { stairMeshes, stairRecords } from './stair-builder.js';

// ── State ──
const selected = new Set(); // Set<THREE.Object3D>
let boxSelecting = false;
let boxStart = null;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// ── Highlight helpers ──
const highlightColor = new THREE.Color(0xc8a96e);

export function highlightObj(obj) {
  obj.traverse((c) => {
    if (!c.isMesh) return;
    if (!c._selOrigMat) {
      c._selOrigMat = c.material;
      c.material = c.material.clone();
    }
    c.material.emissive = highlightColor;
    c.material.emissiveIntensity = 0.15;
    c.material.needsUpdate = true;
  });
}

export function unhighlightObj(obj) {
  obj.traverse((c) => {
    if (!c.isMesh || !c._selOrigMat) return;
    c.material.dispose();
    c.material = c._selOrigMat;
    delete c._selOrigMat;
  });
}

// ── Box select overlay ──
const selectRect = document.getElementById('select-rect');

function updateSelectRect(sx, sy, ex, ey) {
  if (!selectRect) return;
  const left = Math.min(sx, ex);
  const top = Math.min(sy, ey);
  const width = Math.abs(ex - sx);
  const height = Math.abs(ey - sy);
  selectRect.style.left = left + 'px';
  selectRect.style.top = top + 'px';
  selectRect.style.width = width + 'px';
  selectRect.style.height = height + 'px';
  selectRect.style.display = 'block';
}

function hideSelectRect() {
  if (selectRect) selectRect.style.display = 'none';
}

// ── Public API ──

export function getSelectedCount() { return selected.size; }
export function getSelected() { return selected; }

export function clearSelection() {
  for (const obj of selected) {
    unhighlightObj(obj);
  }
  selected.clear();
  updateSelectionBar();
}

export function addToSelection(obj) {
  if (selected.has(obj)) return;
  selected.add(obj);
  highlightObj(obj);
  updateSelectionBar();
}

export function removeFromSelection(obj) {
  if (!selected.has(obj)) return;
  unhighlightObj(obj);
  selected.delete(obj);
  updateSelectionBar();
}

export function toggleInSelection(obj) {
  if (selected.has(obj)) {
    removeFromSelection(obj);
  } else {
    addToSelection(obj);
  }
}

/** Select all objects on current floor */
export function selectAllOnFloor() {
  const floor = getCurrentFloor();

  for (const [id, mesh] of wallMeshMap) {
    const rec = wallRecords.get(id);
    if (rec && (rec.floor || 0) === floor) addToSelection(mesh);
  }

  for (const mesh of placed) {
    if ((mesh.userData.floor || 0) === floor) addToSelection(mesh);
  }

  for (const [id, mesh] of floorTileMeshes) {
    const rec = floorTileRecords.get(id);
    if (rec && (rec.floor || 0) === floor) addToSelection(mesh);
  }

  for (const [id, group] of stairMeshes) {
    const rec = stairRecords.get(id);
    if (rec && rec.fromFloor === floor) addToSelection(group);
  }
}

/** Ctrl+click handler — returns true if handled */
export function onSelectionClick(event) {
  if (!event.ctrlKey && !event.metaKey) return false;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  // Test walls
  const wallHits = raycaster.intersectObjects(wallMeshes);
  if (wallHits.length > 0) {
    toggleInSelection(wallHits[0].object);
    return true;
  }

  // Test furniture
  const furnMeshes = placed.flatMap((g) => {
    const children = [];
    g.traverse((c) => { if (c.isMesh) children.push(c); });
    return children;
  });
  const furnHits = raycaster.intersectObjects(furnMeshes);
  if (furnHits.length > 0) {
    let obj = furnHits[0].object;
    while (obj.parent && !obj.userData.furnitureId) obj = obj.parent;
    if (obj.userData.furnitureId) {
      toggleInSelection(obj);
      return true;
    }
  }

  // Test floor tiles
  const tileHits = raycaster.intersectObjects([...floorTileMeshes.values()]);
  if (tileHits.length > 0) {
    toggleInSelection(tileHits[0].object);
    return true;
  }

  return false;
}

/** Box select start (Ctrl+mousedown) */
export function onBoxSelectStart(event) {
  if (!event.ctrlKey && !event.metaKey) return false;
  boxSelecting = true;
  boxStart = { x: event.clientX, y: event.clientY };
  return true;
}

/** Box select move */
export function onBoxSelectMove(event) {
  if (!boxSelecting || !boxStart) return;
  updateSelectRect(boxStart.x, boxStart.y, event.clientX, event.clientY);
}

/** Box select end */
export function onBoxSelectEnd(event) {
  if (!boxSelecting || !boxStart) return;
  hideSelectRect();
  boxSelecting = false;

  const x1 = Math.min(boxStart.x, event.clientX);
  const y1 = Math.min(boxStart.y, event.clientY);
  const x2 = Math.max(boxStart.x, event.clientX);
  const y2 = Math.max(boxStart.y, event.clientY);

  if (x2 - x1 < 5 && y2 - y1 < 5) {
    boxStart = null;
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  const floor = getCurrentFloor();

  function isInBox(obj) {
    const pos = new THREE.Vector3();
    obj.getWorldPosition(pos);
    pos.project(camera);
    const sx = (pos.x * 0.5 + 0.5) * rect.width + rect.left;
    const sy = (-pos.y * 0.5 + 0.5) * rect.height + rect.top;
    return sx >= x1 && sx <= x2 && sy >= y1 && sy <= y2;
  }

  for (const [id, mesh] of wallMeshMap) {
    const rec = wallRecords.get(id);
    if (rec && (rec.floor || 0) === floor && isInBox(mesh)) addToSelection(mesh);
  }

  for (const mesh of placed) {
    if ((mesh.userData.floor || 0) === floor && isInBox(mesh)) addToSelection(mesh);
  }

  for (const [id, mesh] of floorTileMeshes) {
    const rec = floorTileRecords.get(id);
    if (rec && (rec.floor || 0) === floor && isInBox(mesh)) addToSelection(mesh);
  }

  boxStart = null;
}

function updateSelectionBar() {
  const bar = document.getElementById('selection-bar');
  if (selected.size === 0) {
    bar.style.display = 'none';
  } else {
    bar.textContent = `${selected.size} item${selected.size > 1 ? 's' : ''} selected — [Del] delete  [Esc] deselect`;
    bar.style.display = 'block';
  }
}

export function onSelectionKeyDown(key, event) {
  if (key === 'a' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    selectAllOnFloor();
    return true;
  }
  if (key === 'Escape' && selected.size > 0) {
    clearSelection();
    return true;
  }
  if ((key === 'Delete' || key === 'Backspace') && selected.size > 0) {
    // Return the set for the caller to handle deletion
    return 'delete';
  }
  return false;
}
