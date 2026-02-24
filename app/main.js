import * as THREE from 'three';
import { scene, renderer, camera, initLights, updateSun, resize, composer, initPostProcessing } from './modules/scene.js';
import { buildApartment, setCeilingsVisible } from './modules/apartment.js';
// import { buildCourtyard } from './modules/courtyard.js';
import { initOrbit, updateControls, onWalkMouseMove, onKeyDown, onKeyUp, viewMode } from './modules/controls.js';
import { loadState } from './modules/persistence.js';
import { initUI, toast } from './modules/ui.js';
import { drawMinimap } from './modules/minimap.js';
import { buildReference } from './modules/reference.js';

// ── Init ──
function init() {
  resize();
  initLights();
  initPostProcessing();
  buildApartment();
  // buildCourtyard(); // disabled — walls built by new buildApartment
  buildReference();
  initOrbit();
  initUI();
  updateSun(0.65);

  // Start in orbit — hide ceilings
  setCeilingsVisible(false);

  // Load saved state
  const loaded = loadState();
  if (loaded) toast('Restored saved state');

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
  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
  drawMinimap();
}

init();
animate();
