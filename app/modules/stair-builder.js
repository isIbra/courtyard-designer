// ── Stair Builder — place stairs connecting floors ──

import * as THREE from 'three';
import { scene, camera, renderer } from './scene.js';
import { getCurrentFloor, getYBase, FLOOR_HEIGHT } from './floor-manager.js';
import { putStair, deleteStair as dbDeleteStair } from './db.js';
import { pushAction } from './history.js';
import { snap as gridSnap, getFloorHit } from './grid.js';

// ── State ──
let buildMode = false;
let direction = 'north'; // north, south, east, west
let ghostGroup = null;
let selectedStairId = null;

export const stairRecords = new Map();
export const stairMeshes = new Map(); // id -> THREE.Group

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const STAIR_WIDTH = 1.0;
const STAIR_LENGTH = 3.0;
const NUM_STEPS = 15;
const STEP_RISE = FLOOR_HEIGHT / NUM_STEPS; // 0.2m each
const STEP_RUN = STAIR_LENGTH / NUM_STEPS;  // 0.2m each

function snap(v) {
  return gridSnap(v, 1.0);
}

// ── Build stair geometry ──
const stairMat = new THREE.MeshStandardMaterial({
  color: 0x888888,
  roughness: 0.85,
  metalness: 0.0,
});

const ghostStairMat = new THREE.MeshStandardMaterial({
  color: 0xc8a96e,
  transparent: true,
  opacity: 0.35,
});

const highlightStairMat = new THREE.MeshStandardMaterial({
  color: 0xc8a96e,
  roughness: 0.8,
  metalness: 0.1,
  emissive: 0x332200,
  emissiveIntensity: 0.15,
});

function buildStairGroup(rec, isGhost = false) {
  const group = new THREE.Group();
  const mat = isGhost ? ghostStairMat : stairMat;
  const fromY = getYBase(rec.fromFloor);

  for (let i = 0; i < NUM_STEPS; i++) {
    const stepGeo = new THREE.BoxGeometry(rec.width, STEP_RISE, STEP_RUN);
    const step = new THREE.Mesh(stepGeo, mat);

    // Position relative to group origin
    const localY = STEP_RISE * (i + 0.5);
    let localX = 0, localZ = 0;

    switch (rec.direction) {
      case 'north': localZ = -STEP_RUN * (i + 0.5); break;
      case 'south': localZ = STEP_RUN * (i + 0.5); break;
      case 'east':
        localX = STEP_RUN * (i + 0.5);
        step.geometry.dispose();
        step.geometry = new THREE.BoxGeometry(STEP_RUN, STEP_RISE, rec.width);
        break;
      case 'west':
        localX = -STEP_RUN * (i + 0.5);
        step.geometry.dispose();
        step.geometry = new THREE.BoxGeometry(STEP_RUN, STEP_RISE, rec.width);
        break;
    }

    step.position.set(localX, localY, localZ);
    step.castShadow = true;
    step.receiveShadow = true;
    group.add(step);
  }

  group.position.set(rec.x, fromY, rec.z);
  group.userData.stairId = rec.id;
  group.userData.stairRecord = rec;
  // Visible on both connected floors
  group.userData.floor = rec.fromFloor;
  group.userData.stairFloors = [rec.fromFloor, rec.toFloor];

  return group;
}

// ── Ghost preview ──
function updateGhostPosition(pt) {
  const snapped = { x: snap(pt.x), z: snap(pt.z) };
  const floor = getCurrentFloor();

  if (ghostGroup) {
    scene.remove(ghostGroup);
  }

  const rec = {
    id: 'ghost',
    x: snapped.x,
    z: snapped.z,
    direction,
    fromFloor: floor,
    toFloor: floor + 1,
    width: STAIR_WIDTH,
    length: STAIR_LENGTH,
  };

  ghostGroup = buildStairGroup(rec, true);
  scene.add(ghostGroup);
}

function clearGhost() {
  if (ghostGroup) {
    scene.remove(ghostGroup);
    ghostGroup = null;
  }
}

// ── Public API ──

export function isStairBuildMode() { return buildMode; }

export function toggleStairBuildMode() {
  buildMode = !buildMode;
  clearGhost();
  renderer.domElement.style.cursor = buildMode ? 'crosshair' : '';
  const btn = document.getElementById('btn-stair');
  if (btn) btn.classList.toggle('active', buildMode);
  if (buildMode) deselectStair();
  return buildMode;
}

export function rotateStairDirection() {
  const dirs = ['north', 'east', 'south', 'west'];
  const idx = dirs.indexOf(direction);
  direction = dirs[(idx + 1) % 4];
  return direction;
}

export function getStairDirection() { return direction; }

export function onStairClick(event) {
  if (!buildMode) return false;

  const pt = getFloorHit(event);
  if (!pt) return false;

  const snapped = { x: snap(pt.x), z: snap(pt.z) };
  const floor = getCurrentFloor();

  const rec = {
    id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    x: snapped.x,
    z: snapped.z,
    direction,
    fromFloor: floor,
    toFloor: floor + 1,
    width: STAIR_WIDTH,
    length: STAIR_LENGTH,
  };

  addStair(rec);
  putStair(rec); // fire-and-forget

  const savedRec = { ...rec };
  pushAction({
    label: 'Place stairs',
    undo() {
      removeStair(savedRec.id);
      dbDeleteStair(savedRec.id);
    },
    redo() {
      addStair(savedRec);
      putStair(savedRec);
    },
  });

  return true;
}

export function onStairMouseMove(event) {
  if (!buildMode) return;
  const pt = getFloorHit(event);
  if (!pt) return;
  updateGhostPosition(pt);
}

export function onStairSelect(event) {
  if (buildMode) return false;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const allStairChildren = [];
  for (const group of stairMeshes.values()) {
    group.traverse((c) => { if (c.isMesh) allStairChildren.push(c); });
  }

  const hits = raycaster.intersectObjects(allStairChildren);
  if (hits.length > 0) {
    let obj = hits[0].object;
    while (obj.parent && !obj.userData.stairId) obj = obj.parent;
    if (obj.userData.stairId) {
      selectStair(obj.userData.stairId);
      return true;
    }
  }
  return false;
}

function selectStair(id) {
  if (selectedStairId) deselectStair();
  selectedStairId = id;
  const group = stairMeshes.get(id);
  if (group) {
    group.traverse((c) => {
      if (c.isMesh) {
        c._origMat = c.material;
        c.material = highlightStairMat;
      }
    });
  }
  const bar = document.getElementById('selection-bar');
  bar.textContent = `Stairs — [Del] delete  [Esc] deselect`;
  bar.style.display = 'block';
}

export function deselectStair() {
  if (selectedStairId) {
    const group = stairMeshes.get(selectedStairId);
    if (group) {
      group.traverse((c) => {
        if (c.isMesh && c._origMat) {
          c.material = c._origMat;
          delete c._origMat;
        }
      });
    }
    selectedStairId = null;
    document.getElementById('selection-bar').style.display = 'none';
  }
}

export function deleteSelectedStair() {
  if (!selectedStairId) return false;
  const id = selectedStairId;
  const savedRec = stairRecords.get(id) ? { ...stairRecords.get(id) } : null;
  deselectStair();
  removeStair(id);
  dbDeleteStair(id);

  if (savedRec) {
    pushAction({
      label: 'Delete stairs',
      undo() {
        addStair(savedRec);
        putStair(savedRec);
      },
      redo() {
        removeStair(savedRec.id);
        dbDeleteStair(savedRec.id);
      },
    });
  }
  return true;
}

export function getSelectedStairId() { return selectedStairId; }

export function onStairKeyDown(key) {
  if (key === 'Escape') {
    if (buildMode) {
      toggleStairBuildMode();
      return true;
    }
    if (selectedStairId) {
      deselectStair();
      return true;
    }
    return false;
  }
  if (key === 'Delete' || key === 'Backspace') {
    return deleteSelectedStair();
  }
  return false;
}

// ── Add/remove stairs ──

export function addStair(rec) {
  stairRecords.set(rec.id, rec);
  const group = buildStairGroup(rec);
  scene.add(group);
  stairMeshes.set(rec.id, group);
  return group;
}

export function removeStair(id) {
  const group = stairMeshes.get(id);
  if (group) {
    scene.remove(group);
    group.traverse((c) => { if (c.isMesh) c.geometry.dispose(); });
    stairMeshes.delete(id);
  }
  stairRecords.delete(id);
}

// ── Bulk load ──
export function loadStairs(records) {
  for (const rec of records) {
    addStair(rec);
  }
}

// ── Clear all ──
export function clearAllStairs() {
  for (const id of [...stairMeshes.keys()]) {
    removeStair(id);
  }
}

/** Update stair visibility for floor switching (stairs visible on both connected floors) */
export function updateStairVisibility(currentFloor) {
  for (const [id, group] of stairMeshes) {
    const rec = stairRecords.get(id);
    if (!rec) continue;
    const visible = rec.fromFloor === currentFloor || rec.toFloor === currentFloor;
    group.visible = visible;
  }
}
