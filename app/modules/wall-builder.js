import * as THREE from 'three';
import { scene, camera, renderer } from './scene.js';
import { addWallFromRecord, removeWallById, wallMeshes, wallMeshMap, setIndividualWallColor, highlightWall, unhighlightWall, H, T } from './apartment.js';
import { putWall, deleteWall as dbDeleteWall } from './db.js';
import { createWallRecord } from './wall-data.js';
import { getCurrentFloor, getYBase, FLOOR_HEIGHT, ensureFloor } from './floor-manager.js';
import { pushAction } from './history.js';
import { snap, getFloorHit, getSmartHit } from './grid.js';

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

  // Use the build floor from the start point (captured at first click)
  const yBase = getYBase(startPt.buildFloor ?? getCurrentFloor());
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

  ghostMesh.userData.isGhost = true;
  scene.add(ghostMesh);
}

function clearGhost() {
  if (ghostMesh) {
    scene.remove(ghostMesh);
    ghostMesh.geometry.dispose();
    ghostMesh = null;
  }
}

// ── Wall endpoint snapping (Satisfactory-style, toggle with V) ──
let endpointSnap = false;
const SNAP_RADIUS = 0.5;

export function isEndpointSnap() { return endpointSnap; }
export function toggleEndpointSnap() {
  endpointSnap = !endpointSnap;
  return endpointSnap;
}

function snapToEndpoint(x, z) {
  if (!endpointSnap) return { x: snap(x), z: snap(z) };
  let bestDist = SNAP_RADIUS;
  let bestPt = null;

  for (const rec of wallRecords.values()) {
    let endpoints;
    if (rec.type === 'h') {
      endpoints = [
        { x: rec.x1, z: rec.z },
        { x: rec.x2, z: rec.z },
      ];
    } else {
      endpoints = [
        { x: rec.x, z: rec.z1 },
        { x: rec.x, z: rec.z2 },
      ];
    }
    for (const ep of endpoints) {
      const dx = x - ep.x;
      const dz = z - ep.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        bestPt = { x: ep.x, z: ep.z };
      }
    }
  }

  return bestPt || { x: snap(x), z: snap(z) };
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

  // Smart hit: detects wall tops, floor tiles, and ground
  const smartHit = getSmartHit(event);
  if (!smartHit) return false;

  // Snap to nearest wall endpoint first, fall back to grid
  const snapped = snapToEndpoint(smartHit.x, smartHit.z);

  if (!startPoint) {
    // First click — capture XZ + build floor from smart hit
    startPoint = { ...snapped, buildFloor: smartHit.buildFloor };
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

  // Use the floor from the first click (consistent wall level)
  const floor = startPoint.buildFloor;
  ensureFloor(floor);

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

  const smartHit = getSmartHit(event);
  if (!smartHit) return;

  const snapped = snapToEndpoint(smartHit.x, smartHit.z);
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

  // Get color from a wall mesh for junction matching
  function getWallColor(wallId) {
    const m = wallMeshMap.get(wallId);
    if (!m) return null;
    if (m.isMesh && m.material) return m.material.color;
    // Group — find first child mesh color
    let color = null;
    if (m.isGroup) m.traverse((c) => { if (!color && c.isMesh && c.material) color = c.material.color; });
    return color;
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

        // Skip if junction overlaps an opening in either wall
        let blocked = false;
        if (hw.openings) {
          for (const op of hw.openings) {
            const opAbsPos = hw.x1 + op.pos;
            if (vw.x >= opAbsPos - op.w / 2 - halfVT && vw.x <= opAbsPos + op.w / 2 + halfVT) {
              blocked = true; break;
            }
          }
        }
        if (!blocked && vw.openings) {
          for (const op of vw.openings) {
            const opAbsPos = vw.z1 + op.pos;
            if (hw.z >= opAbsPos - op.w / 2 - halfHT && hw.z <= opAbsPos + op.w / 2 + halfHT) {
              blocked = true; break;
            }
          }
        }
        if (blocked) continue;

        const floor = hw.floor || 0;
        const yBase = getYBase(floor);
        // Match junction color to the intersecting wall
        const color = getWallColor(hw.id) || getWallColor(vw.id) || new THREE.Color(0xEBE0D0);
        const mat = new THREE.MeshStandardMaterial({
          color: color.clone(),
          roughness: 0.92,
          metalness: 0.0,
        });
        const geo = new THREE.BoxGeometry(vwT, juncH, hwT);
        const mesh = new THREE.Mesh(geo, mat);
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

export { updateWallJunctions, ghostMatValid, ghostMatInvalid };

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
  const toCopy = [...wallRecords.values()].filter(r => (r.floor || 0) === sourceFloor);
  if (toCopy.length === 0) return 0;

  const newIds = [];
  const colorMap = []; // { newId, hex } pairs for color application
  for (const orig of toCopy) {
    const params = orig.type === 'h'
      ? { z: orig.z, x1: orig.x1, x2: orig.x2 }
      : { x: orig.x, z1: orig.z1, z2: orig.z2 };
    const rec = createWallRecord(orig.type, params, targetFloor);
    rec.heightFloors = orig.heightFloors || 1;
    rec.openings = orig.openings ? JSON.parse(JSON.stringify(orig.openings)) : [];
    wallRecords.set(rec.id, rec);
    addWallFromRecord(rec);
    // Copy color from source wall
    const srcMesh = wallMeshMap.get(orig.id);
    if (srcMesh) {
      const hex = '#' + (srcMesh.isMesh ? srcMesh.material.color : new THREE.Color(0xEBE0D0)).getHexString();
      colorMap.push({ newId: rec.id, hex });
    }
    putWall(rec);
    newIds.push(rec.id);
  }
  // Apply colors after all walls are created
  for (const { newId, hex } of colorMap) {
    setIndividualWallColor(newId, hex);
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
      for (const { newId, hex } of colorMap) {
        setIndividualWallColor(newId, hex);
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
