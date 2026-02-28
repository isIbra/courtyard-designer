import * as THREE from 'three';
import { scene, renderer, camera, initLights, updateSun, resize, composer, initPostProcessing } from './modules/scene.js';
import { setCeilingsVisible, buildRoomFloors, applyFloorTexture } from './modules/apartment.js';
import { initOrbit, updateControls, onWalkMouseMove, onKeyDown, onKeyUp, viewMode } from './modules/controls.js';
import { initPersistence, loadFloorMaterials, loadFromServer, setUsername, syncToServer } from './modules/persistence.js';
import { initUI, toast, refreshFurnitureGrid } from './modules/ui.js';
import { drawMinimap } from './modules/minimap.js';
import { preloadModels } from './modules/furniture.js';
import { initDesignerAPI } from './modules/designer-api.js';
import { initGizmo, shouldBypassPostProcessing } from './modules/gizmo.js';

const USERNAME_KEY = 'courtyard-designer-username';

// ── Login flow ──
function showLogin() {
  const overlay = document.getElementById('login-overlay');
  const form = document.getElementById('login-form');
  const input = document.getElementById('login-input');

  overlay.classList.remove('hidden');
  input.focus();

  return new Promise((resolve) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      localStorage.setItem(USERNAME_KEY, name);
      overlay.classList.add('hidden');
      resolve(name);
    }, { once: true });
  });
}

function setupSignout() {
  const btn = document.getElementById('btn-signout');
  const userEl = document.getElementById('toolbar-user');
  const username = localStorage.getItem(USERNAME_KEY);

  if (username) {
    userEl.textContent = username;
    btn.style.display = '';
  }

  btn.addEventListener('click', () => {
    localStorage.removeItem(USERNAME_KEY);
    location.reload();
  });
}

// ── Init ──
async function init() {
  // Check for existing username or show login
  let username = localStorage.getItem(USERNAME_KEY);
  if (!username) {
    username = await showLogin();
  } else {
    document.getElementById('login-overlay').classList.add('hidden');
  }

  setUsername(username);
  setupSignout();

  resize();
  initLights();
  initPostProcessing();
  initOrbit();
  initGizmo();
  initUI();
  updateSun(0.65);
  preloadModels();
  refreshFurnitureGrid();

  // Start in orbit — hide ceilings
  setCeilingsVisible(false);

  // Try loading from server first
  const serverLoaded = await loadFromServer(username);

  // Load walls + furniture + floor tiles + stairs from IndexedDB
  const result = await initPersistence();
  toast(`Loaded ${result.wallCount} walls, ${result.floorTileCount} floors`);

  // Build courtyard floor (always present)
  buildRoomFloors();

  // Restore saved floor materials
  const savedFloors = await loadFloorMaterials();
  for (const [roomId, texType] of Object.entries(savedFloors)) {
    applyFloorTexture(roomId, texType);
  }

  // If this is a brand new user (no server data), sync seed state up
  if (!serverLoaded) {
    syncToServer(username);
  }

  // Initialize designer API (spatial index + WS client for MCP)
  initDesignerAPI();

  // Walk mode mouse
  document.addEventListener('mousemove', (e) => {
    if (viewMode === 'walk') onWalkMouseMove(e);
  });

  // Walk mode keys
  document.addEventListener('keydown', (e) => onKeyDown(e.key));
  document.addEventListener('keyup', (e) => onKeyUp(e.key));

  // Resize handler
  window.addEventListener('resize', resize);
}

// ── Render loop ──
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  updateControls(dt);
  // Skip post-processing when gizmo is active — the built-in Three.js
  // EffectComposer swallows TransformControls' depthTest:false materials.
  // Direct rendering makes the gizmo arrows visible.
  if (composer && !shouldBypassPostProcessing()) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
  drawMinimap();
}

init().then(() => animate());
