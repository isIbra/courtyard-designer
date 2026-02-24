import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

/* ── Sky gradient canvas (warm Riyadh desert sky) ── */
function createDesertSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  // Zenith — deep warm blue, not the cold blue of northern skies
  gradient.addColorStop(0.0, '#1a2a4a');
  // Mid-sky — dusty warm blue fading to pale gold
  gradient.addColorStop(0.3, '#5a7a9a');
  gradient.addColorStop(0.55, '#b0a890');
  // Horizon — pale sandy gold, the signature Riyadh haze
  gradient.addColorStop(0.75, '#d4c4a0');
  gradient.addColorStop(1.0, '#e8d8b8');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

/* ── Subtle environment cubemap for glass reflections ── */
function createWarmEnvMap() {
  const size = 128;
  const cubeRT = new THREE.WebGLCubeRenderTarget(size);
  const cubeScene = new THREE.Scene();

  // Fill with warm gradient sphere so reflections pick up the desert tone
  const gradientCanvas = document.createElement('canvas');
  gradientCanvas.width = 256;
  gradientCanvas.height = 256;
  const ctx = gradientCanvas.getContext('2d');
  const grad = ctx.createRadialGradient(128, 90, 10, 128, 128, 180);
  grad.addColorStop(0.0, '#fff8e8');   // bright warm core (sun area)
  grad.addColorStop(0.35, '#ddd0b8');  // sandy mid
  grad.addColorStop(0.7, '#a09880');   // warm neutral
  grad.addColorStop(1.0, '#5a6a7a');   // cooler edges
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const envTexture = new THREE.CanvasTexture(gradientCanvas);
  envTexture.mapping = THREE.EquirectangularReflectionMapping;
  return envTexture;
}

/* ── Scene ── */
const desertSkyColor = new THREE.Color(0xc8b898); // warm sandy base
export const scene = new THREE.Scene();
scene.background = desertSkyColor.clone();
// Warm sandy fog — not blue
scene.fog = new THREE.FogExp2(0xc8b898, 0.012);

/* ── Renderer ── */
export const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('viewport'),
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.75;
renderer.outputColorSpace = THREE.SRGBColorSpace;

/* ── Post-processing ── */
export let composer = null;

export function initPostProcessing() {
  composer = new EffectComposer(renderer);

  // Base render pass
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // SSAO for ambient occlusion — adds depth to corners and crevices
  const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
  ssaoPass.kernelRadius = 0.5;
  ssaoPass.minDistance = 0.0005;
  ssaoPass.maxDistance = 0.08;
  ssaoPass.output = SSAOPass.OUTPUT.Default;
  composer.addPass(ssaoPass);

  // Subtle bloom for lights and emissive materials
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.12,  // strength — very subtle
    0.4,   // radius
    0.9    // threshold — only lamps bloom
  );
  composer.addPass(bloomPass);

  // FXAA anti-aliasing (final pass)
  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
  composer.addPass(fxaaPass);
}

/* ── Camera ── */
export const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(-4, 14, -4);

/** @type {THREE.DirectionalLight} */
export let sunLight = null;

/* ── Lights ── */
export function initLights() {
  // Set sky texture as background
  scene.background = createDesertSkyTexture();
  // Set environment map for reflections on glass/metal
  scene.environment = createWarmEnvMap();

  // Warm ambient — subtle golden undertone
  const ambient = new THREE.AmbientLight(0xffd9a0, 0.2);
  scene.add(ambient);

  // Hemisphere: warm sky dome + sandy ground bounce
  const hemi = new THREE.HemisphereLight(0x9aafe0, 0xd4b07a, 0.3);
  scene.add(hemi);

  // Primary sun — warm white, moderate intensity
  sunLight = new THREE.DirectionalLight(0xfff0d0, 1.0);
  sunLight.position.set(8, 18, 5);
  sunLight.castShadow = true;
  // 4096 shadow map for crisp, detailed shadows
  sunLight.shadow.mapSize.set(4096, 4096);
  sunLight.shadow.camera.left = -22;
  sunLight.shadow.camera.right = 22;
  sunLight.shadow.camera.top = 22;
  sunLight.shadow.camera.bottom = -22;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 55;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.02;
  sunLight.shadow.radius = 2.0; // softer penumbra
  scene.add(sunLight);

  // Fill light from below — simulates light bouncing off sand/concrete
  const fillBelow = new THREE.DirectionalLight(0xffe0b0, 0.15);
  fillBelow.position.set(0, -3, 0);
  fillBelow.target.position.set(0, 5, 0);
  scene.add(fillBelow);
  scene.add(fillBelow.target);

  // Secondary rim/back light — faint cool fill for depth contrast
  const rimLight = new THREE.DirectionalLight(0xc0d0e8, 0.15);
  rimLight.position.set(-10, 10, -8);
  scene.add(rimLight);

  // Ground plane — sun-baked sandy concrete
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({
      color: 0x8a7a5a,
      roughness: 0.95,
      metalness: 0.0,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  ground.name = '__ground';
  scene.add(ground);
}

/* ── Sun position update with Riyadh-style color shifts ── */
export function updateSun(t01) {
  if (!sunLight) return;
  const angle = t01 * Math.PI;
  const sinA = Math.sin(angle);
  const cosA = Math.cos(angle);

  sunLight.position.set(
    cosA * 18,
    Math.max(sinA * 18 + 2, 1),
    8
  );

  // Intensity peaks at solar noon, drops at edges
  sunLight.intensity = 0.6 + sinA * 0.5;

  // Sky color shifts: golden-hour warmth at extremes, pale warm blue at noon
  // Red channel stays high (warm), green follows sun, blue is always subdued
  const skyR = 0.55 + sinA * 0.2;     // warm base, brighter at noon
  const skyG = 0.45 + sinA * 0.25;    // slightly cooler at noon
  const skyB = 0.35 + sinA * 0.15;    // never goes truly blue
  const skyColor = new THREE.Color(skyR, skyG, skyB);

  // Update fog to match — keeps the warm sandy haze consistent
  if (scene.fog) {
    scene.fog.color.copy(skyColor);
  }

  // Shift sun color: deep golden at horizon, warm white at zenith
  const sunR = 1.0;
  const sunG = 0.85 + sinA * 0.1;     // whiter at noon
  const sunB = 0.6 + sinA * 0.2;      // less orange at noon
  sunLight.color.setRGB(sunR, sunG, sunB);
}

/* ── Resize ── */
export function resize() {
  const sidebar = document.getElementById('sidebar');
  const sidebarW = sidebar.classList.contains('hidden') ? 0 : 280;
  const w = window.innerWidth - sidebarW;
  const h = window.innerHeight - 48;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  if (composer) {
    composer.setSize(w, h);
  }
}
