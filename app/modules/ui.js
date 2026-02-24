import { CATALOG, createMesh, placeItem, removeItem, placed } from './furniture.js';
import { ROOMS } from './apartment.js';
import { setViewMode, viewMode, requestPointerLock, onTopZoom } from './controls.js';
import { saveState, resetState, autoSave } from './persistence.js';
import { camera, renderer, updateSun } from './scene.js';
import { scene } from './scene.js';
import { toggleWallBuildMode, isBuildMode, onWallClick, onWallMouseMove, onWallSelect, onWallKeyDown, deselectWall } from './wall-builder.js';
import * as THREE from 'three';

// ── State ──
let selectedType = null;
let ghostMesh = null;
let selectedObj = null;
let activeCategory = 'all';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// ── Toast ──
export function toast(msg) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

// ── Populate furniture grid ──
function buildFurnitureGrid() {
  const grid = document.getElementById('furniture-grid');
  grid.innerHTML = '';

  const items = activeCategory === 'all'
    ? CATALOG
    : CATALOG.filter((c) => c.cat === activeCategory);

  for (const item of items) {
    const div = document.createElement('div');
    div.className = 'furniture-item';
    if (selectedType === item.id) div.classList.add('selected');
    div.dataset.id = item.id;
    div.innerHTML = `
      <div class="icon">${item.icon}</div>
      <div class="name">${item.name}</div>
      <div class="dims">${item.w}×${item.d}m</div>
    `;
    div.addEventListener('click', () => selectFurniture(item.id));
    grid.appendChild(div);
  }
}

// ── Category bar ──
function buildCategoryBar() {
  const bar = document.getElementById('category-bar');
  const cats = ['all', 'bedroom', 'living', 'kitchen', 'bathroom', 'outdoor'];

  for (const cat of cats) {
    const btn = document.createElement('button');
    btn.className = 'cat-btn' + (cat === activeCategory ? ' active' : '');
    btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    btn.addEventListener('click', () => {
      activeCategory = cat;
      document.querySelectorAll('.cat-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      buildFurnitureGrid();
    });
    bar.appendChild(btn);
  }
}

// ── Room list ──
function buildRoomList() {
  const list = document.getElementById('room-list');
  const allRooms = [...ROOMS, { id: 'courtyard', name: 'Courtyard', x: 9.10, z: 0, w: 6.91, d: 11.20 }];

  for (const room of allRooms) {
    const div = document.createElement('div');
    div.className = 'room-item';
    div.innerHTML = `
      <span class="room-name">${room.name}</span>
      <span class="room-dims">${room.w.toFixed(1)}×${room.d.toFixed(1)}m</span>
    `;
    div.addEventListener('click', () => {
      // Fly camera to room
      setViewMode('orbit');
      document.querySelectorAll('.view-btn').forEach((b) => b.classList.remove('active'));
      document.querySelector('[data-view="orbit"]').classList.add('active');
      camera.position.set(room.x + room.w / 2 - 3, 8, room.z + room.d / 2 - 3);
    });
    list.appendChild(div);
  }
}

// ── Material panel ──
function buildMaterialPanel() {
  const panel = document.getElementById('material-panel');
  const allRooms = [...ROOMS, { id: 'courtyard', name: 'Courtyard' }];

  const floorColors = ['#a69882', '#8B7355', '#D2C4A8', '#556B2F', '#4a4a4a', '#C19A6B', '#d0d0d5'];

  for (const room of allRooms) {
    const section = document.createElement('div');
    section.className = 'mat-section';
    section.innerHTML = `<div class="mat-section-title">${room.name}</div>`;

    // Floor colors
    const floorLabel = document.createElement('div');
    floorLabel.className = 'mat-label';
    floorLabel.textContent = 'Floor';
    section.appendChild(floorLabel);

    const floorRow = document.createElement('div');
    floorRow.className = 'swatch-row';
    for (const color of floorColors) {
      const swatch = document.createElement('div');
      swatch.className = 'swatch';
      swatch.style.background = color;
      swatch.addEventListener('click', () => {
        const floorMesh = scene.getObjectByName(`floor_${room.id}`) ||
                          scene.getObjectByName('courtyard_floor');
        if (floorMesh) floorMesh.material.color.setStyle(color);
        autoSave();
      });
      floorRow.appendChild(swatch);
    }
    section.appendChild(floorRow);

    panel.appendChild(section);
  }
}

// ── Select furniture type ──
function selectFurniture(id) {
  // Exit wall build mode if active
  if (isBuildMode()) toggleWallBuildMode();

  if (selectedType === id) {
    // Deselect
    selectedType = null;
    if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
    buildFurnitureGrid();
    return;
  }

  selectedType = id;
  buildFurnitureGrid();

  if (ghostMesh) scene.remove(ghostMesh);
  ghostMesh = createMesh(id, true);
  ghostMesh.visible = false;
  scene.add(ghostMesh);
}

// ── Deselect all ──
function deselectAll() {
  selectedType = null;
  selectedObj = null;
  if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
  deselectWall();
  document.getElementById('selection-bar').style.display = 'none';
  buildFurnitureGrid();
}

// ── Floor intersection ──
function getFloorHit(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pt = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, pt);
  return pt;
}

// ── Init all UI ──
export function initUI() {
  buildCategoryBar();
  buildFurnitureGrid();
  buildRoomList();
  buildMaterialPanel();

  // View mode buttons
  document.querySelectorAll('.view-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.view;
      document.querySelectorAll('.view-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      setViewMode(mode);
    });
  });

  // Sidebar tabs
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // Sun slider
  const sunSlider = document.getElementById('sun-slider');
  if (sunSlider) {
    sunSlider.addEventListener('input', (e) => {
      updateSun(e.target.value / 100);
    });
  }

  // Wall tool button
  const wallBtn = document.getElementById('btn-wall');
  if (wallBtn) {
    wallBtn.addEventListener('click', () => {
      const on = toggleWallBuildMode();
      if (on) {
        // Deselect furniture when entering wall mode
        selectedType = null;
        if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
        buildFurnitureGrid();
      }
      toast(on ? 'Wall tool ON' : 'Wall tool OFF');
    });
  }

  // Save / Reset
  document.getElementById('btn-save').addEventListener('click', () => {
    saveState();
    toast('Saved');
  });

  document.getElementById('btn-undo').addEventListener('click', () => {
    if (placed.length > 0) {
      removeItem(placed[placed.length - 1]);
      autoSave();
      toast('Undone');
    }
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Reset all walls and furniture?')) {
      resetState();
      toast('Reset complete');
    }
  });

  // ── Viewport events ──
  const vp = renderer.domElement;

  vp.addEventListener('click', (e) => {
    if (viewMode === 'walk') {
      requestPointerLock();
      return;
    }

    // Wall build mode takes priority
    if (isBuildMode()) {
      onWallClick(e);
      return;
    }

    // Furniture placement
    if (selectedType) {
      const pt = getFloorHit(e);
      if (pt) {
        const rot = ghostMesh ? ghostMesh.rotation.y : 0;
        placeItem(selectedType, pt.x, pt.z, rot);
        autoSave();
        toast(`Placed ${selectedType}`);
      }
      return;
    }

    // Wall selection (try first, before furniture)
    if (onWallSelect(e)) return;

    // Select placed furniture object
    const rect = vp.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const meshes = placed.flatMap((g) => {
      const children = [];
      g.traverse((c) => { if (c.isMesh) children.push(c); });
      return children;
    });

    const hits = raycaster.intersectObjects(meshes);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj.parent && !obj.userData.furnitureId) obj = obj.parent;
      if (obj.userData.furnitureId) {
        selectedObj = obj;
        const bar = document.getElementById('selection-bar');
        bar.textContent = `${obj.userData.furnitureId} — [R] rotate  [Del] remove`;
        bar.style.display = 'block';
      }
    } else {
      selectedObj = null;
      document.getElementById('selection-bar').style.display = 'none';
    }
  });

  vp.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (ghostMesh) ghostMesh.rotation.y += Math.PI / 4;
    if (selectedObj) {
      selectedObj.rotation.y += Math.PI / 4;
      autoSave();
    }
  });

  vp.addEventListener('mousemove', (e) => {
    // Wall builder ghost preview
    onWallMouseMove(e);

    // Furniture ghost preview
    if (ghostMesh && selectedType) {
      const pt = getFloorHit(e);
      if (pt) {
        ghostMesh.position.x = Math.round(pt.x / 0.25) * 0.25;
        ghostMesh.position.z = Math.round(pt.z / 0.25) * 0.25;
        ghostMesh.visible = true;
      }
    }

    // Position display
    const pt = getFloorHit(e);
    if (pt) {
      document.getElementById('pos-info').textContent = `X:${pt.x.toFixed(1)} Z:${pt.z.toFixed(1)}`;
    }
  });

  vp.addEventListener('wheel', (e) => {
    onTopZoom(e.deltaY);
  });

  // ── Keyboard ──
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const sidebar = document.getElementById('sidebar');
      const vp = document.getElementById('viewport');
      sidebar.classList.toggle('hidden');
      vp.classList.toggle('fullwidth');
      setTimeout(() => window.dispatchEvent(new Event('resize')), 350);
    }

    // W toggles wall mode (only when not in walk mode)
    if ((e.key === 'w' || e.key === 'W') && viewMode !== 'walk') {
      const on = toggleWallBuildMode();
      if (on) {
        selectedType = null;
        if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
        buildFurnitureGrid();
      }
      toast(on ? 'Wall tool ON' : 'Wall tool OFF');
      return;
    }

    // Wall builder key handlers (Escape, Delete)
    if (onWallKeyDown(e.key)) return;

    if (e.key === 'Escape') deselectAll();

    if (e.key === 'r' || e.key === 'R') {
      if (ghostMesh) ghostMesh.rotation.y += Math.PI / 4;
      if (selectedObj) {
        selectedObj.rotation.y += Math.PI / 4;
        autoSave();
      }
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedObj) {
        removeItem(selectedObj);
        selectedObj = null;
        document.getElementById('selection-bar').style.display = 'none';
        autoSave();
        toast('Removed');
      }
    }
  });

  // Hide controls hint after 6s
  setTimeout(() => {
    const hint = document.getElementById('controls-hint');
    hint.style.opacity = '0';
    setTimeout(() => (hint.style.display = 'none'), 500);
  }, 6000);
}
