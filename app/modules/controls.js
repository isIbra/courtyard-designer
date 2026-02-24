import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { camera, renderer } from './scene.js';
import { setCeilingsVisible, wallMeshes } from './apartment.js';
import { getCurrentFloor, getYBase, switchFloor, FLOOR_HEIGHT, getFloorCount } from './floor-manager.js';
import { stairRecords } from './stair-builder.js';

// ── State ──
export let viewMode = 'orbit';
let orbitControls = null;

// Walk state
const walkState = {
  yaw: Math.PI,
  pitch: 0,
  pos: new THREE.Vector3(4, 1.7, 5),
  forward: false,
  backward: false,
  left: false,
  right: false,
  locked: false,
  targetY: 1.7,
};

const WALK_SPEED = 4.5;
const MOUSE_SENS = 0.002;
const COLLISION_DIST = 0.4;
const MAX_DT = 0.1;
const EYE_HEIGHT = 1.7;
const Y_LERP_SPEED = 8.0; // smooth Y transition speed
const _ray = new THREE.Raycaster();

// ── Orbit ──
export function initOrbit() {
  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.target.set(24, 0, 16);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.08;
  orbitControls.maxPolarAngle = Math.PI / 2.05;
  orbitControls.minDistance = 5;
  orbitControls.maxDistance = 80;
  orbitControls.update();
}

// ── Switch view ──
export function setViewMode(mode) {
  viewMode = mode;

  const crosshair = document.getElementById('crosshair');
  crosshair.style.display = mode === 'walk' ? 'block' : 'none';

  if (orbitControls) orbitControls.enabled = (mode === 'orbit');

  // Ceilings: only show in walk mode
  setCeilingsVisible(mode === 'walk');

  if (mode === 'orbit') {
    camera.up.set(0, 1, 0);
    camera.position.set(-5, 35, -5);
    orbitControls.target.set(24, 0, 16);
    orbitControls.update();
  }

  if (mode === 'walk') {
    const yBase = getYBase(getCurrentFloor());
    walkState.pos.set(20, yBase + EYE_HEIGHT, 17);
    walkState.targetY = yBase + EYE_HEIGHT;
    walkState.yaw = Math.PI;
    walkState.pitch = 0;
  }

  if (mode === 'top') {
    camera.position.set(24, 55, 16);
    camera.up.set(0, 0, -1);
    camera.lookAt(24, 0, 16);
    if (orbitControls) orbitControls.enabled = false;
  }

  // Unlock pointer if leaving walk
  if (mode !== 'walk' && walkState.locked) {
    document.exitPointerLock();
  }
}

// ── Walk pointer lock ──
export function requestPointerLock() {
  if (viewMode === 'walk') {
    renderer.domElement.requestPointerLock();
  }
}

document.addEventListener('pointerlockchange', () => {
  walkState.locked = document.pointerLockElement === renderer.domElement;
});

// ── Walk mouse ──
export function onWalkMouseMove(e) {
  if (!walkState.locked) return;
  walkState.yaw += e.movementX * MOUSE_SENS;
  walkState.pitch -= e.movementY * MOUSE_SENS;
  walkState.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, walkState.pitch));
}

// ── Walk keyboard ──
export function onKeyDown(key) {
  const k = key.toLowerCase();
  if (k === 'w') walkState.forward = true;
  if (k === 's') walkState.backward = true;
  if (k === 'a') walkState.left = true;
  if (k === 'd') walkState.right = true;
}

export function onKeyUp(key) {
  const k = key.toLowerCase();
  if (k === 'w') walkState.forward = false;
  if (k === 's') walkState.backward = false;
  if (k === 'a') walkState.left = false;
  if (k === 'd') walkState.right = false;
}

/** Check if position is on a stair and return the Y height */
function getStairY(x, z) {
  for (const rec of stairRecords.values()) {
    const fromY = getYBase(rec.fromFloor);
    const w = rec.width || 1.0;
    const len = rec.length || 3.0;

    let progress = -1;
    let onStair = false;

    switch (rec.direction) {
      case 'north':
        if (Math.abs(x - rec.x) < w / 2 && z <= rec.z && z >= rec.z - len) {
          progress = (rec.z - z) / len;
          onStair = true;
        }
        break;
      case 'south':
        if (Math.abs(x - rec.x) < w / 2 && z >= rec.z && z <= rec.z + len) {
          progress = (z - rec.z) / len;
          onStair = true;
        }
        break;
      case 'east':
        if (Math.abs(z - rec.z) < w / 2 && x >= rec.x && x <= rec.x + len) {
          progress = (x - rec.x) / len;
          onStair = true;
        }
        break;
      case 'west':
        if (Math.abs(z - rec.z) < w / 2 && x <= rec.x && x >= rec.x - len) {
          progress = (rec.x - x) / len;
          onStair = true;
        }
        break;
    }

    if (onStair && progress >= 0 && progress <= 1) {
      return fromY + progress * FLOOR_HEIGHT + EYE_HEIGHT;
    }
  }

  return null;
}

// ── Update (called each frame) ──
export function updateControls(dt) {
  if (viewMode === 'orbit' && orbitControls) {
    orbitControls.update();
  }

  if (viewMode === 'walk') {
    dt = Math.min(dt, MAX_DT);

    const fwd = new THREE.Vector3(Math.sin(walkState.yaw), 0, -Math.cos(walkState.yaw));
    const rgt = new THREE.Vector3(Math.cos(walkState.yaw), 0, Math.sin(walkState.yaw));

    const dir = new THREE.Vector3();
    if (walkState.forward) dir.add(fwd);
    if (walkState.backward) dir.sub(fwd);
    if (walkState.right) dir.add(rgt);
    if (walkState.left) dir.sub(rgt);

    if (dir.lengthSq() > 0) {
      dir.normalize();
      const step = dir.multiplyScalar(WALK_SPEED * dt);

      // Collision: test X and Z axes independently (only against walls on current and adjacent floors)
      const currentFloor = getCurrentFloor();
      const relevantWalls = wallMeshes.filter((m) => {
        const f = m.userData.floor || 0;
        return f === currentFloor || f === currentFloor - 1 || f === currentFloor + 1;
      });

      const origin = new THREE.Vector3(walkState.pos.x, walkState.pos.y - 0.7, walkState.pos.z);

      if (Math.abs(step.x) > 0.001) {
        _ray.set(origin, new THREE.Vector3(Math.sign(step.x), 0, 0));
        _ray.far = Math.abs(step.x) + COLLISION_DIST;
        const hitsX = _ray.intersectObjects(relevantWalls);
        if (hitsX.length > 0 && hitsX[0].distance < Math.abs(step.x) + COLLISION_DIST) {
          step.x = 0;
        }
      }

      if (Math.abs(step.z) > 0.001) {
        _ray.set(origin, new THREE.Vector3(0, 0, Math.sign(step.z)));
        _ray.far = Math.abs(step.z) + COLLISION_DIST;
        const hitsZ = _ray.intersectObjects(relevantWalls);
        if (hitsZ.length > 0 && hitsZ[0].distance < Math.abs(step.z) + COLLISION_DIST) {
          step.z = 0;
        }
      }

      walkState.pos.x += step.x;
      walkState.pos.z += step.z;
    }

    // Y position: check for stairs, otherwise use floor base
    const stairY = getStairY(walkState.pos.x, walkState.pos.z);
    if (stairY !== null) {
      walkState.targetY = stairY;
    } else {
      walkState.targetY = getYBase(getCurrentFloor()) + EYE_HEIGHT;
    }

    // Smooth Y transition
    walkState.pos.y += (walkState.targetY - walkState.pos.y) * Math.min(1, Y_LERP_SPEED * dt);

    // Auto-switch floor when reaching stair top/bottom
    const currentFloor = getCurrentFloor();
    const currentYBase = getYBase(currentFloor);
    const aboveYBase = getYBase(currentFloor + 1);
    const belowYBase = currentFloor > 0 ? getYBase(currentFloor - 1) : 0;

    if (currentFloor + 1 < getFloorCount() && walkState.pos.y > aboveYBase + EYE_HEIGHT - 0.3) {
      switchFloor(currentFloor + 1);
    } else if (currentFloor > 0 && walkState.pos.y < currentYBase + EYE_HEIGHT - 0.3) {
      switchFloor(currentFloor - 1);
    }

    camera.position.copy(walkState.pos);
    const look = new THREE.Vector3(
      Math.sin(walkState.yaw) * Math.cos(walkState.pitch),
      Math.sin(walkState.pitch),
      -Math.cos(walkState.yaw) * Math.cos(walkState.pitch),
    );
    camera.lookAt(camera.position.clone().add(look));
    camera.up.set(0, 1, 0);

    // Update position display during walk mode
    const posInfo = document.getElementById('pos-info');
    if (posInfo) {
      posInfo.textContent = `X:${walkState.pos.x.toFixed(1)} Z:${walkState.pos.z.toFixed(1)} F:${getCurrentFloor()}`;
    }
  }

  if (viewMode === 'top') {
    // allow scroll zoom in top mode — handled by wheel event
  }
}

// ── Top view zoom ──
export function onTopZoom(deltaY) {
  if (viewMode === 'top') {
    camera.position.y = Math.max(10, Math.min(100, camera.position.y + deltaY * 0.02));
    camera.lookAt(24, 0, 16);
  }
}
