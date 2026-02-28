import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { createProceduralTexture } from './textures.js';

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

/* ── PMREM environment map for realistic reflections ── */
function createPMREMEnvMap(rendererRef) {
  const pmremGen = new THREE.PMREMGenerator(rendererRef);
  pmremGen.compileEquirectangularShader();

  // Build a mini-scene for the environment
  const envScene = new THREE.Scene();

  // Sky dome with proper desert gradient
  const skyGeo = new THREE.SphereGeometry(50, 32, 16);
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 512;
  skyCanvas.height = 256;
  const ctx = skyCanvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#1a2a4a');   // zenith — deep warm blue
  grad.addColorStop(0.25, '#5a7a9a');  // mid sky
  grad.addColorStop(0.5, '#b0a890');   // haze
  grad.addColorStop(0.75, '#d4c4a0');  // horizon
  grad.addColorStop(1.0, '#e8d8b8');   // ground bounce
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.mapping = THREE.EquirectangularReflectionMapping;
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide });
  envScene.add(new THREE.Mesh(skyGeo, skyMat));

  // Bright sun spot — emissive sphere in sun direction
  const sunGeo = new THREE.SphereGeometry(2, 16, 8);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff8e0 });
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  sunMesh.position.set(15, 30, 8);
  envScene.add(sunMesh);

  // Sandy ground plane
  const groundGeo = new THREE.PlaneGeometry(100, 100);
  const groundMat = new THREE.MeshBasicMaterial({ color: 0xc8b898 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1;
  envScene.add(ground);

  // Lighting for the env scene
  envScene.add(new THREE.AmbientLight(0xffd9a0, 0.4));
  const envSun = new THREE.DirectionalLight(0xfff0d0, 1.0);
  envSun.position.set(8, 18, 5);
  envScene.add(envSun);

  const envMap = pmremGen.fromScene(envScene, 0.04).texture;
  pmremGen.dispose();

  return envMap;
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
renderer.toneMappingExposure = 0.85;
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
  ssaoPass.kernelRadius = 1.2;
  ssaoPass.minDistance = 0.0003;
  ssaoPass.maxDistance = 0.15;
  ssaoPass.output = SSAOPass.OUTPUT.Default;
  composer.addPass(ssaoPass);

  // Subtle bloom for lights and emissive materials
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.18,  // strength — subtle lamp glow
    0.5,   // radius
    0.82   // threshold — lamps + bright surfaces bloom
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
  // Set PMREM environment map for realistic reflections on glass/metal
  scene.environment = createPMREMEnvMap(renderer);
  scene.environmentIntensity = 0.6;

  // Warm ambient — subtle golden undertone
  const ambient = new THREE.AmbientLight(0xffd9a0, 0.2);
  scene.add(ambient);

  // Hemisphere: warm sky dome + sandy ground bounce
  const hemi = new THREE.HemisphereLight(0x9aafe0, 0xd4b07a, 0.4);
  scene.add(hemi);

  // Primary sun — warm white, moderate intensity
  sunLight = new THREE.DirectionalLight(0xfff0d0, 1.0);
  sunLight.position.set(8, 18, 5);
  sunLight.castShadow = true;
  // 4096 shadow map for crisp, detailed shadows
  sunLight.shadow.mapSize.set(4096, 4096);
  sunLight.shadow.camera.left = -20;
  sunLight.shadow.camera.right = 20;
  sunLight.shadow.camera.top = 20;
  sunLight.shadow.camera.bottom = -20;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 55;
  sunLight.shadow.bias = -0.0003;
  sunLight.shadow.normalBias = 0.03;
  sunLight.shadow.radius = 3.0; // softer penumbra
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

  // Interior fill light — brightens apartment rooms
  const interiorFill = new THREE.DirectionalLight(0xfff0d0, 0.35);
  interiorFill.position.set(4, 12, 8);
  interiorFill.castShadow = true;
  interiorFill.shadow.mapSize.set(2048, 2048);
  interiorFill.shadow.camera.left = -12;
  interiorFill.shadow.camera.right = 12;
  interiorFill.shadow.camera.top = 12;
  interiorFill.shadow.camera.bottom = -12;
  interiorFill.shadow.camera.near = 0.5;
  interiorFill.shadow.camera.far = 30;
  interiorFill.shadow.bias = -0.0003;
  interiorFill.shadow.normalBias = 0.03;
  scene.add(interiorFill);

  // Ground plane — sun-baked sandy concrete with texture
  const groundTex = createProceduralTexture('concrete_rough');
  const groundMap = groundTex.map.clone();
  groundMap.repeat.set(30, 30);
  groundMap.wrapS = THREE.RepeatWrapping;
  groundMap.wrapT = THREE.RepeatWrapping;
  groundMap.needsUpdate = true;
  const groundNormal = groundTex.normalMap.clone();
  groundNormal.repeat.set(30, 30);
  groundNormal.wrapS = THREE.RepeatWrapping;
  groundNormal.wrapT = THREE.RepeatWrapping;
  groundNormal.needsUpdate = true;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({
      color: 0x8a7a5a,
      map: groundMap,
      normalMap: groundNormal,
      normalScale: new THREE.Vector2(0.4, 0.4),
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
