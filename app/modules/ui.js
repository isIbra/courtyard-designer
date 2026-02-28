import { CATALOG, createMesh, placeItem, removeItem, placed, thumbnails, generateThumbnail } from './furniture.js';
import { ROOMS, WALL_COLOR_PALETTE, setWallColor, getWallColor, setIndividualWallColor, wallMeshes } from './apartment.js';
import { setViewMode, viewMode, requestPointerLock, onTopZoom } from './controls.js';
import { saveState, resetState, autoSave, saveFloorMaterial, saveWallColor } from './persistence.js';
import { camera, renderer, updateSun } from './scene.js';
import { scene } from './scene.js';
import { toggleWallBuildMode, isBuildMode, onWallClick, onWallMouseMove, onWallSelect, onWallKeyDown, deselectWall, copyFloorLayoutUp, isOpeningSubMode } from './wall-builder.js';
import { createProceduralTexture, TEXTURE_TYPES, TEXTURE_NAMES, TEXTURE_SWATCH_COLORS } from './textures.js';
import { getCurrentFloor, switchFloor, addFloor, getFloors, getFloorCount, setOnFloorChange, getYBase } from './floor-manager.js';
import { toggleFloorBuildMode, isFloorBuildMode, onFloorClick, onFloorMouseMove, onFloorSelect, onFloorKeyDown, deselectTile, applyTileTexture, getSelectedTileId, floorTileRecords } from './floor-builder.js';
import { toggleStairBuildMode, isStairBuildMode, onStairClick, onStairMouseMove, onStairSelect, onStairKeyDown, deselectStair, rotateStairDirection, updateStairVisibility } from './stair-builder.js';
import { onSelectionClick, onBoxSelectStart, onBoxSelectMove, onBoxSelectEnd, onSelectionKeyDown, clearSelection, getSelected, getSelectedCount, highlightObj, unhighlightObj } from './selection.js';
import { createGridOverlay, toggleGridVisible, updateGridFloor, showLowerFloorGhosts, clearLowerFloorGhosts } from './grid.js';
import { removeWallById, wallMeshMap, addWallFromRecord } from './apartment.js';
import { wallRecords, deleteSelectedWall, getSelectedWallId } from './wall-builder.js';
import { removeFloorTile, addFloorTile, floorTileMeshes } from './floor-builder.js';
import { removeStair, addStair, stairMeshes, stairRecords } from './stair-builder.js';
import { deleteWall as dbDeleteWall, deleteFloorTile as dbDeleteTile, deleteStair as dbDeleteStair, putWall, putFloorTile, putStair } from './db.js';
import { undo as historyUndo, redo as historyRedo, pushAction } from './history.js';
import { attachGizmo, detachGizmo, toggleGizmoMode, isGizmoActive, isDragging, shouldSuppressClick, getAttached, getGizmoMode } from './gizmo.js';
import * as THREE from 'three';

// ── State ──
let selectedType = null;
let ghostMesh = null;
let selectedObj = null;
let activeCategory = 'all';
let activeSources = { kenney: true, ikea: true, polyhaven: true }; // toggle filters for asset sources
let furnitureSearch = '';
let eraserMode = false;
let furnitureMoveMode = false;
let paintMode = false;
let activePaintColor = '#EBE0D0';

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

// ── Get source from model path ──
function getItemSource(item) {
  if (!item.model) return 'kenney';
  if (item.model.startsWith('ikea/')) return 'ikea';
  if (item.model.startsWith('polyhaven/')) return 'polyhaven';
  return 'kenney';
}

// ── Populate furniture grid (paginated + lazy thumbnails) ──
const PAGE_SIZE = 30;
let currentFilteredItems = [];
let renderedCount = 0;
let gridObserver = null;

function getFilteredItems() {
  let items = activeCategory === 'all'
    ? CATALOG
    : CATALOG.filter((c) => c.cat === activeCategory);
  items = items.filter((c) => activeSources[getItemSource(c)]);
  if (furnitureSearch) {
    const q = furnitureSearch.toLowerCase();
    items = items.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }
  return items;
}

function renderItemCard(item) {
  const div = document.createElement('div');
  div.className = 'furniture-item';
  if (selectedType === item.id) div.classList.add('selected');
  div.dataset.id = item.id;
  const source = getItemSource(item);
  const sourceLabels = { ikea: '<span class="source-tag ikea">IKEA</span>', polyhaven: '<span class="source-tag polyhaven">PolyHaven</span>', kenney: '<span class="source-tag kenney">Kenney</span>' };
  const sourceTag = sourceLabels[source] || sourceLabels.kenney;
  const thumb = thumbnails.get(item.id);
  if (thumb) {
    div.innerHTML = `
      <img class="thumb" src="${thumb}" alt="${item.name}" draggable="false">
      <div class="name">${item.name}</div>
      <div class="item-meta"><span class="dims">${item.w}×${item.d}m</span>${sourceTag}</div>
    `;
  } else {
    const catIcons = { bedroom: '🛏️', living: '🛋️', kitchen: '🍽️', bathroom: '🚿', office: '🖥️', outdoor: '🌿' };
    const icon = item.icon || catIcons[item.cat] || '📦';
    div.innerHTML = `
      <div class="icon">${icon}</div>
      <div class="name">${item.name}</div>
      <div class="item-meta"><span class="dims">${item.w}×${item.d}m</span>${sourceTag}</div>
    `;
    // Lazy-load thumbnail
    generateThumbnail(item.id).then(url => {
      if (url && div.isConnected) {
        const iconEl = div.querySelector('.icon');
        if (iconEl) {
          const img = document.createElement('img');
          img.className = 'thumb';
          img.src = url;
          img.alt = item.name;
          img.draggable = false;
          iconEl.replaceWith(img);
        }
      }
    });
  }
  div.addEventListener('click', () => selectFurniture(item.id));
  return div;
}

function renderNextPage() {
  const grid = document.getElementById('furniture-grid');
  const end = Math.min(renderedCount + PAGE_SIZE, currentFilteredItems.length);
  for (let i = renderedCount; i < end; i++) {
    grid.appendChild(renderItemCard(currentFilteredItems[i]));
  }
  renderedCount = end;

  // Update or remove sentinel
  let sentinel = document.getElementById('grid-sentinel');
  if (renderedCount < currentFilteredItems.length) {
    if (!sentinel) {
      sentinel = document.createElement('div');
      sentinel.id = 'grid-sentinel';
      sentinel.style.height = '1px';
    }
    grid.appendChild(sentinel);
    observeSentinel(sentinel);
  } else if (sentinel) {
    sentinel.remove();
  }
}

function observeSentinel(sentinel) {
  if (gridObserver) gridObserver.disconnect();
  gridObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      gridObserver.disconnect();
      renderNextPage();
    }
  }, { root: document.getElementById('tab-furniture'), threshold: 0 });
  gridObserver.observe(sentinel);
}

function buildFurnitureGrid() {
  const grid = document.getElementById('furniture-grid');
  grid.innerHTML = '';
  if (gridObserver) { gridObserver.disconnect(); gridObserver = null; }

  currentFilteredItems = getFilteredItems();
  renderedCount = 0;

  const countEl = document.getElementById('furniture-count');
  if (countEl) countEl.textContent = `${currentFilteredItems.length} items`;

  renderNextPage();
}

// ── Category bar ──
function buildCategoryBar() {
  const bar = document.getElementById('category-bar');
  const cats = ['all', 'bedroom', 'living', 'kitchen', 'bathroom', 'office', 'outdoor'];

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

// ── Source filter bar + search ──
function buildSourceBar() {
  const container = document.getElementById('source-bar');
  if (!container) return;
  container.innerHTML = '';

  // Search input
  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'furniture-search';
  search.placeholder = 'Search...';
  search.value = furnitureSearch;
  search.addEventListener('input', (e) => {
    furnitureSearch = e.target.value.trim();
    buildFurnitureGrid();
  });
  container.appendChild(search);

  // Source toggles row
  const toggleRow = document.createElement('div');
  toggleRow.className = 'source-toggles';

  const sources = [
    { key: 'ikea', label: 'IKEA', desc: 'Realistic PBR' },
    { key: 'polyhaven', label: 'PolyHaven', desc: 'CC0 PBR' },
    { key: 'kenney', label: 'Kenney', desc: 'Low-poly CC0' },
  ];

  for (const src of sources) {
    const btn = document.createElement('button');
    btn.className = 'source-toggle' + (activeSources[src.key] ? ' active' : '');
    btn.innerHTML = `<span class="source-name">${src.label}</span><span class="source-desc">${src.desc}</span>`;
    btn.title = `Toggle ${src.label} assets`;
    btn.addEventListener('click', () => {
      activeSources[src.key] = !activeSources[src.key];
      // Ensure at least one source is active
      if (!activeSources.ikea && !activeSources.kenney && !activeSources.polyhaven) {
        activeSources[src.key] = true;
        return;
      }
      btn.classList.toggle('active', activeSources[src.key]);
      buildFurnitureGrid();
    });
    toggleRow.appendChild(btn);
  }

  container.appendChild(toggleRow);

  // Item count
  const count = document.createElement('span');
  count.className = 'furniture-count';
  count.id = 'furniture-count';
  container.appendChild(count);
}

// ── Room list ──
function buildRoomList() {
  const list = document.getElementById('room-list');
  const allRooms = [...ROOMS, { id: 'courtyard', name: 'Courtyard', x: 30.15, z: 2.49, w: 16.97, d: 28.64 }];

  for (const room of allRooms) {
    const div = document.createElement('div');
    div.className = 'room-item';
    div.innerHTML = `
      <span class="room-name">${room.name}</span>
      <span class="room-dims">${room.w.toFixed(1)}×${room.d.toFixed(1)}m</span>
    `;
    div.addEventListener('click', () => {
      setViewMode('orbit');
      document.querySelectorAll('.view-btn').forEach((b) => b.classList.remove('active'));
      document.querySelector('[data-view="orbit"]').classList.add('active');
      camera.position.set(room.x + room.w / 2 - 3, 8, room.z + room.d / 2 - 3);
    });
    list.appendChild(div);
  }
}

// ── Material panel with texture swatches ──
function buildMaterialPanel() {
  const panel = document.getElementById('material-panel');

  // Paint Brush toggle button at top
  const paintBtnWrap = document.createElement('div');
  paintBtnWrap.style.marginBottom = '12px';
  const paintToggle = document.createElement('button');
  paintToggle.className = 'tool-btn';
  paintToggle.id = 'btn-paint-panel';
  paintToggle.textContent = 'Paint Brush (P)';
  paintToggle.style.width = '100%';
  paintToggle.addEventListener('click', () => {
    const on = togglePaintMode();
    toast(on ? 'Paint mode ON — click walls to paint' : 'Paint mode OFF');
    paintToggle.classList.toggle('active', on);
    const toolbarPaintBtn = document.getElementById('btn-paint');
    if (toolbarPaintBtn) toolbarPaintBtn.classList.toggle('active', on);
  });
  paintBtnWrap.appendChild(paintToggle);
  panel.appendChild(paintBtnWrap);

  const allRooms = [...ROOMS, { id: 'courtyard', name: 'Courtyard' }];

  const floorTextures = TEXTURE_TYPES.filter(t => t !== 'plaster');

  for (const room of allRooms) {
    const section = document.createElement('div');
    section.className = 'mat-section';
    section.innerHTML = `<div class="mat-section-title">${room.name}</div>`;

    const floorLabel = document.createElement('div');
    floorLabel.className = 'mat-label';
    floorLabel.textContent = 'Floor';
    section.appendChild(floorLabel);

    const floorRow = document.createElement('div');
    floorRow.className = 'swatch-row';
    for (const texType of floorTextures) {
      const swatch = document.createElement('div');
      swatch.className = 'swatch';
      swatch.style.background = TEXTURE_SWATCH_COLORS[texType] || '#888';
      swatch.title = TEXTURE_NAMES[texType] || texType;
      swatch.addEventListener('click', () => {
        // If a floor tile is selected, apply texture to it
        const selTileId = getSelectedTileId();
        if (selTileId) {
          applyTileTexture(selTileId, texType);
          floorRow.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
          swatch.classList.add('active');
          autoSave();
          return;
        }

        // Check if this room has a seed floor tile
        const seedId = `ft_seed_${room.id}`;
        if (floorTileMeshes.has(seedId)) {
          applyTileTexture(seedId, texType);
          floorRow.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
          swatch.classList.add('active');
          saveFloorMaterial(room.id, texType);
          autoSave();
          return;
        }

        // Otherwise apply to pre-built room floor (courtyard)
        const floorMesh = scene.getObjectByName(`floor_${room.id}`);
        if (!floorMesh) return;

        const tex = createProceduralTexture(texType);
        const mat = floorMesh.material;

        let repeatX = 2, repeatZ = 2;
        if (room.id === 'courtyard') {
          repeatX = 6;
          repeatZ = 10;
        } else if (floorMesh.geometry.parameters) {
          repeatX = (floorMesh.geometry.parameters.width || 4) / 2;
          repeatZ = (floorMesh.geometry.parameters.height || 4) / 2;
        }

        const newMap = tex.map.clone();
        newMap.repeat.set(repeatX, repeatZ);
        newMap.wrapS = THREE.RepeatWrapping;
        newMap.wrapT = THREE.RepeatWrapping;
        newMap.needsUpdate = true;

        const newNormal = tex.normalMap.clone();
        newNormal.repeat.set(repeatX, repeatZ);
        newNormal.wrapS = THREE.RepeatWrapping;
        newNormal.wrapT = THREE.RepeatWrapping;
        newNormal.needsUpdate = true;

        mat.map = newMap;
        mat.normalMap = newNormal;
        mat.normalScale.set(0.3, 0.3);
        mat.roughness = tex.roughness;
        mat.color.setHex(0xffffff);
        mat.needsUpdate = true;

        floorRow.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');

        saveFloorMaterial(room.id, texType);
        autoSave();
      });
      floorRow.appendChild(swatch);
    }
    section.appendChild(floorRow);

    // Wall color row (only for rooms with walls, not courtyard)
    if (room.id !== 'courtyard') {
      const wallLabel = document.createElement('div');
      wallLabel.className = 'mat-label';
      wallLabel.textContent = 'Wall Color';
      section.appendChild(wallLabel);

      const wallRow = document.createElement('div');
      wallRow.className = 'swatch-row';

      const currentColor = getWallColor(room.id);

      for (const preset of WALL_COLOR_PALETTE) {
        const swatch = document.createElement('div');
        swatch.className = 'wall-swatch';
        swatch.style.background = preset.hex;
        swatch.title = preset.name;
        if (currentColor.toLowerCase() === preset.hex.toLowerCase()) swatch.classList.add('active');
        swatch.addEventListener('click', () => {
          setWallColor(room.id, preset.hex);
          saveWallColor(room.id, preset.hex);
          autoSave();
          wallRow.querySelectorAll('.wall-swatch').forEach(s => s.classList.remove('active'));
          swatch.classList.add('active');
          // Sync the color picker
          const picker = wallRow.querySelector('.wall-color-picker');
          if (picker) picker.value = preset.hex;
        });
        wallRow.appendChild(swatch);
      }

      // Native color picker at end
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.className = 'wall-color-picker';
      picker.value = currentColor;
      picker.title = 'Custom color';
      picker.addEventListener('input', (e) => {
        setWallColor(room.id, e.target.value);
        wallRow.querySelectorAll('.wall-swatch').forEach(s => s.classList.remove('active'));
      });
      picker.addEventListener('change', (e) => {
        saveWallColor(room.id, e.target.value);
        autoSave();
      });
      wallRow.appendChild(picker);

      section.appendChild(wallRow);
    }

    panel.appendChild(section);
  }

  // ── Custom Walls section (non-seed walls) ──
  const customWalls = [...wallRecords.values()].filter(rec => !rec.isSeed);
  if (customWalls.length > 0) {
    const cwSection = document.createElement('div');
    cwSection.className = 'mat-section';
    cwSection.innerHTML = `<div class="mat-section-title">Custom Walls</div>`;

    for (const rec of customWalls) {
      const label = document.createElement('div');
      label.className = 'mat-label';
      label.textContent = `Wall ${rec.id.slice(0, 8)} (${rec.type === 'h' ? 'horizontal' : 'vertical'})`;
      cwSection.appendChild(label);

      const wallRow = document.createElement('div');
      wallRow.className = 'swatch-row';

      const mesh = wallMeshMap.get(rec.id);
      const currentColor = mesh?.userData.customColor || '#EBE0D0';

      for (const preset of WALL_COLOR_PALETTE) {
        const swatch = document.createElement('div');
        swatch.className = 'wall-swatch';
        swatch.style.background = preset.hex;
        swatch.title = preset.name;
        if (currentColor.toLowerCase() === preset.hex.toLowerCase()) swatch.classList.add('active');
        swatch.addEventListener('click', () => {
          setIndividualWallColor(rec.id, preset.hex);
          autoSave();
          wallRow.querySelectorAll('.wall-swatch').forEach(s => s.classList.remove('active'));
          swatch.classList.add('active');
          const picker = wallRow.querySelector('.wall-color-picker');
          if (picker) picker.value = preset.hex;
        });
        wallRow.appendChild(swatch);
      }

      const picker = document.createElement('input');
      picker.type = 'color';
      picker.className = 'wall-color-picker';
      picker.value = currentColor;
      picker.title = 'Custom color';
      picker.addEventListener('input', (e) => {
        setIndividualWallColor(rec.id, e.target.value);
        wallRow.querySelectorAll('.wall-swatch').forEach(s => s.classList.remove('active'));
      });
      picker.addEventListener('change', () => { autoSave(); });
      wallRow.appendChild(picker);

      cwSection.appendChild(wallRow);
    }

    panel.appendChild(cwSection);
  }
}

// ── Floor switcher ──
function buildFloorSwitcher() {
  const container = document.getElementById('floor-switcher');
  if (!container) return;

  container.innerHTML = '';
  const floors = getFloors();

  for (const f of floors) {
    const btn = document.createElement('button');
    btn.className = 'floor-btn' + (f.level === getCurrentFloor() ? ' active' : '');
    btn.dataset.floor = f.level;
    btn.textContent = f.level === 0 ? 'G' : `${f.level}`;
    btn.addEventListener('click', () => {
      switchFloor(f.level);
    });
    container.appendChild(btn);
  }

  // Add floor button
  const addBtn = document.createElement('button');
  addBtn.className = 'floor-btn floor-btn-add';
  addBtn.id = 'btn-add-floor';
  addBtn.textContent = '+';
  addBtn.title = 'Add floor';
  addBtn.addEventListener('click', () => {
    addFloor();
    toast(`Added floor ${getFloorCount() - 1}`);
  });
  container.appendChild(addBtn);
}

function updateFloorSwitcherActive() {
  const btns = document.querySelectorAll('#floor-switcher .floor-btn');
  btns.forEach((btn) => {
    const fl = parseInt(btn.dataset.floor);
    btn.classList.toggle('active', fl === getCurrentFloor());
  });
}

// ── Update tool button active states ──
function updateToolButtons() {
  const wallBtn = document.getElementById('btn-wall');
  const floorBtn = document.getElementById('btn-floor');
  const stairBtn = document.getElementById('btn-stair');
  if (wallBtn) wallBtn.classList.toggle('active', isBuildMode());
  if (floorBtn) floorBtn.classList.toggle('active', isFloorBuildMode());
  if (stairBtn) stairBtn.classList.toggle('active', isStairBuildMode());
}

// ── Deactivate all build modes ──
function deactivateAllBuildModes() {
  if (isBuildMode()) toggleWallBuildMode();
  if (isFloorBuildMode()) toggleFloorBuildMode();
  if (isStairBuildMode()) toggleStairBuildMode();
  updateToolButtons();
}

// ── Select furniture type ──
function selectFurniture(id) {
  deactivateAllBuildModes();
  deactivateEraser();
  deactivateFurnitureMoveMode();
  deactivatePaintMode();

  if (selectedType === id) {
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
  if (selectedObj) { unhighlightObj(selectedObj); selectedObj = null; }
  if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
  detachGizmo();
  deactivateEraser();
  deactivateFurnitureMoveMode();
  deselectWall();
  deselectTile();
  deselectStair();
  clearSelection();
  document.getElementById('selection-bar').style.display = 'none';
  buildFurnitureGrid();
}

// ── Floor intersection ──
function getFloorHit(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const yBase = getYBase(getCurrentFloor());
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -yBase);
  const pt = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, pt);
  return pt;
}

// ── Delete selected items (multi-select aware) ──
function deleteSelectedItems() {
  const sel = getSelected();
  if (sel.size === 0) return false;

  // Collect data for undo before deleting
  const deletedItems = [];

  for (const obj of sel) {
    // Unhighlight
    obj.traverse((c) => {
      if (c.isMesh && c._selOrigMat) {
        c.material.dispose();
        c.material = c._selOrigMat;
        delete c._selOrigMat;
      }
    });

    if (obj.userData.wallId) {
      const id = obj.userData.wallId;
      const rec = wallRecords.get(id) ? { ...wallRecords.get(id) } : null;
      removeWallById(id);
      wallRecords.delete(id);
      dbDeleteWall(id);
      if (rec) deletedItems.push({ type: 'wall', rec });
    } else if (obj.userData.furnitureId) {
      deletedItems.push({
        type: 'furniture',
        id: obj.userData.furnitureId,
        x: obj.position.x, z: obj.position.z,
        rotY: obj.rotation.y, floor: obj.userData.floor || 0,
      });
      removeItem(obj);
    } else if (obj.userData.tileId) {
      const id = obj.userData.tileId;
      const rec = floorTileRecords.get(id) ? { ...floorTileRecords.get(id) } : null;
      removeFloorTile(id);
      dbDeleteTile(id);
      if (rec) deletedItems.push({ type: 'tile', rec });
    } else if (obj.userData.stairId) {
      const id = obj.userData.stairId;
      const rec = stairRecords.get(id) ? { ...stairRecords.get(id) } : null;
      removeStair(id);
      dbDeleteStair(id);
      if (rec) deletedItems.push({ type: 'stair', rec });
    }
  }

  if (deletedItems.length > 0) {
    pushAction({
      label: `Delete ${deletedItems.length} items`,
      undo() {
        for (const item of deletedItems) {
          if (item.type === 'wall') {
            wallRecords.set(item.rec.id, item.rec);
            addWallFromRecord(item.rec);
            putWall(item.rec);
          } else if (item.type === 'furniture') {
            placeItem(item.id, item.x, item.z, item.rotY, item.floor);
          } else if (item.type === 'tile') {
            addFloorTile(item.rec);
            putFloorTile(item.rec);
          } else if (item.type === 'stair') {
            addStair(item.rec);
            putStair(item.rec);
          }
        }
      },
      redo() {
        for (const item of deletedItems) {
          if (item.type === 'wall') {
            removeWallById(item.rec.id);
            wallRecords.delete(item.rec.id);
            dbDeleteWall(item.rec.id);
          } else if (item.type === 'furniture') {
            const found = placed.find(p => p.userData.furnitureId === item.id &&
              Math.abs(p.position.x - item.x) < 0.01 && Math.abs(p.position.z - item.z) < 0.01);
            if (found) removeItem(found);
          } else if (item.type === 'tile') {
            removeFloorTile(item.rec.id);
            dbDeleteTile(item.rec.id);
          } else if (item.type === 'stair') {
            removeStair(item.rec.id);
            dbDeleteStair(item.rec.id);
          }
        }
      },
    });
  }

  clearSelection();
  autoSave();
  toast(`Deleted ${sel.size} items`);
  return true;
}

// ── Eraser mode ──
function toggleEraserMode() {
  eraserMode = !eraserMode;
  if (eraserMode) {
    deactivateAllBuildModes();
    deactivateFurnitureMoveMode();
    selectedType = null;
    if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
    buildFurnitureGrid();
  }
  const btn = document.getElementById('btn-eraser');
  if (btn) btn.classList.toggle('active', eraserMode);
  renderer.domElement.style.cursor = eraserMode ? 'crosshair' : '';
  return eraserMode;
}

function deactivateEraser() {
  if (!eraserMode) return;
  eraserMode = false;
  const btn = document.getElementById('btn-eraser');
  if (btn) btn.classList.remove('active');
  renderer.domElement.style.cursor = '';
}

// ── Furniture move mode (C key) ──
function toggleFurnitureMoveMode() {
  furnitureMoveMode = !furnitureMoveMode;
  if (furnitureMoveMode) {
    deactivateAllBuildModes();
    deactivateEraser();
    selectedType = null;
    if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
    buildFurnitureGrid();
  } else {
    // Exiting — detach gizmo and clean up
    detachGizmo();
    if (selectedObj) { unhighlightObj(selectedObj); selectedObj = null; }
    document.getElementById('selection-bar').style.display = 'none';
  }
  const btn = document.getElementById('btn-move');
  if (btn) btn.classList.toggle('active', furnitureMoveMode);
  renderer.domElement.style.cursor = furnitureMoveMode ? 'pointer' : '';
  return furnitureMoveMode;
}

function deactivateFurnitureMoveMode() {
  if (!furnitureMoveMode) return;
  furnitureMoveMode = false;
  detachGizmo();
  if (selectedObj) { unhighlightObj(selectedObj); selectedObj = null; }
  document.getElementById('selection-bar').style.display = 'none';
  const btn = document.getElementById('btn-move');
  if (btn) btn.classList.remove('active');
  renderer.domElement.style.cursor = '';
}

// ── Paint brush mode (P key) ──
function togglePaintMode() {
  paintMode = !paintMode;
  if (paintMode) {
    deactivateAllBuildModes();
    deactivateEraser();
    deactivateFurnitureMoveMode();
    selectedType = null;
    if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
    buildFurnitureGrid();
  }
  const bar = document.getElementById('paint-bar');
  if (bar) bar.style.display = paintMode ? 'flex' : 'none';
  renderer.domElement.style.cursor = paintMode ? 'crosshair' : '';
  return paintMode;
}

function deactivatePaintMode() {
  if (!paintMode) return;
  paintMode = false;
  const bar = document.getElementById('paint-bar');
  if (bar) bar.style.display = 'none';
  renderer.domElement.style.cursor = '';
}

function onPaintClick(event) {
  const vp = renderer.domElement;
  const rect = vp.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const hits = raycaster.intersectObjects(wallMeshes);
  if (hits.length === 0) return;

  const wallMesh = hits[0].object;
  const wallId = wallMesh.userData.wallId;
  if (!wallId) return;

  setIndividualWallColor(wallId, activePaintColor);
  autoSave();
}

function onPaintRightClick(event) {
  event.preventDefault();
  const vp = renderer.domElement;
  const rect = vp.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const hits = raycaster.intersectObjects(wallMeshes);
  if (hits.length === 0) return;

  const wallMesh = hits[0].object;
  const color = '#' + wallMesh.material.color.getHexString();
  activePaintColor = color;
  // Update paint bar swatches
  updatePaintBarActive();
  toast(`Picked color: ${color}`);
}

function updatePaintBarActive() {
  const bar = document.getElementById('paint-bar');
  if (!bar) return;
  bar.querySelectorAll('.wall-swatch').forEach((s) => {
    s.classList.toggle('active', s.dataset.hex && s.dataset.hex.toLowerCase() === activePaintColor.toLowerCase());
  });
  const picker = bar.querySelector('.wall-color-picker');
  if (picker) picker.value = activePaintColor;
}

function buildPaintBar() {
  const bar = document.getElementById('paint-bar');
  if (!bar) return;
  bar.innerHTML = '';

  const label = document.createElement('span');
  label.className = 'paint-bar-label';
  label.textContent = 'Paint:';
  bar.appendChild(label);

  for (const preset of WALL_COLOR_PALETTE) {
    const swatch = document.createElement('div');
    swatch.className = 'wall-swatch';
    swatch.style.background = preset.hex;
    swatch.title = preset.name;
    swatch.dataset.hex = preset.hex;
    if (activePaintColor.toLowerCase() === preset.hex.toLowerCase()) swatch.classList.add('active');
    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      activePaintColor = preset.hex;
      updatePaintBarActive();
    });
    bar.appendChild(swatch);
  }

  const picker = document.createElement('input');
  picker.type = 'color';
  picker.className = 'wall-color-picker';
  picker.value = activePaintColor;
  picker.title = 'Custom color';
  picker.addEventListener('input', (e) => {
    e.stopPropagation();
    activePaintColor = e.target.value;
    bar.querySelectorAll('.wall-swatch').forEach((s) => s.classList.remove('active'));
  });
  bar.appendChild(picker);

  const hint = document.createElement('span');
  hint.className = 'paint-bar-hint';
  hint.textContent = '[Esc] exit  |  Right-click = eyedropper';
  bar.appendChild(hint);
}

function onFurnitureMoveClick(event) {
  // Ignore clicks while dragging or just after a drag (prevents gizmo detach)
  if (shouldSuppressClick()) return;

  const vp = renderer.domElement;
  const rect = vp.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
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
      // If clicking a different piece, switch to it
      if (selectedObj && selectedObj !== obj) unhighlightObj(selectedObj);
      selectedObj = obj;
      highlightObj(obj);
      attachGizmo(obj);
      updateMoveSelectionBar();
    }
  } else {
    // Clicked empty space — detach gizmo, deselect, stay in move mode
    detachGizmo();
    if (selectedObj) unhighlightObj(selectedObj);
    selectedObj = null;
    document.getElementById('selection-bar').style.display = 'none';
  }
}

function updateMoveSelectionBar() {
  if (!selectedObj) return;
  const bar = document.getElementById('selection-bar');
  const name = selectedObj.userData.item?.name || selectedObj.userData.furnitureId;
  const mode = getGizmoMode();
  if (mode === 'translate') {
    bar.textContent = `${name} \u2014 drag to MOVE  [R] rotate  [Del] remove  [Esc] deselect`;
  } else if (mode === 'rotate') {
    bar.textContent = `${name} \u2014 drag to ROTATE  [R] scale  [Del] remove  [Esc] deselect`;
  } else {
    bar.textContent = `${name} \u2014 drag to SCALE  [R] move  [Del] remove  [Esc] deselect`;
  }
  bar.style.display = 'block';
}

function onEraserClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  // Collect all scene objects that can be erased
  const candidates = [];

  // Walls
  for (const mesh of [...wallMeshMap.values()]) {
    candidates.push(mesh);
  }

  // Furniture
  for (const g of placed) {
    g.traverse((c) => { if (c.isMesh) candidates.push(c); });
  }

  // Floor tiles
  for (const mesh of floorTileMeshes.values()) {
    candidates.push(mesh);
  }

  // Stairs
  for (const group of stairMeshes.values()) {
    group.traverse((c) => { if (c.isMesh) candidates.push(c); });
  }

  const hits = raycaster.intersectObjects(candidates);
  if (hits.length === 0) return;

  let obj = hits[0].object;

  // Walk up to find the root userData carrier
  while (obj.parent && !obj.userData.wallId && !obj.userData.furnitureId && !obj.userData.tileId && !obj.userData.stairId) {
    obj = obj.parent;
  }

  if (obj.userData.wallId) {
    const id = obj.userData.wallId;
    const savedRec = wallRecords.get(id) ? { ...wallRecords.get(id) } : null;
    removeWallById(id);
    wallRecords.delete(id);
    dbDeleteWall(id);
    if (savedRec) {
      pushAction({
        label: 'Erase wall',
        undo() {
          wallRecords.set(savedRec.id, savedRec);
          addWallFromRecord(savedRec);
          putWall(savedRec);
        },
        redo() {
          removeWallById(savedRec.id);
          wallRecords.delete(savedRec.id);
          dbDeleteWall(savedRec.id);
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
      undo() {
        placeItem(savedId, savedX, savedZ, savedRotY, savedFloor);
      },
      redo() {
        const last = placed.find(p => p.userData.furnitureId === savedId &&
          Math.abs(p.position.x - savedX) < 0.01 && Math.abs(p.position.z - savedZ) < 0.01);
        if (last) removeItem(last);
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
        undo() {
          addFloorTile(savedRec);
          putFloorTile(savedRec);
        },
        redo() {
          removeFloorTile(savedRec.id);
          dbDeleteTile(savedRec.id);
        },
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
        undo() {
          addStair(savedRec);
          putStair(savedRec);
        },
        redo() {
          removeStair(savedRec.id);
          dbDeleteStair(savedRec.id);
        },
      });
    }
    autoSave();
    toast('Erased stairs');
  }
}

// ── Init all UI ──
export function initUI() {
  buildCategoryBar();
  buildSourceBar();
  buildFurnitureGrid();
  buildRoomList();
  buildMaterialPanel();
  buildFloorSwitcher();
  buildPaintBar();

  // Floor change callback
  setOnFloorChange((level) => {
    buildFloorSwitcher();
    updateStairVisibility(level);
    updateGridFloor(level);
    showLowerFloorGhosts(wallRecords, level);
  });

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
      deactivateEraser();
      deactivateFurnitureMoveMode();
      if (isFloorBuildMode()) toggleFloorBuildMode();
      if (isStairBuildMode()) toggleStairBuildMode();
      const on = toggleWallBuildMode();
      if (on) {
        selectedType = null;
        if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
        buildFurnitureGrid();
      }
      toast(on ? 'Wall tool ON' : 'Wall tool OFF');
      updateToolButtons();
    });
  }

  // Floor tool button
  const floorBtn = document.getElementById('btn-floor');
  if (floorBtn) {
    floorBtn.addEventListener('click', () => {
      deactivateEraser();
      deactivateFurnitureMoveMode();
      if (isBuildMode()) toggleWallBuildMode();
      if (isStairBuildMode()) toggleStairBuildMode();
      const on = toggleFloorBuildMode();
      if (on) {
        selectedType = null;
        if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
        buildFurnitureGrid();
      }
      toast(on ? 'Floor tool ON' : 'Floor tool OFF');
      updateToolButtons();
    });
  }

  // Stair tool button
  const stairBtn = document.getElementById('btn-stair');
  if (stairBtn) {
    stairBtn.addEventListener('click', () => {
      deactivateEraser();
      deactivateFurnitureMoveMode();
      if (isBuildMode()) toggleWallBuildMode();
      if (isFloorBuildMode()) toggleFloorBuildMode();
      const on = toggleStairBuildMode();
      if (on) {
        selectedType = null;
        if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
        buildFurnitureGrid();
      }
      toast(on ? 'Stair tool ON — R to rotate' : 'Stair tool OFF');
      updateToolButtons();
    });
  }

  // Eraser tool button
  const eraserBtn = document.getElementById('btn-eraser');
  if (eraserBtn) {
    eraserBtn.addEventListener('click', () => {
      const on = toggleEraserMode();
      toast(on ? 'Eraser ON' : 'Eraser OFF');
    });
  }

  // Move tool button
  const moveBtn = document.getElementById('btn-move');
  if (moveBtn) {
    moveBtn.addEventListener('click', () => {
      deactivatePaintMode();
      const on = toggleFurnitureMoveMode();
      toast(on ? 'Move mode ON — click furniture to move' : 'Move mode OFF');
    });
  }

  // Paint tool button
  const paintBtn = document.getElementById('btn-paint');
  if (paintBtn) {
    paintBtn.addEventListener('click', () => {
      const on = togglePaintMode();
      toast(on ? 'Paint mode ON — click walls to paint' : 'Paint mode OFF');
      paintBtn.classList.toggle('active', on);
    });
  }

  // Grid toggle button
  const gridBtn = document.getElementById('btn-grid');
  if (gridBtn) {
    gridBtn.addEventListener('click', () => {
      const on = toggleGridVisible();
      gridBtn.classList.toggle('active', on);
      toast(on ? 'Grid ON' : 'Grid OFF');
    });
  }

  // Copy Floor button
  const copyFloorBtn = document.getElementById('btn-copy-floor');
  if (copyFloorBtn) {
    copyFloorBtn.addEventListener('click', () => {
      const count = copyFloorLayoutUp(getCurrentFloor());
      if (count > 0) {
        toast(`Copied ${count} wall${count > 1 ? 's' : ''} to floor ${getCurrentFloor() + 1}`);
        autoSave();
      } else {
        toast('No custom walls to copy');
      }
    });
  }

  // Create grid overlay (hidden by default)
  createGridOverlay();

  // Save / Reset
  document.getElementById('btn-save').addEventListener('click', () => {
    saveState();
    toast('Saved');
  });

  document.getElementById('btn-undo').addEventListener('click', () => {
    const label = historyUndo();
    if (label) {
      autoSave();
      toast(`Undo: ${label}`);
    }
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Reset all walls, floors, stairs and furniture?')) {
      resetState();
      toast('Reset complete');
    }
  });

  // ── Viewport events ──
  const vp = renderer.domElement;

  vp.addEventListener('mousedown', (e) => {
    // Box select start
    if (e.ctrlKey || e.metaKey) {
      onBoxSelectStart(e);
    }
  });

  vp.addEventListener('mouseup', (e) => {
    onBoxSelectEnd(e);
  });

  vp.addEventListener('click', (e) => {
    if (viewMode === 'walk') {
      requestPointerLock();
      return;
    }

    // Paint brush mode
    if (paintMode) {
      onPaintClick(e);
      return;
    }

    // Eraser mode
    if (eraserMode) {
      onEraserClick(e);
      return;
    }

    // Multi-select (Ctrl+click)
    if (onSelectionClick(e)) return;

    // Floor build mode
    if (isFloorBuildMode()) {
      onFloorClick(e);
      return;
    }

    // Stair build mode
    if (isStairBuildMode()) {
      onStairClick(e);
      return;
    }

    // Wall build mode
    if (isBuildMode()) {
      onWallClick(e);
      return;
    }

    // Furniture placement
    if (selectedType) {
      const pt = getFloorHit(e);
      if (pt) {
        const rot = ghostMesh ? ghostMesh.rotation.y : 0;
        const floor = getCurrentFloor();
        const mesh = placeItem(selectedType, pt.x, pt.z, rot, floor);
        if (mesh) {
          const savedType = selectedType;
          const savedX = pt.x, savedZ = pt.z, savedRot = rot, savedFloor = floor;
          pushAction({
            label: `Place ${savedType}`,
            undo() {
              removeItem(mesh);
            },
            redo() {
              const m = placeItem(savedType, savedX, savedZ, savedRot, savedFloor);
              // Update closure reference for subsequent undos
              if (m) mesh._redoRef = m;
            },
          });
        }
        autoSave();
        toast(`Placed ${selectedType}`);
      }
      return;
    }

    // ── Furniture move mode (C key) ──
    if (furnitureMoveMode) {
      onFurnitureMoveClick(e);
      return;
    }

    // Floor tile selection
    if (onFloorSelect(e)) return;

    // Stair selection
    if (onStairSelect(e)) return;

    // Wall selection
    if (onWallSelect(e)) return;

    // Click on empty space — deselect all
    if (selectedObj) unhighlightObj(selectedObj);
    selectedObj = null;
    deselectWall();
    deselectTile();
    deselectStair();
    document.getElementById('selection-bar').style.display = 'none';
  });

  vp.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    // Paint brush eyedropper
    if (paintMode) {
      onPaintRightClick(e);
      return;
    }
    if (ghostMesh) ghostMesh.rotation.y += Math.PI / 4;
    if (selectedObj) {
      selectedObj.rotation.y += Math.PI / 4;
      autoSave();
    }
  });

  vp.addEventListener('mousemove', (e) => {
    // Box select move
    onBoxSelectMove(e);

    // Wall builder ghost preview
    onWallMouseMove(e);

    // Floor builder ghost preview
    onFloorMouseMove(e);

    // Stair builder ghost preview
    onStairMouseMove(e);

    // Furniture ghost preview (new placement)
    if (ghostMesh && selectedType) {
      const pt = getFloorHit(e);
      if (pt) {
        const yBase = getYBase(getCurrentFloor());
        ghostMesh.position.x = Math.round(pt.x / 0.25) * 0.25;
        ghostMesh.position.z = Math.round(pt.z / 0.25) * 0.25;
        ghostMesh.position.y = yBase;
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
    // Undo: Ctrl+Z
    if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault();
      const label = historyUndo();
      if (label) {
        autoSave();
        toast(`Undo: ${label}`);
      }
      return;
    }

    // Redo: Ctrl+Shift+Z or Ctrl+Y
    if ((e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
        (e.key === 'y' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      const label = historyRedo();
      if (label) {
        autoSave();
        toast(`Redo: ${label}`);
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const sidebar = document.getElementById('sidebar');
      const vp = document.getElementById('viewport');
      sidebar.classList.toggle('hidden');
      vp.classList.toggle('fullwidth');
      setTimeout(() => window.dispatchEvent(new Event('resize')), 350);
    }

    // Multi-select key handlers (Ctrl+A, Escape, Delete when selected)
    const selResult = onSelectionKeyDown(e.key, e);
    if (selResult === 'delete') {
      deleteSelectedItems();
      return;
    }
    if (selResult === true) return;

    // Floor builder key handlers
    if (onFloorKeyDown(e.key)) return;

    // Stair builder key handlers
    if (onStairKeyDown(e.key)) return;

    // F toggles floor build mode (only when not in walk mode)
    if (e.key === 'f' && viewMode !== 'walk') {
      deactivateEraser();
      deactivateFurnitureMoveMode();
      deactivatePaintMode();
      if (isBuildMode()) toggleWallBuildMode();
      if (isStairBuildMode()) toggleStairBuildMode();
      const on = toggleFloorBuildMode();
      if (on) {
        selectedType = null;
        if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
        buildFurnitureGrid();
      }
      toast(on ? 'Floor tool ON' : 'Floor tool OFF');
      updateToolButtons();
      return;
    }

    // S toggles stair build mode (only when not in walk mode)
    if ((e.key === 's' || e.key === 'S') && viewMode !== 'walk') {
      deactivateEraser();
      deactivateFurnitureMoveMode();
      deactivatePaintMode();
      if (isBuildMode()) toggleWallBuildMode();
      if (isFloorBuildMode()) toggleFloorBuildMode();
      const on = toggleStairBuildMode();
      if (on) {
        selectedType = null;
        if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
        buildFurnitureGrid();
      }
      toast(on ? 'Stair tool ON — R to rotate' : 'Stair tool OFF');
      updateToolButtons();
      return;
    }

    // W toggles wall mode (only when not in walk mode, and no wall selected)
    if ((e.key === 'w' || e.key === 'W') && viewMode !== 'walk') {
      // If a wall is selected, let wall-builder handle W for window placement
      if (getSelectedWallId()) {
        if (onWallKeyDown(e.key)) return;
      }
      deactivateEraser();
      deactivateFurnitureMoveMode();
      deactivatePaintMode();
      if (isFloorBuildMode()) toggleFloorBuildMode();
      if (isStairBuildMode()) toggleStairBuildMode();
      const on = toggleWallBuildMode();
      if (on) {
        selectedType = null;
        if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
        buildFurnitureGrid();
      }
      toast(on ? 'Wall tool ON' : 'Wall tool OFF');
      updateToolButtons();
      return;
    }

    // E toggles eraser mode (only when not in walk mode)
    if ((e.key === 'e' || e.key === 'E') && viewMode !== 'walk') {
      deactivateAllBuildModes();
      deactivateFurnitureMoveMode();
      deactivatePaintMode();
      const on = toggleEraserMode();
      toast(on ? 'Eraser ON' : 'Eraser OFF');
      return;
    }

    // C toggles furniture move mode (only when not in walk mode)
    if ((e.key === 'c' || e.key === 'C') && viewMode !== 'walk') {
      deactivateAllBuildModes();
      deactivateEraser();
      deactivatePaintMode();
      const on = toggleFurnitureMoveMode();
      toast(on ? 'Move mode ON — click furniture to move' : 'Move mode OFF');
      return;
    }

    // P toggles paint brush mode (only when not in walk mode)
    if ((e.key === 'p' || e.key === 'P') && viewMode !== 'walk') {
      const on = togglePaintMode();
      toast(on ? 'Paint mode ON — click walls to paint' : 'Paint mode OFF');
      return;
    }

    // G toggles grid overlay (only when not in walk mode)
    if ((e.key === 'g' || e.key === 'G') && viewMode !== 'walk') {
      const on = toggleGridVisible();
      const gridBtn = document.getElementById('btn-grid');
      if (gridBtn) gridBtn.classList.toggle('active', on);
      toast(on ? 'Grid ON' : 'Grid OFF');
      return;
    }

    // Wall builder key handlers (Escape, Delete)
    if (onWallKeyDown(e.key)) return;

    if (e.key === 'Escape') {
      // Paint mode: exit paint mode
      if (paintMode) {
        deactivatePaintMode();
        toast('Paint mode OFF');
        return;
      }
      // In move mode with gizmo active: just detach gizmo, stay in move mode
      if (furnitureMoveMode && isGizmoActive()) {
        detachGizmo();
        if (selectedObj) { unhighlightObj(selectedObj); selectedObj = null; }
        document.getElementById('selection-bar').style.display = 'none';
        return;
      }
      deselectAll();
    }

    // R: rotate furniture/ghost, or rotate stair direction
    if (e.key === 'r' || e.key === 'R') {
      if (isStairBuildMode()) {
        const dir = rotateStairDirection();
        toast(`Stair direction: ${dir}`);
        return;
      }
      if (ghostMesh) ghostMesh.rotation.y += Math.PI / 4;
      if (furnitureMoveMode && isGizmoActive()) {
        toggleGizmoMode();
        updateMoveSelectionBar();
        return;
      }
      if (selectedObj && !furnitureMoveMode) {
        selectedObj.rotation.y += Math.PI / 4;
        autoSave();
      }
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedObj) {
        const savedId = selectedObj.userData.furnitureId;
        const savedX = selectedObj.position.x;
        const savedZ = selectedObj.position.z;
        const savedRotY = selectedObj.rotation.y;
        const savedFloor = selectedObj.userData.floor || 0;
        const savedY = selectedObj.position.y;
        const savedScale = selectedObj.userData.customScale ? selectedObj.userData.customScale.clone() : null;
        detachGizmo();
        removeItem(selectedObj);
        pushAction({
          label: 'Delete furniture',
          undo() {
            placeItem(savedId, savedX, savedZ, savedRotY, savedFloor, savedY,
              savedScale ? { x: savedScale.x, y: savedScale.y, z: savedScale.z } : null);
          },
          redo() {
            const found = placed.find(p => p.userData.furnitureId === savedId &&
              Math.abs(p.position.x - savedX) < 0.01 && Math.abs(p.position.z - savedZ) < 0.01);
            if (found) removeItem(found);
          },
        });
        selectedObj = null;
        document.getElementById('selection-bar').style.display = 'none';
        autoSave();
        toast('Removed');
      }
    }

    // PageUp/PageDown to switch floors
    if (e.key === 'PageUp') {
      e.preventDefault();
      const next = getCurrentFloor() + 1;
      if (next < getFloorCount()) {
        switchFloor(next);
        toast(`Floor ${next === 0 ? 'G' : next}`);
      }
    }
    if (e.key === 'PageDown') {
      e.preventDefault();
      const prev = getCurrentFloor() - 1;
      if (prev >= 0) {
        switchFloor(prev);
        toast(`Floor ${prev === 0 ? 'G' : prev}`);
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

/** Rebuild the furniture grid (call after thumbnails are ready) */
export function refreshFurnitureGrid() {
  buildFurnitureGrid();
}
