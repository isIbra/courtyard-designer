import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { camera, renderer } from './scene.js';
import { setCeilingsVisible, wallMeshes } from './apartment.js';

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
};

const WALK_SPEED = 4.5;
const MOUSE_SENS = 0.002;
const COLLISION_DIST = 0.4;
const MAX_DT = 0.1;
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
    walkState.pos.set(20, 1.7, 17);
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

// ── Update (called each frame) ──
export function updateControls(dt) {
  if (viewMode === 'orbit' && orbitControls) {
    orbitControls.update();
  }

  if (viewMode === 'walk') {
    dt = Math.min(dt, MAX_DT);

    // Forward/right vectors derived from yaw (must match look direction)
    const fwd = new THREE.Vector3(Math.sin(walkState.yaw), 0, -Math.cos(walkState.yaw));
    const rgt = new THREE.Vector3(Math.cos(walkState.yaw), 0, Math.sin(walkState.yaw));

    const dir = new THREE.Vector3();
    if (walkState.forward) dir.add(fwd);
    if (walkState.backward) dir.sub(fwd);
    if (walkState.right) dir.add(rgt);
    if (walkState.left) dir.sub(rgt);
    if (dir.lengthSq() === 0) {
      // No movement — just update camera look
    } else {
      dir.normalize();
      const step = dir.multiplyScalar(WALK_SPEED * dt);

      // Collision: test X and Z axes independently
      const origin = new THREE.Vector3(walkState.pos.x, 1.0, walkState.pos.z);

      // Test X movement
      if (Math.abs(step.x) > 0.001) {
        _ray.set(origin, new THREE.Vector3(Math.sign(step.x), 0, 0));
        _ray.far = Math.abs(step.x) + COLLISION_DIST;
        const hitsX = _ray.intersectObjects(wallMeshes);
        if (hitsX.length > 0 && hitsX[0].distance < Math.abs(step.x) + COLLISION_DIST) {
          step.x = 0;
        }
      }

      // Test Z movement
      if (Math.abs(step.z) > 0.001) {
        _ray.set(origin, new THREE.Vector3(0, 0, Math.sign(step.z)));
        _ray.far = Math.abs(step.z) + COLLISION_DIST;
        const hitsZ = _ray.intersectObjects(wallMeshes);
        if (hitsZ.length > 0 && hitsZ[0].distance < Math.abs(step.z) + COLLISION_DIST) {
          step.z = 0;
        }
      }

      walkState.pos.add(step);
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
      posInfo.textContent = `X:${walkState.pos.x.toFixed(1)} Z:${walkState.pos.z.toFixed(1)}`;
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
