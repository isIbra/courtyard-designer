import * as THREE from 'three';
import { scene } from './scene.js';

// ── Constants ──
export const T = 0.25;   // wall thickness
export const H = 3.0;    // ceiling height
export const DOOR_H = 2.1;

const BASEBOARD_H = 0.08;
const BASEBOARD_DEPTH = 0.02;
const DOOR_FRAME_THICKNESS = 0.05;
const DOOR_FRAME_WIDTH = 0.08;

// ── Room data (interior coords, origin = top-left of apartment interior) ──
export const ROOMS = [
  { id: 'staircase', name: 'Staircase',   x: 0,    z: 0,    w: 2.75, d: 4.50, floor: 0xa89888, wall: 0xEBE0D0 },
  { id: 'bedroom',   name: 'Bedroom',     x: 3.00, z: 0,    w: 4.35, d: 4.50, floor: 0xc4b099, wall: 0xEBE0D0 },
  { id: 'wc',        name: 'WC',          x: 7.60, z: 0,    w: 1.50, d: 2.00, floor: 0xd0d0d5, wall: 0xE5E0E0 },
  { id: 'foyer',     name: 'Foyer',       x: 7.60, z: 2.25, w: 1.50, d: 2.25, floor: 0xb8a898, wall: 0xEBE0D0 },
  { id: 'corridor',  name: 'Corridor',    x: 0,    z: 4.75, w: 9.10, d: 0.96, floor: 0xb0a090, wall: 0xEBE0D0 },
  { id: 'living',    name: 'Living Room', x: 0,    z: 5.96, w: 4.00, d: 5.24, floor: 0xc8b898, wall: 0xEBE0D0 },
  { id: 'kitchen',   name: 'Kitchen',     x: 4.25, z: 5.96, w: 3.43, d: 2.40, floor: 0xc0b8a8, wall: 0xEBE0D0 },
  { id: 'bathroom',  name: 'Bathroom',    x: 4.25, z: 8.61, w: 3.43, d: 2.59, floor: 0xd0d0d5, wall: 0xE5E0E0 },
  { id: 'utility',   name: 'Utility',     x: 7.93, z: 5.96, w: 1.17, d: 5.24, floor: 0xb0a898, wall: 0xEBE0D0 },
];

// ── Floor material presets per room type ──
const FLOOR_PRESETS = {
  staircase: { color: 0x908880, roughness: 0.92, metalness: 0.02 },  // concrete gray
  bedroom:   { color: 0xc4a878, roughness: 0.65, metalness: 0.03 },  // warm wood tone
  wc:        { color: 0xd8d8dd, roughness: 0.95, metalness: 0.01 },  // light tile
  foyer:     { color: 0xb8a890, roughness: 0.80, metalness: 0.03 },  // neutral warm
  corridor:  { color: 0xb0a898, roughness: 0.82, metalness: 0.02 },  // neutral
  living:    { color: 0xd0b888, roughness: 0.60, metalness: 0.03 },  // warm sandy tone
  kitchen:   { color: 0xc0b0a0, roughness: 0.90, metalness: 0.02 },  // medium tile
  bathroom:  { color: 0xd5d5da, roughness: 0.95, metalness: 0.01 },  // light tile
  utility:   { color: 0xa8a098, roughness: 0.85, metalness: 0.02 },  // neutral
};

// Stores for material swapping and visibility toggling
export const floorMeshes = [];
export const wallMeshes  = [];
export const ceilingMeshes = [];

// ── Tracked doors for frame generation ──
/** @type {{ pos: THREE.Vector3, width: number, height: number, axis: 'x'|'z' }[]} */
const doorOpenings = [];

// ── Build floors ──
function buildFloors() {
  for (const room of ROOMS) {
    const preset = FLOOR_PRESETS[room.id] || { color: room.floor, roughness: 0.80, metalness: 0.05 };
    const geo = new THREE.PlaneGeometry(room.w, room.d);
    const mat = new THREE.MeshStandardMaterial({
      color: preset.color,
      roughness: preset.roughness,
      metalness: preset.metalness,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(room.x + room.w / 2, 0.01, room.z + room.d / 2);
    mesh.receiveShadow = true;
    mesh.userData.roomId = room.id;
    mesh.userData.isFloor = true;
    mesh.name = `floor_${room.id}`;
    scene.add(mesh);
    floorMeshes.push(mesh);
  }
}

// ── Build ceilings ──
function buildCeilings() {
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0xD8CFC0,
    roughness: 0.90,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  for (const room of ROOMS) {
    const geo = new THREE.PlaneGeometry(room.w, room.d);
    const mesh = new THREE.Mesh(geo, ceilingMat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(room.x + room.w / 2, H, room.z + room.d / 2);
    mesh.receiveShadow = true;
    mesh.name = `ceiling_${room.id}`;
    scene.add(mesh);
    ceilingMeshes.push(mesh);
  }
}

/** Toggle ceiling visibility (hide in orbit/top, show in walk) */
export function setCeilingsVisible(visible) {
  for (const m of ceilingMeshes) {
    m.visible = visible;
  }
}

// ── Baseboard helpers ──
function buildBaseboards() {
  const bbMat = new THREE.MeshStandardMaterial({
    color: 0xC0B4A0,
    roughness: 0.75,
    metalness: 0.05,
  });

  for (const room of ROOMS) {
    const cx = room.x;
    const cz = room.z;
    const w = room.w;
    const d = room.d;

    // North wall baseboard (along z = cz, from cx to cx+w)
    addBaseboard(cx, cz, w, 'h', 'inner_south', bbMat);
    // South wall baseboard (along z = cz+d)
    addBaseboard(cx, cz + d, w, 'h', 'inner_north', bbMat);
    // West wall baseboard (along x = cx, from cz to cz+d)
    addBaseboard(cx, cz, d, 'v', 'inner_east', bbMat);
    // East wall baseboard (along x = cx+w)
    addBaseboard(cx + w, cz, d, 'v', 'inner_west', bbMat);
  }
}

function addBaseboard(x, z, length, orientation, face, material) {
  if (length < 0.05) return;

  if (orientation === 'h') {
    // Horizontal baseboard along X axis
    const geo = new THREE.BoxGeometry(length, BASEBOARD_H, BASEBOARD_DEPTH);
    const mesh = new THREE.Mesh(geo, material);
    const zOff = face === 'inner_south' ? BASEBOARD_DEPTH / 2 : -BASEBOARD_DEPTH / 2;
    mesh.position.set(x + length / 2, BASEBOARD_H / 2, z + zOff);
    mesh.receiveShadow = true;
    scene.add(mesh);
  } else {
    // Vertical baseboard along Z axis
    const geo = new THREE.BoxGeometry(BASEBOARD_DEPTH, BASEBOARD_H, length);
    const mesh = new THREE.Mesh(geo, material);
    const xOff = face === 'inner_east' ? BASEBOARD_DEPTH / 2 : -BASEBOARD_DEPTH / 2;
    mesh.position.set(x + xOff, BASEBOARD_H / 2, z + length / 2);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

// ── Wall helpers ──
function hWall(z, x1, x2, height, doors, material) {
  const group = new THREE.Group();
  const segs = splitForDoors(x1, x2, doors, 'x');

  for (const seg of segs) {
    const w = seg.end - seg.start;
    if (w < 0.02) continue;
    const h = seg.aboveDoor ? height - DOOR_H : height;
    const yOff = seg.aboveDoor ? DOOR_H : 0;
    const geo = new THREE.BoxGeometry(w, h, T);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(seg.start + w / 2, yOff + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    wallMeshes.push(mesh);
  }

  // Record door openings for frame generation
  if (doors) {
    for (const door of doors) {
      doorOpenings.push({
        pos: new THREE.Vector3(door.pos, 0, z),
        width: door.w,
        height: DOOR_H,
        axis: 'x',
      });
    }
  }

  scene.add(group);
  return group;
}

function vWall(x, z1, z2, height, doors, material) {
  const group = new THREE.Group();
  const segs = splitForDoors(z1, z2, doors, 'z');

  for (const seg of segs) {
    const d = seg.end - seg.start;
    if (d < 0.02) continue;
    const h = seg.aboveDoor ? height - DOOR_H : height;
    const yOff = seg.aboveDoor ? DOOR_H : 0;
    const geo = new THREE.BoxGeometry(T, h, d);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, yOff + h / 2, seg.start + d / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    wallMeshes.push(mesh);
  }

  // Record door openings for frame generation
  if (doors) {
    for (const door of doors) {
      doorOpenings.push({
        pos: new THREE.Vector3(x, 0, door.pos),
        width: door.w,
        height: DOOR_H,
        axis: 'z',
      });
    }
  }

  scene.add(group);
  return group;
}

/**
 * Splits a wall span into segments, leaving gaps for doors.
 * doors = [{ pos, w }]  pos = center position along the wall axis
 */
function splitForDoors(start, end, doors, _axis) {
  if (!doors || doors.length === 0) {
    return [{ start, end, aboveDoor: false }];
  }

  const sorted = [...doors].sort((a, b) => a.pos - b.pos);
  const segments = [];
  let cur = start;

  for (const door of sorted) {
    const dl = door.pos - door.w / 2;
    const dr = door.pos + door.w / 2;

    if (dl > cur + 0.02) {
      segments.push({ start: cur, end: dl, aboveDoor: false });
    }
    // above-door segment
    segments.push({ start: dl, end: dr, aboveDoor: true });
    cur = dr;
  }

  if (cur < end - 0.02) {
    segments.push({ start: cur, end: end, aboveDoor: false });
  }
  return segments;
}

// ── Door frames ──
function buildDoorFrames() {
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x6B4423,
    roughness: 0.65,
    metalness: 0.08,
  });

  for (const opening of doorOpenings) {
    const halfW = opening.width / 2;
    const dh = opening.height;

    if (opening.axis === 'x') {
      // Door is in an hWall (wall runs along X, thin in Z)
      // Left jamb
      const leftGeo = new THREE.BoxGeometry(DOOR_FRAME_WIDTH, dh, T + DOOR_FRAME_THICKNESS * 2);
      const leftMesh = new THREE.Mesh(leftGeo, frameMat);
      leftMesh.position.set(
        opening.pos.x - halfW - DOOR_FRAME_WIDTH / 2,
        dh / 2,
        opening.pos.z
      );
      leftMesh.castShadow = true;
      leftMesh.receiveShadow = true;
      scene.add(leftMesh);

      // Right jamb
      const rightGeo = new THREE.BoxGeometry(DOOR_FRAME_WIDTH, dh, T + DOOR_FRAME_THICKNESS * 2);
      const rightMesh = new THREE.Mesh(rightGeo, frameMat);
      rightMesh.position.set(
        opening.pos.x + halfW + DOOR_FRAME_WIDTH / 2,
        dh / 2,
        opening.pos.z
      );
      rightMesh.castShadow = true;
      rightMesh.receiveShadow = true;
      scene.add(rightMesh);

      // Top header
      const topGeo = new THREE.BoxGeometry(opening.width + DOOR_FRAME_WIDTH * 2, DOOR_FRAME_WIDTH, T + DOOR_FRAME_THICKNESS * 2);
      const topMesh = new THREE.Mesh(topGeo, frameMat);
      topMesh.position.set(
        opening.pos.x,
        dh + DOOR_FRAME_WIDTH / 2,
        opening.pos.z
      );
      topMesh.castShadow = true;
      topMesh.receiveShadow = true;
      scene.add(topMesh);

    } else {
      // Door is in a vWall (wall runs along Z, thin in X)
      // Left jamb (lower Z side)
      const leftGeo = new THREE.BoxGeometry(T + DOOR_FRAME_THICKNESS * 2, dh, DOOR_FRAME_WIDTH);
      const leftMesh = new THREE.Mesh(leftGeo, frameMat);
      leftMesh.position.set(
        opening.pos.x,
        dh / 2,
        opening.pos.z - halfW - DOOR_FRAME_WIDTH / 2
      );
      leftMesh.castShadow = true;
      leftMesh.receiveShadow = true;
      scene.add(leftMesh);

      // Right jamb (upper Z side)
      const rightGeo = new THREE.BoxGeometry(T + DOOR_FRAME_THICKNESS * 2, dh, DOOR_FRAME_WIDTH);
      const rightMesh = new THREE.Mesh(rightGeo, frameMat);
      rightMesh.position.set(
        opening.pos.x,
        dh / 2,
        opening.pos.z + halfW + DOOR_FRAME_WIDTH / 2
      );
      rightMesh.castShadow = true;
      rightMesh.receiveShadow = true;
      scene.add(rightMesh);

      // Top header
      const topGeo = new THREE.BoxGeometry(T + DOOR_FRAME_THICKNESS * 2, DOOR_FRAME_WIDTH, opening.width + DOOR_FRAME_WIDTH * 2);
      const topMesh = new THREE.Mesh(topGeo, frameMat);
      topMesh.position.set(
        opening.pos.x,
        dh + DOOR_FRAME_WIDTH / 2,
        opening.pos.z
      );
      topMesh.castShadow = true;
      topMesh.receiveShadow = true;
      scene.add(topMesh);
    }
  }
}

// ── Windows ──
function buildWindows() {
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xAADDFF,
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    envMapIntensity: 0.8,
  });

  const windowFrameMat = new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.3,
    metalness: 0.6,
  });

  const FRAME_W = 0.04; // frame bar width
  const FRAME_D = 0.03; // frame bar depth

  /**
   * @param {'h'|'v'} wallType - h = wall runs along X (north/south), v = wall runs along Z (west/east)
   * @param {number} wallCoord - z for hWall, x for vWall (the fixed coordinate of the wall)
   * @param {number} pos - position along the wall axis (x for hWall, z for vWall)
   * @param {number} width - window width
   * @param {number} height - window height
   * @param {number} sillY - sill height from ground
   */
  function addWindow(wallType, wallCoord, pos, width, height, sillY) {
    const centerY = sillY + height / 2;
    const halfW = width / 2;
    const halfH = height / 2;

    // ── Glass pane ──
    const glassGeo = new THREE.PlaneGeometry(width, height);
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.castShadow = true;
    glassMesh.receiveShadow = true;

    if (wallType === 'h') {
      // Wall along X, thin in Z — glass faces Z
      glassMesh.position.set(pos, centerY, wallCoord);
    } else {
      // Wall along Z, thin in X — glass faces X
      glassMesh.rotation.y = Math.PI / 2;
      glassMesh.position.set(wallCoord, centerY, pos);
    }
    scene.add(glassMesh);

    // ── Frame bars ──
    // We build 4 bars: top, bottom (sill), left, right
    if (wallType === 'h') {
      // Top bar
      const topGeo = new THREE.BoxGeometry(width + FRAME_W * 2, FRAME_W, FRAME_D);
      const topMesh = new THREE.Mesh(topGeo, windowFrameMat);
      topMesh.position.set(pos, sillY + height + FRAME_W / 2, wallCoord);
      topMesh.castShadow = true;
      topMesh.receiveShadow = true;
      scene.add(topMesh);

      // Bottom bar (sill)
      const sillGeo = new THREE.BoxGeometry(width + FRAME_W * 2, FRAME_W, FRAME_D + 0.02);
      const sillMesh = new THREE.Mesh(sillGeo, windowFrameMat);
      sillMesh.position.set(pos, sillY - FRAME_W / 2, wallCoord);
      sillMesh.castShadow = true;
      sillMesh.receiveShadow = true;
      scene.add(sillMesh);

      // Left bar
      const leftGeo = new THREE.BoxGeometry(FRAME_W, height + FRAME_W * 2, FRAME_D);
      const leftMesh = new THREE.Mesh(leftGeo, windowFrameMat);
      leftMesh.position.set(pos - halfW - FRAME_W / 2, centerY, wallCoord);
      leftMesh.castShadow = true;
      leftMesh.receiveShadow = true;
      scene.add(leftMesh);

      // Right bar
      const rightGeo = new THREE.BoxGeometry(FRAME_W, height + FRAME_W * 2, FRAME_D);
      const rightMesh = new THREE.Mesh(rightGeo, windowFrameMat);
      rightMesh.position.set(pos + halfW + FRAME_W / 2, centerY, wallCoord);
      rightMesh.castShadow = true;
      rightMesh.receiveShadow = true;
      scene.add(rightMesh);
    } else {
      // vWall: bars oriented along Z
      // Top bar
      const topGeo = new THREE.BoxGeometry(FRAME_D, FRAME_W, width + FRAME_W * 2);
      const topMesh = new THREE.Mesh(topGeo, windowFrameMat);
      topMesh.position.set(wallCoord, sillY + height + FRAME_W / 2, pos);
      topMesh.castShadow = true;
      topMesh.receiveShadow = true;
      scene.add(topMesh);

      // Bottom bar (sill)
      const sillGeo = new THREE.BoxGeometry(FRAME_D + 0.02, FRAME_W, width + FRAME_W * 2);
      const sillMesh = new THREE.Mesh(sillGeo, windowFrameMat);
      sillMesh.position.set(wallCoord, sillY - FRAME_W / 2, pos);
      sillMesh.castShadow = true;
      sillMesh.receiveShadow = true;
      scene.add(sillMesh);

      // Left bar (lower Z)
      const leftGeo = new THREE.BoxGeometry(FRAME_D, height + FRAME_W * 2, FRAME_W);
      const leftMesh = new THREE.Mesh(leftGeo, windowFrameMat);
      leftMesh.position.set(wallCoord, centerY, pos - halfW - FRAME_W / 2);
      leftMesh.castShadow = true;
      leftMesh.receiveShadow = true;
      scene.add(leftMesh);

      // Right bar (upper Z)
      const rightGeo = new THREE.BoxGeometry(FRAME_D, height + FRAME_W * 2, FRAME_W);
      const rightMesh = new THREE.Mesh(rightGeo, windowFrameMat);
      rightMesh.position.set(wallCoord, centerY, pos + halfW + FRAME_W / 2);
      rightMesh.castShadow = true;
      rightMesh.receiveShadow = true;
      scene.add(rightMesh);
    }
  }

  // ── North wall (z=0) ──
  addWindow('h', 0, 5.17, 1.5, 1.5, 0.9);   // Bedroom window
  addWindow('h', 0, 1.37, 1.0, 1.0, 1.2);   // Staircase window

  // ── South wall (z=11.20) ──
  addWindow('h', 11.20, 2.0, 1.8, 1.5, 0.9); // Living room window
  addWindow('h', 11.20, 5.96, 0.8, 0.6, 1.8); // Bathroom window (high privacy)

  // ── West wall (x=0) ──
  addWindow('v', 0, 8.5, 1.5, 1.5, 0.9);     // Living room window
}

// ── Interior door panels ──
function buildDoorPanels() {
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x8B6914,
    roughness: 0.65,
    metalness: 0.05,
  });

  const knobMat = new THREE.MeshStandardMaterial({
    color: 0xC0C0C0,
    roughness: 0.2,
    metalness: 0.9,
  });

  const PANEL_THICKNESS = 0.04;
  const AJAR_ANGLE = 0.26; // ~15 degrees

  for (const opening of doorOpenings) {
    const panelW = opening.width - 0.04;
    const panelH = opening.height - 0.02;
    const halfPanelW = panelW / 2;

    const panelGeo = new THREE.BoxGeometry(panelW, panelH, PANEL_THICKNESS);
    const panel = new THREE.Mesh(panelGeo, doorMat);
    panel.castShadow = true;
    panel.receiveShadow = true;

    // Doorknob
    const knobGeo = new THREE.SphereGeometry(0.025, 12, 8);
    const knob = new THREE.Mesh(knobGeo, knobMat);
    knob.castShadow = true;

    const pivot = new THREE.Group();

    if (opening.axis === 'x') {
      // Door in hWall: panel faces Z, hinged on left side (lower X)
      const hingeX = opening.pos.x - opening.width / 2;
      const hingeZ = opening.pos.z;

      pivot.position.set(hingeX, 0, hingeZ);

      // Panel offset from pivot by half its width in local X
      panel.position.set(halfPanelW, panelH / 2, 0);

      // Knob on the opposite side from hinge, at handle height
      knob.position.set(panelW - 0.08, panelH * 0.45, PANEL_THICKNESS / 2 + 0.015);

      pivot.rotation.y = AJAR_ANGLE;
    } else {
      // Door in vWall: panel faces X, hinged on lower-Z side
      const hingeX = opening.pos.x;
      const hingeZ = opening.pos.z - opening.width / 2;

      pivot.position.set(hingeX, 0, hingeZ);

      // Panel offset from pivot in local Z (rotated 90deg so it faces X)
      // We rotate the panel group so the panel faces X direction
      panel.rotation.y = Math.PI / 2;
      panel.position.set(0, panelH / 2, halfPanelW);

      // Knob
      knob.position.set(PANEL_THICKNESS / 2 + 0.015, panelH * 0.45, panelW - 0.08);

      pivot.rotation.y = AJAR_ANGLE;
    }

    pivot.add(panel);
    pivot.add(knob);
    scene.add(pivot);
  }
}

// ── Staircase steps ──
function buildStaircase() {
  const stairRoom = ROOMS.find((/** @type {{ id: string }} */ r) => r.id === 'staircase');
  if (!stairRoom) return;

  const stepMat = new THREE.MeshStandardMaterial({
    color: 0x9A9080,
    roughness: 0.88,
    metalness: 0.04,
  });

  const stepCount = 15;
  const stepHeight = 0.20;
  const stepDepth = 0.30;
  const sideMargin = 0.15;
  const stepWidth = stairRoom.w - sideMargin * 2;

  // Steps go from the south end of the staircase room toward the north,
  // ascending from Y=0 upward
  const startZ = stairRoom.z + stairRoom.d - 0.10; // near the south interior wall
  const startX = stairRoom.x + sideMargin;

  for (let i = 0; i < stepCount; i++) {
    const geo = new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth);
    const mesh = new THREE.Mesh(geo, stepMat);
    mesh.position.set(
      startX + stepWidth / 2,
      stepHeight / 2 + i * stepHeight,
      startZ - i * stepDepth - stepDepth / 2
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `stair_step_${i}`;
    scene.add(mesh);
  }

  // Side stringers (the angled side panels of the staircase)
  const totalRise = stepCount * stepHeight;
  const totalRun = stepCount * stepDepth;
  const stringerHeight = totalRise + 0.10;
  const stringerLength = Math.sqrt(totalRun * totalRun + totalRise * totalRise);
  const stringerAngle = Math.atan2(totalRise, totalRun);

  const stringerMat = new THREE.MeshStandardMaterial({
    color: 0x807068,
    roughness: 0.85,
    metalness: 0.05,
  });

  // Left stringer
  const lGeo = new THREE.BoxGeometry(0.05, stringerLength, 0.04);
  const lMesh = new THREE.Mesh(lGeo, stringerMat);
  lMesh.rotation.x = stringerAngle;
  lMesh.position.set(
    startX,
    totalRise / 2,
    startZ - totalRun / 2
  );
  lMesh.castShadow = true;
  scene.add(lMesh);

  // Right stringer
  const rMesh = new THREE.Mesh(lGeo.clone(), stringerMat);
  rMesh.rotation.x = stringerAngle;
  rMesh.position.set(
    startX + stepWidth,
    totalRise / 2,
    startZ - totalRun / 2
  );
  rMesh.castShadow = true;
  scene.add(rMesh);
}

// ── Build all walls ──
function buildWalls() {
  const mat = (/** @type {number} */ color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const wm = mat(0xEBE0D0);
  const wmLight = mat(0xE5E0E0);

  // ── Exterior walls ──
  // North (z=0)
  hWall(0, -T, 9.10 + T, H, [], wm);
  // South (z=11.20)
  hWall(11.20, -T, 9.10 + T, H, [], wm);
  // West (x=0)
  vWall(0, -T, 11.20 + T, H, [{ pos: 5.5, w: 1.2 }], wm); // front door
  // East apartment boundary (x=9.10) - partial, courtyard takes over
  vWall(9.10, 0, 4.09, H, [{ pos: 2.0, w: 1.8 }], wm);   // door to courtyard upper
  vWall(9.10, 4.09, 11.20, H, [{ pos: 7.0, w: 1.8 }], wm); // door to courtyard lower

  // ── Interior walls ──
  // Staircase | Bedroom (x=2.75)
  vWall(2.75, 0, 4.50, H, [{ pos: 2.25, w: 0.9 }], wm);

  // Bedroom | WC+Foyer (x=7.35)
  vWall(7.35, 0, 4.50, H, [{ pos: 1.0, w: 0.8 }, { pos: 3.25, w: 0.8 }], wm);

  // WC | Foyer (z=2.00)
  hWall(2.00, 7.35, 9.10, H, [{ pos: 8.35, w: 0.7 }], wmLight);

  // Upper rooms | Corridor (z=4.50)
  hWall(4.50, 0, 9.10, H, [
    { pos: 1.37, w: 0.9 },  // staircase → corridor
    { pos: 5.17, w: 0.9 },  // bedroom → corridor
    { pos: 8.35, w: 0.9 },  // foyer → corridor
  ], wm);

  // Corridor | Lower rooms (z=5.71)
  hWall(5.71, 0, 9.10, H, [
    { pos: 2.0,  w: 0.9 },  // → living
    { pos: 5.96, w: 0.9 },  // → kitchen
    { pos: 8.51, w: 0.8 },  // → utility
  ], wm);

  // Living | Kitchen+Bathroom (x=4.00)
  vWall(4.00, 5.71, 11.20, H, [{ pos: 7.50, w: 0.9 }], wm);

  // Kitchen | Bathroom (z=8.36)
  hWall(8.36, 4.00, 7.68, H, [{ pos: 5.96, w: 0.7 }], wmLight);

  // Kitchen+Bath | Utility (x=7.68)
  vWall(7.68, 5.71, 11.20, H, [{ pos: 7.2, w: 0.7 }], wm);
}

// ── Room labels (sprite) ──
function buildLabels() {
  for (const room of ROOMS) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    ctx.fillStyle = 'rgba(0,0,0,0.0)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#c8a96e';
    ctx.font = '600 26px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(room.name, 128, 32);

    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(room.x + room.w / 2, 2.6, room.z + room.d / 2);
    sprite.scale.set(2.5, 0.625, 1);
    sprite.name = `label_${room.id}`;
    scene.add(sprite);
  }
}

// ── Public build entry ──
export function buildApartment() {
  buildFloors();
  buildCeilings();
  buildWalls();
  buildBaseboards();
  buildDoorFrames();
  buildWindows();
  buildDoorPanels();
  buildStaircase();
  buildLabels();
}
