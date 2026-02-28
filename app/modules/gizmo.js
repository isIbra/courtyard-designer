import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { scene, camera, renderer } from './scene.js';
import { orbitControls } from './controls.js';
import { wallRecords } from './wall-builder.js';
import { SCENE_XZ_SCALE, CATALOG, placed } from './furniture.js';
import { pushAction } from './history.js';
import { autoSave } from './persistence.js';
import { T } from './apartment.js';
import { FLOOR_HEIGHT } from './floor-manager.js';

// ── State ──
let transformCtrl = null;
let gizmoHelper = null;
let attachedObj = null;
let dragStartPos = null;
let dragStartRot = null;
let dragStartScale = null;
let gizmoMode = 'translate'; // 'translate' | 'rotate' | 'scale'
let dragging = false;
let _suppressNextClick = false; // prevent click-after-drag from detaching gizmo

const GRID_SNAP = 0.25;
const SCALE_SNAP = 0.05;
const MIN_SCALE = 0.1;
const Y_SNAP_THRESHOLD = 0.3;
const WALL_SNAP_THRESHOLD = 0.5;
const WALL_HALF_T = T / 2;

// ── Public API ──

export function initGizmo() {
  transformCtrl = new TransformControls(camera, renderer.domElement);
  // Scale gizmo to match scene (scene XZ is ~3.4x meters)
  transformCtrl.setSize(1.5);
  transformCtrl.setSpace('world');

  // Add gizmo visual to main scene
  gizmoHelper = transformCtrl.getHelper();
  scene.add(gizmoHelper);

  // Disable frustum culling on entire gizmo tree — the helper's world matrix
  // updates lazily via TransformControlsRoot.updateMatrixWorld, so the bounding
  // sphere can be stale and cause the renderer to cull visible arrows.
  gizmoHelper.frustumCulled = false;
  gizmoHelper.traverse((c) => { c.frustumCulled = false; });

  // Show all axes (like the reference project)
  transformCtrl.showX = true;
  transformCtrl.showY = true;
  transformCtrl.showZ = true;

  // Dragging state management
  transformCtrl.addEventListener('dragging-changed', (event) => {
    dragging = event.value;

    if (orbitControls) {
      orbitControls.enabled = !event.value;
    }

    if (event.value) {
      // Drag started — record pre-drag state
      if (attachedObj) {
        dragStartPos = attachedObj.position.clone();
        dragStartRot = attachedObj.rotation.clone();
        dragStartScale = attachedObj.scale.clone();
      }
    } else {
      // Drag ended — push undo action if changed, suppress next click
      _suppressNextClick = true;
      setTimeout(() => { _suppressNextClick = false; }, 100);

      if (attachedObj && dragStartPos) {
        const obj = attachedObj;
        const oldPos = dragStartPos.clone();
        const oldRot = dragStartRot.clone();
        const oldScale = dragStartScale.clone();
        const newPos = obj.position.clone();
        const newRot = obj.rotation.clone();
        const newScale = obj.scale.clone();

        const posChanged = !oldPos.equals(newPos);
        const rotChanged = Math.abs(oldRot.y - newRot.y) > 0.001;
        const scaleChanged = !oldScale.equals(newScale);

        if (posChanged || rotChanged || scaleChanged) {
          pushAction({
            label: gizmoMode === 'scale'
              ? `Scale ${obj.userData.item?.name || obj.userData.furnitureId}`
              : `Move ${obj.userData.item?.name || obj.userData.furnitureId}`,
            undo() {
              obj.position.copy(oldPos);
              obj.rotation.copy(oldRot);
              obj.scale.copy(oldScale);
              if (scaleChanged) obj.userData.customScale = oldScale.equals(new THREE.Vector3(1,1,1)) ? null : oldScale.clone();
            },
            redo() {
              obj.position.copy(newPos);
              obj.rotation.copy(newRot);
              obj.scale.copy(newScale);
              if (scaleChanged) obj.userData.customScale = newScale.equals(new THREE.Vector3(1,1,1)) ? null : newScale.clone();
            },
          });
          autoSave();
        }
      }
      dragStartPos = null;
      dragStartRot = null;
      dragStartScale = null;

      // Re-enable orbit when not dragging
      if (orbitControls) {
        orbitControls.enabled = true;
      }
    }
  });

  // Object change — constrain axes, apply snapping per mode
  transformCtrl.addEventListener('objectChange', () => {
    if (!attachedObj) return;

    if (gizmoMode === 'translate') {
      // Clamp Y — don't go below floor level
      const floorY = (attachedObj.userData.floor || 0) * FLOOR_HEIGHT;
      if (attachedObj.position.y < floorY) attachedObj.position.y = floorY;

      // Grid snap XZ
      attachedObj.position.x = Math.round(attachedObj.position.x / GRID_SNAP) * GRID_SNAP;
      attachedObj.position.z = Math.round(attachedObj.position.z / GRID_SNAP) * GRID_SNAP;

      // Grid snap Y (same increment)
      attachedObj.position.y = Math.round(attachedObj.position.y / GRID_SNAP) * GRID_SNAP;
      if (attachedObj.position.y < floorY) attachedObj.position.y = floorY;

      // Snap to top of other furniture
      snapToFurnitureTop(attachedObj);

      // Wall snap
      snapToWalls(attachedObj);
    }

    if (gizmoMode === 'rotate') {
      // Lock position during rotation
      if (dragStartPos) {
        attachedObj.position.copy(dragStartPos);
      }
    }

    if (gizmoMode === 'scale') {
      // Lock position during scaling
      if (dragStartPos) {
        attachedObj.position.copy(dragStartPos);
      }
      // Enforce minimum scale and snap to increments
      attachedObj.scale.x = Math.max(MIN_SCALE, Math.round(attachedObj.scale.x / SCALE_SNAP) * SCALE_SNAP);
      attachedObj.scale.y = Math.max(MIN_SCALE, Math.round(attachedObj.scale.y / SCALE_SNAP) * SCALE_SNAP);
      attachedObj.scale.z = Math.max(MIN_SCALE, Math.round(attachedObj.scale.z / SCALE_SNAP) * SCALE_SNAP);
      // Store custom scale
      attachedObj.userData.customScale = attachedObj.scale.clone();
    }
  });
}

export function attachGizmo(group) {
  if (attachedObj === group) return;

  detachGizmo();
  attachedObj = group;
  gizmoMode = 'translate';
  transformCtrl.setMode('translate');
  transformCtrl.showX = true;
  transformCtrl.showY = true;
  transformCtrl.showZ = true;
  transformCtrl.attach(group);
}

export function detachGizmo() {
  if (!attachedObj) return;
  transformCtrl.detach();
  attachedObj = null;
  dragStartPos = null;
  dragStartRot = null;
  dragging = false;
}

export function toggleGizmoMode() {
  if (!attachedObj) return gizmoMode;

  if (gizmoMode === 'translate') {
    gizmoMode = 'rotate';
    transformCtrl.setMode('rotate');
  } else if (gizmoMode === 'rotate') {
    gizmoMode = 'scale';
    transformCtrl.setMode('scale');
  } else {
    gizmoMode = 'translate';
    transformCtrl.setMode('translate');
  }
  // Show all axes in all modes
  transformCtrl.showX = true;
  transformCtrl.showY = true;
  transformCtrl.showZ = true;
  return gizmoMode;
}

export function isGizmoActive() {
  return attachedObj !== null;
}

export function isDragging() {
  return dragging;
}

/** Returns true if a click should be suppressed (just finished dragging or hovering gizmo) */
export function shouldSuppressClick() {
  if (_suppressNextClick) return true;
  if (dragging) return true;
  // Check if user is hovering a gizmo handle (axis is set when hovering)
  if (transformCtrl && transformCtrl.axis) return true;
  return false;
}

export function getAttached() {
  return attachedObj;
}

export function getGizmoMode() {
  return gizmoMode;
}

/** True when gizmo is visible — caller should skip EffectComposer and render directly */
export function shouldBypassPostProcessing() {
  return attachedObj !== null;
}

// ── Internal ──

function snapToFurnitureTop(obj) {
  // Raycast downward from above the furniture center to find other furniture surfaces
  const origin = new THREE.Vector3(obj.position.x, obj.position.y + 10, obj.position.z);
  const down = new THREE.Vector3(0, -1, 0);
  const ray = new THREE.Raycaster(origin, down);

  // Collect meshes from all other placed furniture
  const others = [];
  for (const p of placed) {
    if (p === obj) continue;
    p.traverse((c) => { if (c.isMesh) others.push(c); });
  }
  if (others.length === 0) return;

  const hits = ray.intersectObjects(others);
  if (hits.length === 0) return;

  const topY = hits[0].point.y;
  if (Math.abs(obj.position.y - topY) < Y_SNAP_THRESHOLD) {
    obj.position.y = topY;
  }
}

function snapToWalls(obj) {
  const item = obj.userData.item;
  if (!item) return;

  const rotY = obj.rotation.y;
  // Compute effective half-extents considering rotation
  const cosR = Math.abs(Math.cos(rotY));
  const sinR = Math.abs(Math.sin(rotY));
  const halfW = (item.w * SCENE_XZ_SCALE) / 2;
  const halfD = (item.d * SCENE_XZ_SCALE) / 2;
  const effectiveHalfX = halfW * cosR + halfD * sinR;
  const effectiveHalfZ = halfW * sinR + halfD * cosR;

  const objX = obj.position.x;
  const objZ = obj.position.z;
  const objFloor = obj.userData.floor || 0;

  // Edges of the furniture bounding box
  const minX = objX - effectiveHalfX;
  const maxX = objX + effectiveHalfX;
  const minZ = objZ - effectiveHalfZ;
  const maxZ = objZ + effectiveHalfZ;

  let snapX = null;
  let snapZ = null;
  let bestDistX = WALL_SNAP_THRESHOLD;
  let bestDistZ = WALL_SNAP_THRESHOLD;

  for (const rec of wallRecords.values()) {
    // Only snap to walls on the same floor
    if ((rec.floor || 0) !== objFloor) continue;

    if (rec.type === 'h') {
      // Horizontal wall at z = rec.z, spanning x1..x2
      if (maxX > rec.x1 && minX < rec.x2) {
        const wallNorthFace = rec.z - WALL_HALF_T;
        const distS = Math.abs(maxZ - wallNorthFace);
        if (distS < bestDistZ) {
          bestDistZ = distS;
          snapZ = wallNorthFace - effectiveHalfZ;
        }
        const wallSouthFace = rec.z + WALL_HALF_T;
        const distN = Math.abs(minZ - wallSouthFace);
        if (distN < bestDistZ) {
          bestDistZ = distN;
          snapZ = wallSouthFace + effectiveHalfZ;
        }
      }
    } else if (rec.type === 'v') {
      // Vertical wall at x = rec.x, spanning z1..z2
      if (maxZ > rec.z1 && minZ < rec.z2) {
        const wallWestFace = rec.x - WALL_HALF_T;
        const distE = Math.abs(maxX - wallWestFace);
        if (distE < bestDistX) {
          bestDistX = distE;
          snapX = wallWestFace - effectiveHalfX;
        }
        const wallEastFace = rec.x + WALL_HALF_T;
        const distW = Math.abs(minX - wallEastFace);
        if (distW < bestDistX) {
          bestDistX = distW;
          snapX = wallEastFace + effectiveHalfX;
        }
      }
    }
  }

  if (snapX !== null) obj.position.x = snapX;
  if (snapZ !== null) obj.position.z = snapZ;
}
