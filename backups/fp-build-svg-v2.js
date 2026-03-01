// ── First-Person Build Mode ──
// Crosshair-guided ghost preview + placement from walk mode.
// Raycasts from screen center (NDC 0,0) every frame since pointer lock
// consumes clientX/clientY.

import * as THREE from 'three';
import { scene, camera, renderer } from './scene.js';
import { viewMode, isPointerLocked } from './controls.js';
import { getCurrentFloor, getYBase, FLOOR_HEIGHT } from './floor-manager.js';
import { CATALOG, createMesh, placeItem, removeItem, placed, SCENE_XZ_SCALE, generateThumbnail, thumbnails } from './furniture.js';
import { wallRecords, ghostMatValid, ghostMatInvalid } from './wall-builder.js';
import { addWallFromRecord, removeWallById, H, T, wallMeshes, wallMeshMap } from './apartment.js';
import { createWallRecord } from './wall-data.js';
import { putWall, deleteWall as dbDeleteWall, deleteFloorTile as dbDeleteTile, deleteStair as dbDeleteStair } from './db.js';
import { updateWallJunctions } from './wall-builder.js';
import { pushAction } from './history.js';
import { autoSave } from './persistence.js';
import { snap } from './grid.js';
import { snapToWalls, snapToFurnitureTop } from './gizmo.js';
import { removeFloorTile, addFloorTile, floorTileMeshes, floorTileRecords } from './floor-builder.js';
import { removeStair, addStair, stairMeshes, stairRecords } from './stair-builder.js';
import { putFloorTile, putStair } from './db.js';
import { toast } from './ui.js';

// ── State ──
let fpTool = null; // null | 'furniture' | 'wall' | 'floor' | 'stair' | 'eraser'
let fpGhost = null; // current ghost mesh/group
let fpFurnitureId = null;
let fpWallStart = null; // first-click snap point for wall placement
let fpFloorStart = null; // first-click snap point for floor placement
let fpRotation = 0;

// Hotbar: 9 recently used items
const hotbar = new Array(9).fill(null); // { tool, id, thumb }

// Raycaster for screen-center hits
const _ray = new THREE.Raycaster();
const _center = new THREE.Vector2(0, 0);
const MAX_PLACE_DIST = 15;
const GRID_SNAP = 0.25;
const FLOOR_SNAP = 1.0; // 1m grid for floor tiles

// ── Hand animation state ──
let _handState = 'hidden'; // hidden | entering | idle | placing | switching | erasing | rotating | exiting
let _handTimer = null;

function setHandState(state, duration) {
  const hand = document.getElementById('fp-hand');
  if (!hand) return;

  // Clear any pending state transition
  if (_handTimer) { clearTimeout(_handTimer); _handTimer = null; }

  _handState = state;
  hand.dataset.state = state;

  // After timed animations, return to idle
  if (duration && state !== 'hidden' && state !== 'exiting') {
    _handTimer = setTimeout(() => {
      if (_handState === state) {
        _handState = 'idle';
        hand.dataset.state = 'idle';
      }
    }, duration);
  }
}

function setHandTool(tool) {
  const hand = document.getElementById('fp-hand');
  if (hand) hand.dataset.tool = tool || '';
}

function triggerParticleBurst() {
  const hand = document.getElementById('fp-hand');
  if (!hand) return;
  hand.classList.remove('burst');
  void hand.offsetWidth; // force reflow
  hand.classList.add('burst');
  setTimeout(() => hand.classList.remove('burst'), 650);
}

function showHand(tool) {
  setHandTool(tool);
  setHandState('entering', 700);
}

function hideHand() {
  setHandState('exiting', 500);
  _handTimer = setTimeout(() => {
    setHandState('hidden');
  }, 500);
}

function switchHandTool(tool) {
  setHandTool(tool);
  setHandState('switching', 650);
}

// ── Tool label map ──
const TOOL_LABELS = {
  furniture: 'Furniture',
  wall: 'Wall',
  floor: 'Floor',
  stair: 'Stair',
  eraser: 'Eraser',
};

const TOOL_HINTS = {
  furniture: 'Tab to browse \u2022 Click to place',
  wall: 'Click start \u2022 Click end',
  floor: 'Click corner \u2022 Click opposite',
  stair: 'Click to place \u2022 Scroll to rotate',
  eraser: 'Aim \u2022 Click to delete',
};

// SVG hand/tool icons — inline for animated transitions
const TOOL_SVGS = {
  furniture: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 26V14l4-4h8l4 4v12H8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M12 26v-6h8v6" stroke="currentColor" stroke-width="1.5"/>
    <path d="M8 18h16" stroke="currentColor" stroke-width="1" opacity="0.4"/>
    <circle cx="12" cy="14" r="1" fill="currentColor" opacity="0.6"/>
    <circle cx="20" cy="14" r="1" fill="currentColor" opacity="0.6"/>
  </svg>`,
  wall: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="8" width="24" height="16" rx="1" stroke="currentColor" stroke-width="1.5"/>
    <line x1="16" y1="8" x2="16" y2="24" stroke="currentColor" stroke-width="1" opacity="0.5"/>
    <line x1="4" y1="16" x2="28" y2="16" stroke="currentColor" stroke-width="1" opacity="0.5"/>
    <rect x="7" y="11" width="6" height="5" rx="0.5" stroke="currentColor" stroke-width="0.8" opacity="0.4"/>
    <rect x="19" y="11" width="6" height="5" rx="0.5" stroke="currentColor" stroke-width="0.8" opacity="0.4"/>
    <rect x="7" y="19" width="6" height="3" rx="0.5" stroke="currentColor" stroke-width="0.8" opacity="0.4"/>
    <rect x="19" y="19" width="6" height="3" rx="0.5" stroke="currentColor" stroke-width="0.8" opacity="0.4"/>
  </svg>`,
  floor: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12l12-6 12 6v12l-12 6-12-6V12z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M16 6v24" stroke="currentColor" stroke-width="0.8" opacity="0.3"/>
    <path d="M4 12l12 6 12-6" stroke="currentColor" stroke-width="1" opacity="0.5"/>
    <path d="M10 9l12 6" stroke="currentColor" stroke-width="0.6" opacity="0.2"/>
    <path d="M22 9l-12 6" stroke="currentColor" stroke-width="0.6" opacity="0.2"/>
  </svg>`,
  stair: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 26h4v-5h4v-5h4v-5h4v-5h4" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M6 26h20" stroke="currentColor" stroke-width="0.8" opacity="0.3" stroke-dasharray="2 2"/>
    <path d="M26 6v20" stroke="currentColor" stroke-width="0.8" opacity="0.3" stroke-dasharray="2 2"/>
  </svg>`,
  eraser: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 7l6 6-14 14H7l-2-2 16-18z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M17 11l6 6" stroke="currentColor" stroke-width="1" opacity="0.5"/>
    <line x1="5" y1="27" x2="20" y2="27" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
};

const TOOL_EMOJI = {
  furniture: '\u{1F4E6}',
  wall: '\u{1F9F1}',
  floor: '\u{1FA9F}',
  stair: '\u{1FA9C}',
  eraser: '\u{1F5D1}',
};

// ── Core frame update ──
export function updateFPBuild(dt) {
  if (viewMode !== 'walk' || fpTool === null) {
    if (fpGhost) { fpGhost.visible = false; }
    return;
  }

  if (!isPointerLocked()) {
    if (fpGhost) fpGhost.visible = false;
    return;
  }

  // Raycast from screen center
  _ray.setFromCamera(_center, camera);
  const floor = getCurrentFloor();
  const yBase = getYBase(floor);

  if (fpTool === 'eraser') {
    updateEraserHighlight();
    return;
  }

  if (fpTool === 'furniture') {
    updateFurnitureGhost(yBase, floor);
  } else if (fpTool === 'wall') {
    updateWallGhost(yBase, floor);
  } else if (fpTool === 'floor') {
    updateFloorGhost(yBase, floor);
  } else if (fpTool === 'stair') {
    updateStairGhost(yBase, floor);
  }
}

// ── Furniture ghost ──
function updateFurnitureGhost(yBase, floor) {
  if (!fpFurnitureId || !fpGhost) return;

  const hit = getFloorPlaneHit(yBase);
  if (!hit) { fpGhost.visible = false; return; }

  // Snap to grid
  const x = Math.round(hit.x / GRID_SNAP) * GRID_SNAP;
  const z = Math.round(hit.z / GRID_SNAP) * GRID_SNAP;

  fpGhost.position.set(x, yBase, z);
  fpGhost.rotation.y = fpRotation;
  fpGhost.visible = true;

  // Wall snap
  fpGhost.userData.floor = floor;
  const item = CATALOG.find(c => c.id === fpFurnitureId);
  if (item) fpGhost.userData.item = item;
  snapToWalls(fpGhost);
  snapToFurnitureTop(fpGhost);

  updateMeasurements(`${fpGhost.position.x.toFixed(1)}, ${fpGhost.position.z.toFixed(1)}`);
}

// ── Wall ghost ──
function updateWallGhost(yBase, floor) {
  if (!fpWallStart) {
    // Before first click — show a small indicator at hit point
    const hit = getFloorPlaneHit(yBase);
    if (!hit) {
      if (fpGhost) fpGhost.visible = false;
      updateMeasurements('Click to set wall start');
      return;
    }
    const x = snap(hit.x);
    const z = snap(hit.z);
    ensureWallGhost(T * 2, H, T * 2, ghostMatValid);
    fpGhost.position.set(x, H / 2 + yBase, z);
    fpGhost.visible = true;
    updateMeasurements(`Start: ${x.toFixed(1)}, ${z.toFixed(1)}`);
    return;
  }

  // After first click — show wall preview from start to current
  const hit = getFloorPlaneHit(yBase);
  if (!hit) {
    if (fpGhost) fpGhost.visible = false;
    return;
  }

  const endX = snap(hit.x);
  const endZ = snap(hit.z);
  const dx = Math.abs(endX - fpWallStart.x);
  const dz = Math.abs(endZ - fpWallStart.z);

  if (dx < 0.1 && dz < 0.1) {
    if (fpGhost) fpGhost.visible = false;
    updateMeasurements('Move to set wall end');
    return;
  }

  const valid = Math.max(dx, dz) >= 0.25;
  const mat = valid ? ghostMatValid : ghostMatInvalid;

  if (dx >= dz) {
    const x1 = Math.min(fpWallStart.x, endX);
    const x2 = Math.max(fpWallStart.x, endX);
    const w = x2 - x1;
    ensureWallGhost(w, H, T, mat);
    fpGhost.position.set(x1 + w / 2, H / 2 + yBase, fpWallStart.z);
    updateMeasurements(`Wall: ${w.toFixed(1)}m`);
  } else {
    const z1 = Math.min(fpWallStart.z, endZ);
    const z2 = Math.max(fpWallStart.z, endZ);
    const d = z2 - z1;
    ensureWallGhost(T, H, d, mat);
    fpGhost.position.set(fpWallStart.x, H / 2 + yBase, z1 + d / 2);
    updateMeasurements(`Wall: ${d.toFixed(1)}m`);
  }
  fpGhost.visible = true;
}

function ensureWallGhost(w, h, d, mat) {
  if (fpGhost) {
    scene.remove(fpGhost);
    if (fpGhost.geometry) fpGhost.geometry.dispose();
  }
  const geo = new THREE.BoxGeometry(w, h, d);
  fpGhost = new THREE.Mesh(geo, mat);
  fpGhost.renderOrder = 999;
  scene.add(fpGhost);
}

// ── Floor ghost ──
function updateFloorGhost(yBase, floor) {
  if (!fpFloorStart) {
    const hit = getFloorPlaneHit(yBase);
    if (!hit) {
      if (fpGhost) fpGhost.visible = false;
      updateMeasurements('Click to set floor corner');
      return;
    }
    const x = Math.round(hit.x / FLOOR_SNAP) * FLOOR_SNAP;
    const z = Math.round(hit.z / FLOOR_SNAP) * FLOOR_SNAP;
    ensureFloorGhost(1, 1);
    fpGhost.position.set(x, yBase + 0.01, z);
    fpGhost.visible = true;
    updateMeasurements(`Corner: ${x.toFixed(1)}, ${z.toFixed(1)}`);
    return;
  }

  const hit = getFloorPlaneHit(yBase);
  if (!hit) {
    if (fpGhost) fpGhost.visible = false;
    return;
  }

  const endX = Math.round(hit.x / FLOOR_SNAP) * FLOOR_SNAP;
  const endZ = Math.round(hit.z / FLOOR_SNAP) * FLOOR_SNAP;
  const w = Math.abs(endX - fpFloorStart.x);
  const d = Math.abs(endZ - fpFloorStart.z);

  if (w < 0.5 && d < 0.5) {
    if (fpGhost) fpGhost.visible = false;
    updateMeasurements('Move to set floor size');
    return;
  }

  const cx = (fpFloorStart.x + endX) / 2;
  const cz = (fpFloorStart.z + endZ) / 2;
  ensureFloorGhost(Math.max(w, 0.5), Math.max(d, 0.5));
  fpGhost.position.set(cx, yBase + 0.01, cz);
  fpGhost.visible = true;
  updateMeasurements(`Floor: ${w.toFixed(1)} x ${d.toFixed(1)}m`);
}

function ensureFloorGhost(w, d) {
  if (fpGhost) {
    scene.remove(fpGhost);
    if (fpGhost.geometry) fpGhost.geometry.dispose();
  }
  const geo = new THREE.PlaneGeometry(w, d);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc8a96e,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });
  fpGhost = new THREE.Mesh(geo, mat);
  fpGhost.rotation.x = -Math.PI / 2;
  fpGhost.renderOrder = 999;
  scene.add(fpGhost);
}

// ── Stair ghost ──
function updateStairGhost(yBase, floor) {
  const hit = getFloorPlaneHit(yBase);
  if (!hit) {
    if (fpGhost) fpGhost.visible = false;
    updateMeasurements('Aim at floor to place stair');
    return;
  }

  const x = Math.round(hit.x / FLOOR_SNAP) * FLOOR_SNAP;
  const z = Math.round(hit.z / FLOOR_SNAP) * FLOOR_SNAP;

  if (!fpGhost) {
    // Create a simple stair preview box
    const geo = new THREE.BoxGeometry(1.0, FLOOR_HEIGHT, 3.0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xc8a96e,
      transparent: true,
      opacity: 0.35,
    });
    fpGhost = new THREE.Mesh(geo, mat);
    fpGhost.renderOrder = 999;
    scene.add(fpGhost);
  }

  fpGhost.position.set(x, yBase + FLOOR_HEIGHT / 2, z);
  fpGhost.rotation.y = fpRotation;
  fpGhost.visible = true;
  updateMeasurements(`Stair at ${x.toFixed(1)}, ${z.toFixed(1)}`);
}

// ── Eraser highlight ──
let _eraserHighlightObj = null;
let _eraserOrigMats = null;

function updateEraserHighlight() {
  // Raycast from center against all scene objects
  _ray.setFromCamera(_center, camera);

  const candidates = [];
  for (const mesh of [...wallMeshMap.values()]) {
    if (mesh.isGroup) {
      mesh.traverse((c) => { if (c.isMesh) candidates.push(c); });
    } else if (mesh.isMesh) {
      candidates.push(mesh);
    }
  }
  for (const g of placed) {
    g.traverse((c) => { if (c.isMesh) candidates.push(c); });
  }
  for (const mesh of floorTileMeshes.values()) {
    candidates.push(mesh);
  }
  for (const group of stairMeshes.values()) {
    group.traverse((c) => { if (c.isMesh) candidates.push(c); });
  }

  const hits = _ray.intersectObjects(candidates);

  // Find root object
  let hitRoot = null;
  if (hits.length > 0 && hits[0].distance < MAX_PLACE_DIST) {
    let obj = hits[0].object;
    while (obj.parent && !obj.userData.wallId && !obj.userData.furnitureId && !obj.userData.tileId && !obj.userData.stairId) {
      obj = obj.parent;
    }
    if (obj.userData.wallId || obj.userData.furnitureId || obj.userData.tileId || obj.userData.stairId) {
      hitRoot = obj;
    }
  }

  // Restore previous highlight
  if (_eraserHighlightObj && _eraserHighlightObj !== hitRoot) {
    if (_eraserOrigMats) {
      let i = 0;
      _eraserHighlightObj.traverse((c) => {
        if (c.isMesh && _eraserOrigMats[i] !== undefined) {
          c.material = _eraserOrigMats[i];
          i++;
        }
      });
    }
    _eraserHighlightObj = null;
    _eraserOrigMats = null;
  }

  // Apply red highlight
  if (hitRoot && hitRoot !== _eraserHighlightObj) {
    _eraserOrigMats = [];
    hitRoot.traverse((c) => {
      if (c.isMesh) {
        _eraserOrigMats.push(c.material);
        c.material = ghostMatInvalid;
      }
    });
    _eraserHighlightObj = hitRoot;
    updateMeasurements('Click to delete');
  } else if (!hitRoot) {
    updateMeasurements('Aim at object to erase');
  }
}

function clearEraserHighlight() {
  if (_eraserHighlightObj && _eraserOrigMats) {
    let i = 0;
    _eraserHighlightObj.traverse((c) => {
      if (c.isMesh && _eraserOrigMats[i] !== undefined) {
        c.material = _eraserOrigMats[i];
        i++;
      }
    });
  }
  _eraserHighlightObj = null;
  _eraserOrigMats = null;
}

// ── Floor plane hit (from center ray) ──
function getFloorPlaneHit(yBase) {
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -yBase);
  const pt = new THREE.Vector3();
  const hit = _ray.ray.intersectPlane(plane, pt);
  if (!hit) return null;
  // Clamp distance
  if (camera.position.distanceTo(pt) > MAX_PLACE_DIST) return null;
  return pt;
}

// ── Click handler ──
export function onFPClick() {
  if (!fpTool || !isPointerLocked()) return;

  const floor = getCurrentFloor();
  const yBase = getYBase(floor);
  _ray.setFromCamera(_center, camera);

  if (fpTool === 'eraser') {
    performErase();
    return;
  }

  if (fpTool === 'furniture') {
    placeFPFurniture(yBase, floor);
    return;
  }

  if (fpTool === 'wall') {
    placeFPWall(yBase, floor);
    return;
  }

  if (fpTool === 'floor') {
    placeFPFloor(yBase, floor);
    return;
  }

  if (fpTool === 'stair') {
    placeFPStair(yBase, floor);
    return;
  }
}

function placeFPFurniture(yBase, floor) {
  if (!fpFurnitureId || !fpGhost) return;
  const hit = getFloorPlaneHit(yBase);
  if (!hit) return;

  const x = fpGhost.position.x;
  const z = fpGhost.position.z;
  const rot = fpRotation;

  const mesh = placeItem(fpFurnitureId, x, z, rot, floor);
  if (mesh) {
    const savedId = fpFurnitureId;
    const savedX = x, savedZ = z, savedRot = rot, savedFloor = floor;
    pushAction({
      label: `Place ${savedId}`,
      undo() { removeItem(mesh); },
      redo() { placeItem(savedId, savedX, savedZ, savedRot, savedFloor); },
    });
    autoSave();
    toast(`Placed ${savedId}`);
    // Hand placement animation
    setHandState('placing', 500);
    triggerParticleBurst();
  }
}

function placeFPWall(yBase, floor) {
  const hit = getFloorPlaneHit(yBase);
  if (!hit) return;

  const x = snap(hit.x);
  const z = snap(hit.z);

  if (!fpWallStart) {
    fpWallStart = { x, z };
    toast('Wall start set');
    return;
  }

  // Second click — place wall
  const dx = Math.abs(x - fpWallStart.x);
  const dz = Math.abs(z - fpWallStart.z);

  if (dx < 0.1 && dz < 0.1) {
    fpWallStart = null;
    clearFPGhost();
    return;
  }

  if (Math.max(dx, dz) < 0.25) {
    toast('Wall too short');
    return;
  }

  let rec;
  if (dx >= dz) {
    const x1 = Math.min(fpWallStart.x, x);
    const x2 = Math.max(fpWallStart.x, x);
    rec = createWallRecord('h', { z: fpWallStart.z, x1, x2 }, floor);
  } else {
    const z1 = Math.min(fpWallStart.z, z);
    const z2 = Math.max(fpWallStart.z, z);
    rec = createWallRecord('v', { x: fpWallStart.x, z1, z2 }, floor);
  }

  wallRecords.set(rec.id, rec);
  addWallFromRecord(rec);
  putWall(rec);
  updateWallJunctions();

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

  fpWallStart = null;
  clearFPGhost();
  autoSave();
  toast('Wall placed');
  // Hand placement animation
  setHandState('placing', 500);
  triggerParticleBurst();
}

function placeFPFloor(yBase, floor) {
  const hit = getFloorPlaneHit(yBase);
  if (!hit) return;

  const x = Math.round(hit.x / FLOOR_SNAP) * FLOOR_SNAP;
  const z = Math.round(hit.z / FLOOR_SNAP) * FLOOR_SNAP;

  if (!fpFloorStart) {
    fpFloorStart = { x, z };
    toast('Floor corner set');
    return;
  }

  // Second click — place floor tile
  const x1 = Math.min(fpFloorStart.x, x);
  const x2 = Math.max(fpFloorStart.x, x);
  const z1 = Math.min(fpFloorStart.z, z);
  const z2 = Math.max(fpFloorStart.z, z);
  const w = x2 - x1;
  const d = z2 - z1;

  if (w < 0.5 && d < 0.5) {
    fpFloorStart = null;
    clearFPGhost();
    return;
  }

  const rec = {
    id: 'ft-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    x1, x2, z1, z2,
    floor,
    texture: 'concrete',
  };

  floorTileRecords.set(rec.id, rec);
  addFloorTile(rec);
  putFloorTile(rec);

  const savedRec = { ...rec };
  pushAction({
    label: 'Place floor',
    undo() {
      removeFloorTile(savedRec.id);
      dbDeleteTile(savedRec.id);
    },
    redo() {
      floorTileRecords.set(savedRec.id, savedRec);
      addFloorTile(savedRec);
      putFloorTile(savedRec);
    },
  });

  fpFloorStart = null;
  clearFPGhost();
  autoSave();
  toast('Floor placed');
  // Hand placement animation
  setHandState('placing', 500);
  triggerParticleBurst();
}

function placeFPStair(yBase, floor) {
  const hit = getFloorPlaneHit(yBase);
  if (!hit) return;

  const x = Math.round(hit.x / FLOOR_SNAP) * FLOOR_SNAP;
  const z = Math.round(hit.z / FLOOR_SNAP) * FLOOR_SNAP;

  // Determine direction from rotation
  let dir;
  const normRot = ((fpRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (normRot < Math.PI * 0.25 || normRot >= Math.PI * 1.75) dir = 'north';
  else if (normRot < Math.PI * 0.75) dir = 'west';
  else if (normRot < Math.PI * 1.25) dir = 'south';
  else dir = 'east';

  const rec = {
    id: 'st-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    x, z,
    fromFloor: floor,
    direction: dir,
    width: 1.0,
    length: 3.0,
  };

  stairRecords.set(rec.id, rec);
  addStair(rec);
  putStair(rec);

  const savedRec = { ...rec };
  pushAction({
    label: 'Place stairs',
    undo() {
      removeStair(savedRec.id);
      dbDeleteStair(savedRec.id);
    },
    redo() {
      stairRecords.set(savedRec.id, savedRec);
      addStair(savedRec);
      putStair(savedRec);
    },
  });

  clearFPGhost();
  autoSave();
  toast('Stairs placed');
  // Hand placement animation
  setHandState('placing', 500);
  triggerParticleBurst();
}

function performErase() {
  if (!_eraserHighlightObj) return;

  // Hand erase animation
  setHandState('erasing', 450);

  const obj = _eraserHighlightObj;
  clearEraserHighlight();

  if (obj.userData.wallId) {
    const id = obj.userData.wallId;
    const savedRec = wallRecords.get(id) ? { ...wallRecords.get(id) } : null;
    removeWallById(id);
    wallRecords.delete(id);
    dbDeleteWall(id);
    updateWallJunctions();
    if (savedRec) {
      pushAction({
        label: 'Erase wall',
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
    autoSave();
    toast('Erased wall');
  } else if (obj.userData.furnitureId) {
    const savedId = obj.userData.furnitureId;
    const savedX = obj.position.x;
    const savedZ = obj.position.z;
    const savedRotY = obj.rotation.y;
    const savedFloor = obj.userData.floor || 0;
    removeItem(obj);
    pushAction({
      label: 'Erase furniture',
      undo() { placeItem(savedId, savedX, savedZ, savedRotY, savedFloor); },
      redo() {
        const found = placed.find(p => p.userData.furnitureId === savedId &&
          Math.abs(p.position.x - savedX) < 0.01 && Math.abs(p.position.z - savedZ) < 0.01);
        if (found) removeItem(found);
      },
    });
    autoSave();
    toast('Erased furniture');
  } else if (obj.userData.tileId) {
    const id = obj.userData.tileId;
    const savedRec = floorTileRecords.get(id) ? { ...floorTileRecords.get(id) } : null;
    removeFloorTile(id);
    dbDeleteTile(id);
    if (savedRec) {
      pushAction({
        label: 'Erase floor tile',
        undo() { addFloorTile(savedRec); putFloorTile(savedRec); },
        redo() { removeFloorTile(savedRec.id); dbDeleteTile(savedRec.id); },
      });
    }
    autoSave();
    toast('Erased floor tile');
  } else if (obj.userData.stairId) {
    const id = obj.userData.stairId;
    const savedRec = stairRecords.get(id) ? { ...stairRecords.get(id) } : null;
    removeStair(id);
    dbDeleteStair(id);
    if (savedRec) {
      pushAction({
        label: 'Erase stairs',
        undo() { addStair(savedRec); putStair(savedRec); },
        redo() { removeStair(savedRec.id); dbDeleteStair(savedRec.id); },
      });
    }
    autoSave();
    toast('Erased stairs');
  }
}

// ── Right-click handler ──
export function onFPRightClick() {
  if (fpWallStart) {
    fpWallStart = null;
    clearFPGhost();
    toast('Wall cancelled');
    return;
  }
  if (fpFloorStart) {
    fpFloorStart = null;
    clearFPGhost();
    toast('Floor cancelled');
    return;
  }
  if (fpTool) {
    setFPTool(null);
    toast('Tool deactivated');
  }
}

// ── Ghost management ──
function clearFPGhost() {
  if (fpGhost) {
    scene.remove(fpGhost);
    if (fpGhost.geometry) fpGhost.geometry.dispose();
    fpGhost = null;
  }
}

function createFurnitureGhost(id) {
  clearFPGhost();
  fpGhost = createMesh(id, true);
  if (fpGhost) {
    fpGhost.visible = false;
    fpGhost.renderOrder = 999;
    scene.add(fpGhost);
  }
}

// ── Tool management ──
export function setFPTool(tool) {
  const prev = fpTool;
  fpTool = tool;
  fpWallStart = null;
  fpFloorStart = null;

  if (prev === 'eraser') clearEraserHighlight();

  if (tool !== 'furniture') {
    clearFPGhost();
  }

  updateHUD();

  // Update crosshair glow
  const ch = document.getElementById('crosshair');
  if (ch) ch.classList.toggle('fp-active', tool !== null);

  // ── Hand animation ──
  if (tool === null && prev !== null) {
    hideHand();
  } else if (tool !== null && prev === null) {
    showHand(tool);
  } else if (tool !== null && prev !== null && tool !== prev) {
    switchHandTool(tool);
  }
}

export function getFPTool() { return fpTool; }

export function setFPFurniture(id) {
  fpFurnitureId = id;
  if (fpTool === 'furniture') {
    createFurnitureGhost(id);
  }
}

export function rotateFPPreview(delta) {
  fpRotation += delta;
  // Trigger hand rotate animation if not already in a more important state
  if (_handState === 'idle') {
    setHandState('rotating', 350);
  }
}

// ── Tool cycling ──
const TOOL_CYCLE = ['furniture', 'wall', 'floor', 'stair'];

export function cycleFPTool() {
  if (!fpTool) {
    setFPTool('furniture');
    if (fpFurnitureId) createFurnitureGhost(fpFurnitureId);
    toast('Build: Furniture');
    return;
  }
  const idx = TOOL_CYCLE.indexOf(fpTool);
  if (idx === TOOL_CYCLE.length - 1) {
    // Turn off
    setFPTool(null);
    toast('Build OFF');
    return;
  }
  const next = TOOL_CYCLE[(idx + 1) % TOOL_CYCLE.length];
  setFPTool(next);
  if (next === 'furniture' && fpFurnitureId) createFurnitureGhost(fpFurnitureId);
  toast(`Build: ${TOOL_LABELS[next]}`);
}

export function toggleFPEraser() {
  if (fpTool === 'eraser') {
    setFPTool(null);
    toast('Eraser OFF');
  } else {
    setFPTool('eraser');
    toast('Eraser ON');
  }
}

// ── Hotbar ──
export function addToHotbar(tool, id) {
  // Check if already in hotbar
  for (let i = 0; i < hotbar.length; i++) {
    if (hotbar[i] && hotbar[i].tool === tool && hotbar[i].id === id) {
      renderHotbar();
      return;
    }
  }
  // Find first empty slot
  for (let i = 0; i < hotbar.length; i++) {
    if (!hotbar[i]) {
      hotbar[i] = { tool, id };
      renderHotbar();
      return;
    }
  }
  // Shift left and add at end
  for (let i = 0; i < hotbar.length - 1; i++) {
    hotbar[i] = hotbar[i + 1];
  }
  hotbar[hotbar.length - 1] = { tool, id };
  renderHotbar();
}

export function selectHotbarSlot(index) {
  const slot = hotbar[index];
  if (!slot) return;
  setFPTool(slot.tool);
  if (slot.tool === 'furniture') {
    fpFurnitureId = slot.id;
    createFurnitureGhost(slot.id);
  }
  renderHotbar();
  toast(`${TOOL_LABELS[slot.tool]}${slot.id ? ': ' + slot.id : ''}`);
}

function renderHotbar() {
  const container = document.getElementById('fp-hotbar');
  if (!container) return;

  const slots = container.querySelectorAll('.hotbar-slot');
  slots.forEach((el, i) => {
    const slot = hotbar[i];
    const thumbEl = el.querySelector('.hotbar-thumb');
    const iconEl = el.querySelector('.hotbar-icon');

    // Clear previous content
    if (thumbEl) thumbEl.src = '';
    if (iconEl) iconEl.textContent = '';

    if (slot) {
      el.classList.add('occupied');
      if (slot.tool === 'furniture' && slot.id) {
        // Try to show thumbnail
        const thumb = thumbnails.get(slot.id);
        if (thumb && thumbEl) {
          thumbEl.src = thumb;
          thumbEl.style.display = 'block';
          if (iconEl) iconEl.style.display = 'none';
        } else {
          if (thumbEl) thumbEl.style.display = 'none';
          if (iconEl) {
            iconEl.textContent = TOOL_EMOJI.furniture;
            iconEl.style.display = 'block';
          }
          // Generate thumbnail async
          generateThumbnail(slot.id).then(() => renderHotbar());
        }
      } else {
        if (thumbEl) thumbEl.style.display = 'none';
        if (iconEl) {
          iconEl.textContent = TOOL_EMOJI[slot.tool] || '';
          iconEl.style.display = 'block';
        }
      }
      // Active state
      el.classList.toggle('active',
        fpTool === slot.tool && (slot.tool !== 'furniture' || fpFurnitureId === slot.id));
    } else {
      el.classList.remove('occupied', 'active');
      if (thumbEl) thumbEl.style.display = 'none';
      if (iconEl) { iconEl.textContent = ''; iconEl.style.display = 'none'; }
    }
  });
}

// ── HUD updates ──
let _prevTool = null;

function updateHUD() {
  const hud = document.getElementById('fp-hud');
  if (!hud) return;

  hud.style.display = (viewMode === 'walk') ? 'block' : 'none';

  const indicator = document.getElementById('fp-tool-indicator');
  if (indicator) {
    if (fpTool) {
      const iconEl = indicator.querySelector('.fp-tool-icon');
      const labelEl = indicator.querySelector('.fp-tool-label');
      const hintEl = indicator.querySelector('.fp-tool-hint');

      if (iconEl) iconEl.innerHTML = TOOL_SVGS[fpTool] || '';
      if (labelEl) labelEl.textContent = TOOL_LABELS[fpTool] || '';
      if (hintEl) hintEl.textContent = TOOL_HINTS[fpTool] || '';

      // Animate tool transition
      if (_prevTool !== fpTool) {
        indicator.classList.remove('fp-tool-enter');
        // Force reflow to restart animation
        void indicator.offsetWidth;
        indicator.classList.add('fp-tool-enter');
        // Set data attribute for tool-specific accent color
        indicator.dataset.tool = fpTool;
      }

      indicator.style.display = 'flex';
    } else {
      indicator.style.display = 'none';
    }
    _prevTool = fpTool;
  }

  renderHotbar();
}

function updateMeasurements(text) {
  const el = document.getElementById('fp-measurements');
  if (el) el.textContent = text;
}

// ── Clear all state ──
export function clearFPBuild() {
  setFPTool(null);
  fpFurnitureId = null;
  fpRotation = 0;
  fpWallStart = null;
  fpFloorStart = null;
  clearFPGhost();
  clearEraserHighlight();
  updateHUD();
}

// ── Show/hide HUD based on view mode ──
export function updateFPHudVisibility() {
  const hud = document.getElementById('fp-hud');
  if (hud) {
    hud.style.display = (viewMode === 'walk') ? 'block' : 'none';
  }
}
