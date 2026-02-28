import * as THREE from 'three';
import { scene, camera, renderer } from './scene.js';
import { addWallFromRecord, removeWallById, wallMeshes, highlightWall, unhighlightWall, H, T } from './apartment.js';
import { putWall, deleteWall as dbDeleteWall } from './db.js';
import { createWallRecord } from './wall-data.js';
import { getCurrentFloor, getYBase, FLOOR_HEIGHT } from './floor-manager.js';
import { pushAction } from './history.js';
import { snap, getFloorHit } from './grid.js';

// ── State ──
let buildMode = false;
let startPoint = null;
let ghostMesh = null;
let selectedWallId = null;
let openingSubMode = null; // null | 'door' | 'window'

// In-memory wall records (source of truth, synced to DB)
export const wallRecords = new Map();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// ── Ghost preview materials (green = valid, red = invalid) ──
const ghostMatValid = new THREE.MeshStandardMaterial({
  color: 0x44cc44,
  transparent: true,
  opacity: 0.4,
});

const ghostMatInvalid = new THREE.MeshStandardMaterial({
  color: 0xcc4444,
  transparent: true,
  opacity: 0.4,
});

function isValidPlacement(startPt, endPt) {
  const dx = Math.abs(endPt.x - startPt.x);
  const dz = Math.abs(endPt.z - startPt.z);
  return Math.max(dx, dz) >= 0.25;
}

function updateGhost(startPt, endPt) {
  if (ghostMesh) {
    scene.remove(ghostMesh);
    ghostMesh.geometry.dispose();
    ghostMesh = null;
  }

  const dx = Math.abs(endPt.x - startPt.x);
  const dz = Math.abs(endPt.z - startPt.z);
  if (dx < 0.1 && dz < 0.1) return;

  const valid = isValidPlacement(startPt, endPt);
  const mat = valid ? ghostMatValid : ghostMatInvalid;

  const yBase = getYBase(getCurrentFloor());
  if (dx >= dz) {
    const x1 = Math.min(startPt.x, endPt.x);
    const x2 = Math.max(startPt.x, endPt.x);
    const w = x2 - x1;
    const geo = new THREE.BoxGeometry(w, H, T);
    ghostMesh = new THREE.Mesh(geo, mat);
    ghostMesh.position.set(x1 + w / 2, H / 2 + yBase, startPt.z);
  } else {
    const z1 = Math.min(startPt.z, endPt.z);
    const z2 = Math.max(startPt.z, endPt.z);
    const d = z2 - z1;
    const geo = new THREE.BoxGeometry(T, H, d);
    ghostMesh = new THREE.Mesh(geo, mat);
    ghostMesh.position.set(startPt.x, H / 2 + yBase, z1 + d / 2);
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

  const floor = getCurrentFloor();
  let rec;
  if (dx >= dz) {
    const x1 = Math.min(startPoint.x, snapped.x);
    const x2 = Math.max(startPoint.x, snapped.x);
    rec = createWallRecord('h', { z: startPoint.z, x1, x2 }, floor);
  } else {
    const z1 = Math.min(startPoint.z, snapped.z);
    const z2 = Math.max(startPoint.z, snapped.z);
    rec = createWallRecord('v', { x: startPoint.x, z1, z2 }, floor);
  }

  wallRecords.set(rec.id, rec);
  addWallFromRecord(rec);
  putWall(rec); // fire-and-forget
  updateWallJunctions();

  // History: undo removes the wall, redo re-adds it
  const savedRec = { ...rec };
  pushAction({
    label: 'Place wall',
    undo() {
      removeWallById(savedRec.id);
      wallRecords.delete(savedRec.id);
      dbDeleteWall(savedRec.id);
      updateWallJunctions();
    },
    redo() {
      wallRecords.set(savedRec.id, savedRec);
      addWallFromRecord(savedRec);
      putWall(savedRec);
      updateWallJunctions();
    },
  });

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

  // Handle opening placement click
  if (openingSubMode && selectedWallId) {
    return onOpeningClick(event);
  }

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  // Collect all raycastable wall children (handles both Mesh and Group)
  const targets = [];
  for (const obj of wallMeshes) {
    if (obj.isGroup) {
      obj.traverse((c) => { if (c.isMesh) targets.push(c); });
    } else if (obj.isMesh) {
      targets.push(obj);
    }
  }

  const hits = raycaster.intersectObjects(targets);
  if (hits.length > 0) {
    // Walk up to find wallId (may be on parent group)
    let obj = hits[0].object;
    let wallId = obj.userData.wallId;
    while (!wallId && obj.parent) {
      obj = obj.parent;
      wallId = obj.userData.wallId;
    }
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
  openingSubMode = null;
  highlightWall(id);
  updateWallSelectionBar();
}

function updateWallSelectionBar() {
  if (!selectedWallId) return;
  const bar = document.getElementById('selection-bar');
  const rec = wallRecords.get(selectedWallId);
  const label = rec ? (rec.isOriginal ? 'original' : 'custom') : 'wall';
  const hf = rec?.heightFloors || 1;
  const openingCount = rec?.openings?.length || 0;
  let text = `Wall (${label}) — [Del] delete  [Esc] deselect  Height: ${hf}F [H] extend`;
  text += `  [D] door  [W] window`;
  if (openingCount > 0) text += `  (${openingCount} opening${openingCount > 1 ? 's' : ''})`;
  if (openingSubMode) text += `  — placing ${openingSubMode}, click wall to place`;
  bar.textContent = text;
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
  const savedRec = wallRecords.get(id) ? { ...wallRecords.get(id) } : null;
  deselectWall();
  removeWallById(id);
  wallRecords.delete(id);
  dbDeleteWall(id); // fire-and-forget
  updateWallJunctions();

  if (savedRec) {
    pushAction({
      label: 'Delete wall',
      undo() {
        wallRecords.set(savedRec.id, savedRec);
        addWallFromRecord(savedRec);
        putWall(savedRec);
        updateWallJunctions();
      },
      redo() {
        removeWallById(savedRec.id);
        wallRecords.delete(savedRec.id);
        dbDeleteWall(savedRec.id);
        updateWallJunctions();
      },
    });
  }
  return true;
}

export function getSelectedWallId() { return selectedWallId; }

export function onWallKeyDown(key) {
  if (key === 'Escape') {
    if (openingSubMode) {
      openingSubMode = null;
      updateWallSelectionBar();
      return true;
    }
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

  // H — extend wall height (when wall selected)
  if ((key === 'h' || key === 'H') && selectedWallId && !buildMode) {
    extendWallHeight(selectedWallId);
    return true;
  }

  // D — enter door placement sub-mode
  if ((key === 'd' || key === 'D') && selectedWallId && !buildMode) {
    openingSubMode = 'door';
    updateWallSelectionBar();
    return true;
  }

  // W key is handled by ui.js for wall-build toggle, but when a wall is selected
  // and we're NOT in build mode, use it for window placement
  if ((key === 'w' || key === 'W') && selectedWallId && !buildMode) {
    openingSubMode = 'window';
    updateWallSelectionBar();
    return true;
  }

  return false;
}

export function isOpeningSubMode() { return openingSubMode; }

// ── Wall junction fillers ──

let junctionMeshes = [];

function updateWallJunctions() {
  // Clear existing
  for (const m of junctionMeshes) {
    scene.remove(m);
    m.geometry.dispose();
  }
  junctionMeshes = [];

  const recs = [...wallRecords.values()];
  const hWalls = recs.filter(r => r.type === 'h');
  const vWalls = recs.filter(r => r.type === 'v');

  // Get wall material from an existing wall mesh
  let juncMat = null;
  for (const obj of wallMeshes) {
    if (obj.isMesh && obj.material) {
      juncMat = obj.material;
      break;
    }
    if (obj.isGroup) {
      obj.traverse((c) => {
        if (!juncMat && c.isMesh && c.material) juncMat = c.material;
      });
      if (juncMat) break;
    }
  }
  if (!juncMat) {
    juncMat = new THREE.MeshStandardMaterial({ color: 0xEBE0D0, roughness: 0.92 });
  }

  for (const hw of hWalls) {
    for (const vw of vWalls) {
      if ((hw.floor || 0) !== (vw.floor || 0)) continue;

      const hwT = hw.T || T;
      const vwT = vw.T || T;
      const hwH = (hw.H || H) * (hw.heightFloors || 1);
      const vwH = (vw.H || H) * (vw.heightFloors || 1);
      const juncH = Math.min(hwH, vwH);

      // Check intersection: v-wall x within h-wall x range, h-wall z within v-wall z range
      const halfHT = hwT / 2;
      const halfVT = vwT / 2;

      if (vw.x >= hw.x1 - halfVT && vw.x <= hw.x2 + halfVT &&
          hw.z >= vw.z1 - halfHT && hw.z <= vw.z2 + halfHT) {
        const floor = hw.floor || 0;
        const yBase = getYBase(floor);
        const geo = new THREE.BoxGeometry(vwT, juncH, hwT);
        const mesh = new THREE.Mesh(geo, juncMat);
        mesh.position.set(vw.x, juncH / 2 + yBase, hw.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isJunction = true;
        mesh.userData.floor = floor;
        scene.add(mesh);
        junctionMeshes.push(mesh);
      }
    }
  }
}

export { updateWallJunctions };

// ── Multi-floor wall height ──

function extendWallHeight(wallId) {
  const rec = wallRecords.get(wallId);
  if (!rec) return;

  const oldH = rec.heightFloors || 1;
  const newH = oldH + 1;
  rec.heightFloors = newH;

  // Remove and re-add mesh with new height
  removeWallById(wallId);
  addWallFromRecord(rec);
  putWall(rec);
  updateWallJunctions();

  // Re-select to update highlight + bar
  highlightWall(wallId);
  updateWallSelectionBar();

  pushAction({
    label: 'Extend wall height',
    undo() {
      rec.heightFloors = oldH;
      removeWallById(wallId);
      addWallFromRecord(rec);
      putWall(rec);
      updateWallJunctions();
      if (selectedWallId === wallId) {
        highlightWall(wallId);
        updateWallSelectionBar();
      }
    },
    redo() {
      rec.heightFloors = newH;
      removeWallById(wallId);
      addWallFromRecord(rec);
      putWall(rec);
      updateWallJunctions();
      if (selectedWallId === wallId) {
        highlightWall(wallId);
        updateWallSelectionBar();
      }
    },
  });
}

// ── Copy floor layout up ──

export function copyFloorLayoutUp(sourceFloor) {
  const targetFloor = sourceFloor + 1;
  const toCopy = [...wallRecords.values()].filter(r => (r.floor || 0) === sourceFloor && !r.isOriginal);
  if (toCopy.length === 0) return 0;

  const newIds = [];
  for (const orig of toCopy) {
    const params = orig.type === 'h'
      ? { z: orig.z, x1: orig.x1, x2: orig.x2 }
      : { x: orig.x, z1: orig.z1, z2: orig.z2 };
    const rec = createWallRecord(orig.type, params, targetFloor);
    rec.heightFloors = orig.heightFloors || 1;
    rec.openings = orig.openings ? JSON.parse(JSON.stringify(orig.openings)) : [];
    wallRecords.set(rec.id, rec);
    addWallFromRecord(rec);
    putWall(rec);
    newIds.push(rec.id);
  }

  updateWallJunctions();

  pushAction({
    label: `Copy ${newIds.length} walls to floor ${targetFloor}`,
    undo() {
      for (const id of newIds) {
        removeWallById(id);
        wallRecords.delete(id);
        dbDeleteWall(id);
      }
      updateWallJunctions();
    },
    redo() {
      for (const orig of toCopy) {
        const params = orig.type === 'h'
          ? { z: orig.z, x1: orig.x1, x2: orig.x2 }
          : { x: orig.x, z1: orig.z1, z2: orig.z2 };
        const rec = { ...createWallRecord(orig.type, params, targetFloor) };
        rec.heightFloors = orig.heightFloors || 1;
        rec.openings = orig.openings ? JSON.parse(JSON.stringify(orig.openings)) : [];
        wallRecords.set(rec.id, rec);
        addWallFromRecord(rec);
        putWall(rec);
      }
      updateWallJunctions();
    },
  });

  return newIds.length;
}

// ── Opening placement (door/window click on selected wall) ──

export function onOpeningClick(event) {
  if (!openingSubMode || !selectedWallId) return false;

  const rec = wallRecords.get(selectedWallId);
  if (!rec) return false;

  const pt = getFloorHit(event);
  if (!pt) return false;

  // Calculate position along wall axis
  let pos;
  if (rec.type === 'h') {
    pos = snap(pt.x) - rec.x1;
  } else {
    pos = snap(pt.z) - rec.z1;
  }

  // Clamp to wall length
  const wallLen = rec.type === 'h' ? (rec.x2 - rec.x1) : (rec.z2 - rec.z1);
  if (pos < 0.1 || pos > wallLen - 0.1) return false;

  let opening;
  if (openingSubMode === 'door') {
    opening = { type: 'door', pos, w: 0.9, h: 2.1, sillH: 0 };
  } else {
    opening = { type: 'window', pos, w: 1.2, h: 1.2, sillH: 0.9 };
  }

  if (!rec.openings) rec.openings = [];
  rec.openings.push(opening);

  // Rebuild wall mesh with openings
  removeWallById(selectedWallId);
  addWallFromRecord(rec);
  putWall(rec);
  updateWallJunctions();

  highlightWall(selectedWallId);
  openingSubMode = null;
  updateWallSelectionBar();

  const savedId = selectedWallId;
  const openingIdx = rec.openings.length - 1;
  const savedOpening = { ...opening };

  pushAction({
    label: `Add ${savedOpening.type}`,
    undo() {
      const r = wallRecords.get(savedId);
      if (r && r.openings) {
        r.openings.splice(openingIdx, 1);
        removeWallById(savedId);
        addWallFromRecord(r);
        putWall(r);
        updateWallJunctions();
      }
    },
    redo() {
      const r = wallRecords.get(savedId);
      if (r) {
        if (!r.openings) r.openings = [];
        r.openings.push({ ...savedOpening });
        removeWallById(savedId);
        addWallFromRecord(r);
        putWall(r);
        updateWallJunctions();
      }
    },
  });

  return true;
}

// ── Bulk load (called during init) ──
export function loadWallRecords(records) {
  wallRecords.clear();
  for (const rec of records) {
    wallRecords.set(rec.id, rec);
    addWallFromRecord(rec);
  }
  updateWallJunctions();
}

// ── Clear all walls from scene ──
export function clearAllWalls() {
  for (const id of [...wallRecords.keys()]) {
    removeWallById(id);
  }
  wallRecords.clear();
  // Clear junctions too
  for (const m of junctionMeshes) {
    scene.remove(m);
    m.geometry.dispose();
  }
  junctionMeshes = [];
}
