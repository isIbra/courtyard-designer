import * as THREE from 'three';
import { scene, renderer, camera, initLights, updateSun, resize, composer, initPostProcessing } from './modules/scene.js';
import { setCeilingsVisible, buildRoomFloors, applyFloorTexture, setRooms } from './modules/apartment.js';
import { initOrbit, updateControls, onWalkMouseMove, onKeyDown, onKeyUp, viewMode } from './modules/controls.js';
import { initPersistence, loadFloorMaterials, loadFromServer, setUsername, syncToServer } from './modules/persistence.js';
import { initUI, toast, refreshFurnitureGrid } from './modules/ui.js';
import { drawMinimap } from './modules/minimap.js';
import { preloadModels } from './modules/furniture.js';
import { initDesignerAPI } from './modules/designer-api.js';
import { initGizmo, shouldBypassPostProcessing } from './modules/gizmo.js';
import { getMeta } from './modules/db.js';

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

// ── Template picker ──
function showTemplatePicker(username) {
  return new Promise(async (resolve) => {
    const overlay = document.getElementById('template-overlay');
    overlay.classList.remove('hidden');

    // Fetch templates
    let templates = [];
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      templates = data.templates || [];
    } catch (err) {
      console.warn('Failed to fetch templates:', err);
    }

    const list = document.getElementById('template-list');
    list.innerHTML = '';

    // Template buttons
    for (const tpl of templates) {
      const btn = document.createElement('button');
      btn.className = 'template-option';
      btn.innerHTML = `
        <span class="template-option-name">${tpl.name}</span>
        <span class="template-option-desc">Use as starting point</span>
      `;
      list.appendChild(btn);

      btn.addEventListener('click', async () => {
        overlay.classList.add('hidden');
        try {
          const res = await fetch(`/api/templates/${tpl.id}/clone`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
          });
          const data = await res.json();
          if (data.ok) {
            await loadFromServer(username);
          }
        } catch (err) {
          console.warn('Template clone failed:', err);
        }
        resolve();
      });
    }

    // "Start Empty" button
    const emptyBtn = document.createElement('button');
    emptyBtn.className = 'template-option';
    emptyBtn.innerHTML = `
      <span class="template-option-name">Start Empty</span>
      <span class="template-option-desc">Begin with a blank canvas</span>
    `;
    list.appendChild(emptyBtn);

    emptyBtn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      resolve();
    });
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

  // 1) Load from server first (populates IDB as cache)
  const serverLoaded = await loadFromServer(username);

  // 2) If new user, show template picker
  if (!serverLoaded) {
    await showTemplatePicker(username);
  }

  // 3) Load rooms from IDB meta → set dynamic ROOMS
  const roomsRec = await getMeta('rooms');
  if (roomsRec && roomsRec.value && roomsRec.value.length > 0) {
    setRooms(roomsRec.value);
  }

  // 4) Init UI (needs ROOMS populated)
  initUI();
  updateSun(0.65);
  preloadModels();
  refreshFurnitureGrid();

  // Start in orbit — hide ceilings
  setCeilingsVisible(false);

  // 5) Load walls + furniture + floor tiles + stairs from IDB cache
  const result = await initPersistence();
  toast(`Loaded ${result.wallCount} walls, ${result.floorTileCount} floors`);

  // Build courtyard floor (always present)
  buildRoomFloors();

  // Restore saved floor materials
  const savedFloors = await loadFloorMaterials();
  for (const [roomId, texType] of Object.entries(savedFloors)) {
    applyFloorTexture(roomId, texType);
  }

  // If brand new user with no server data & chose empty, sync empty state up
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
