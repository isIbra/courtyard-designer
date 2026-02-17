import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { camera, renderer } from './scene.js';
import { setCeilingsVisible } from './apartment.js';

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

// ── Orbit ──
export function initOrbit() {
  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.target.set(4.5, 0, 5.5);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.08;
  orbitControls.maxPolarAngle = Math.PI / 2.05;
  orbitControls.minDistance = 3;
  orbitControls.maxDistance = 40;
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
    camera.position.set(-4, 14, -4);
    orbitControls.target.set(4.5, 0, 5.5);
    orbitControls.update();
  }

  if (mode === 'walk') {
    walkState.pos.set(4, 1.7, 5);
    walkState.yaw = Math.PI;
    walkState.pitch = 0;
  }

  if (mode === 'top') {
    camera.position.set(8, 25, 5.5);
    camera.up.set(0, 0, -1);
    camera.lookAt(8, 0, 5.5);
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
  walkState.yaw -= e.movementX * MOUSE_SENS;
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
    const dir = new THREE.Vector3();
    if (walkState.forward) dir.z -= 1;
    if (walkState.backward) dir.z += 1;
    if (walkState.left) dir.x -= 1;
    if (walkState.right) dir.x += 1;
    dir.normalize();

    const euler = new THREE.Euler(0, walkState.yaw, 0, 'YXZ');
    dir.applyEuler(euler);
    walkState.pos.add(dir.multiplyScalar(WALK_SPEED * dt));

    camera.position.copy(walkState.pos);
    const look = new THREE.Vector3(
      Math.sin(walkState.yaw) * Math.cos(walkState.pitch),
      Math.sin(walkState.pitch),
      -Math.cos(walkState.yaw) * Math.cos(walkState.pitch),
    );
    camera.lookAt(camera.position.clone().add(look));
    camera.up.set(0, 1, 0);
  }

  if (viewMode === 'top') {
    // allow scroll zoom in top mode — handled by wheel event
  }
}

// ── Top view zoom ──
export function onTopZoom(deltaY) {
  if (viewMode === 'top') {
    camera.position.y = Math.max(5, Math.min(50, camera.position.y + deltaY * 0.02));
    camera.lookAt(8, 0, 5.5);
  }
}
