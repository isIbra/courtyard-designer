// ── Grid Module — central snap logic + visual grid overlay ──

import * as THREE from 'three';
import { scene, camera, renderer } from './scene.js';
import { getCurrentFloor, getYBase, FLOOR_HEIGHT } from './floor-manager.js';
import { T, H } from './apartment.js';

const DEFAULT_SNAP = 0.25;

// ── Snap functions ──

export function snap(v, resolution = DEFAULT_SNAP) {
  return Math.round(v / resolution) * resolution;
}

export function snapPoint(x, z, resolution = DEFAULT_SNAP) {
  return { x: snap(x, resolution), z: snap(z, resolution) };
}

// ── Raycast to floor plane ──

const _raycaster = new THREE.Raycaster();
const _mouse = new THREE.Vector2();

export function getFloorHit(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  _mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  _mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  _raycaster.setFromCamera(_mouse, camera);
  const yBase = getYBase(getCurrentFloor());
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -yBase);
  const pt = new THREE.Vector3();
  _raycaster.ray.intersectPlane(plane, pt);
  return pt;
}

// ── Visual grid overlay ──

let gridMesh = null;
let gridVisible = false;

const GRID_X_MIN = 0;
const GRID_X_MAX = 50;
const GRID_Z_MIN = 0;
const GRID_Z_MAX = 35;

export function createGridOverlay() {
  if (gridMesh) return gridMesh;

  const minorStep = 0.25;
  const majorStep = 1.0;

  // Count lines
  const xMinorCount = Math.floor((GRID_X_MAX - GRID_X_MIN) / minorStep) + 1;
  const zMinorCount = Math.floor((GRID_Z_MAX - GRID_Z_MIN) / minorStep) + 1;
  const totalLines = xMinorCount + zMinorCount;
  const totalVerts = totalLines * 2;

  const positions = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);

  const majorColor = new THREE.Color(0xc8a96e);
  const minorColor = new THREE.Color(0xc8a96e);
  const majorAlpha = 0.25;
  const minorAlpha = 0.12;

  let vi = 0;

  // Vertical lines (along Z, stepping X)
  for (let i = 0; i < xMinorCount; i++) {
    const x = GRID_X_MIN + i * minorStep;
    const isMajor = Math.abs(x - Math.round(x / majorStep) * majorStep) < 0.001;
    const c = isMajor ? majorColor : minorColor;
    const a = isMajor ? majorAlpha : minorAlpha;

    positions[vi * 3] = x;
    positions[vi * 3 + 1] = 0;
    positions[vi * 3 + 2] = GRID_Z_MIN;
    colors[vi * 3] = c.r * a;
    colors[vi * 3 + 1] = c.g * a;
    colors[vi * 3 + 2] = c.b * a;
    vi++;

    positions[vi * 3] = x;
    positions[vi * 3 + 1] = 0;
    positions[vi * 3 + 2] = GRID_Z_MAX;
    colors[vi * 3] = c.r * a;
    colors[vi * 3 + 1] = c.g * a;
    colors[vi * 3 + 2] = c.b * a;
    vi++;
  }

  // Horizontal lines (along X, stepping Z)
  for (let i = 0; i < zMinorCount; i++) {
    const z = GRID_Z_MIN + i * minorStep;
    const isMajor = Math.abs(z - Math.round(z / majorStep) * majorStep) < 0.001;
    const c = isMajor ? majorColor : minorColor;
    const a = isMajor ? majorAlpha : minorAlpha;

    positions[vi * 3] = GRID_X_MIN;
    positions[vi * 3 + 1] = 0;
    positions[vi * 3 + 2] = z;
    colors[vi * 3] = c.r * a;
    colors[vi * 3 + 1] = c.g * a;
    colors[vi * 3 + 2] = c.b * a;
    vi++;

    positions[vi * 3] = GRID_X_MAX;
    positions[vi * 3 + 1] = 0;
    positions[vi * 3 + 2] = z;
    colors[vi * 3] = c.r * a;
    colors[vi * 3 + 1] = c.g * a;
    colors[vi * 3 + 2] = c.b * a;
    vi++;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
  });

  gridMesh = new THREE.LineSegments(geo, mat);
  gridMesh.name = 'grid_overlay';
  gridMesh.renderOrder = -1;
  gridMesh.visible = gridVisible;

  // Position at current floor
  const yBase = getYBase(getCurrentFloor());
  gridMesh.position.y = yBase + 0.01;

  scene.add(gridMesh);
  return gridMesh;
}

export function toggleGridVisible() {
  gridVisible = !gridVisible;
  if (!gridMesh) createGridOverlay();
  gridMesh.visible = gridVisible;
  return gridVisible;
}

export function isGridVisible() {
  return gridVisible;
}

export function updateGridFloor(floorLevel) {
  if (!gridMesh) return;
  gridMesh.position.y = getYBase(floorLevel) + 0.01;
}

// ── Lower-floor ghost wireframes ──

let lowerFloorGhosts = [];

export function showLowerFloorGhosts(wallRecords, currentFloor) {
  clearLowerFloorGhosts();

  const belowFloor = currentFloor - 1;
  if (belowFloor < 0) return;

  const ghostMat = new THREE.LineBasicMaterial({
    color: 0xc8a96e,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });

  for (const rec of wallRecords.values()) {
    if ((rec.floor || 0) !== belowFloor) continue;

    const wallH = rec.H || H;
    const wallT = rec.T || T;
    const yBase = getYBase(belowFloor);
    let boxGeo;

    if (rec.type === 'h') {
      const w = rec.x2 - rec.x1;
      if (w < 0.05) continue;
      boxGeo = new THREE.BoxGeometry(w, wallH, wallT);
    } else {
      const d = rec.z2 - rec.z1;
      if (d < 0.05) continue;
      boxGeo = new THREE.BoxGeometry(wallT, wallH, d);
    }

    const edges = new THREE.EdgesGeometry(boxGeo);
    const wireframe = new THREE.LineSegments(edges, ghostMat);

    if (rec.type === 'h') {
      const w = rec.x2 - rec.x1;
      wireframe.position.set(rec.x1 + w / 2, wallH / 2 + yBase, rec.z);
    } else {
      const d = rec.z2 - rec.z1;
      wireframe.position.set(rec.x, wallH / 2 + yBase, rec.z1 + d / 2);
    }

    wireframe.userData.isLowerFloorGhost = true;
    scene.add(wireframe);
    lowerFloorGhosts.push(wireframe);
    boxGeo.dispose();
  }
}

export function clearLowerFloorGhosts() {
  for (const ghost of lowerFloorGhosts) {
    scene.remove(ghost);
    ghost.geometry.dispose();
  }
  lowerFloorGhosts = [];
}
