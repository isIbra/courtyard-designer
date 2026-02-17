import * as THREE from 'three';
import { scene } from './scene.js';
import { wallMeshes } from './apartment.js';

const T = 0.25;
const EAST_H = 7.0;
const WEST_H = 2.4;
const GLASS_H = 3.0;

// Courtyard offset in building coords — courtyard local (0,0) maps to this
const OX = 9.10;
const OZ_FLIP = 11.20; // courtyard spec Y inverts to building Z

// Courtyard L-shape points (spec coords)
const P = [
  [0, 0], [0, 7.11], [0.63, 7.11], [0.63, 11.20],
  [5.18, 11.20], [5.18, 3.20], [6.91, 3.20], [6.91, 0],
];

// Convert courtyard spec (x, y) to building Three.js (x, z)
function toWorld(cx, cy) {
  return [OX + cx, OZ_FLIP - cy];
}

function slopeH(cx) {
  return EAST_H + (cx / 6.91) * (GLASS_H - EAST_H);
}

// ── Materials ──
const wallMat = new THREE.MeshStandardMaterial({ color: 0xEBE0D0, roughness: 0.85 });
const glassMat = new THREE.MeshStandardMaterial({
  color: 0xBBDDFF, roughness: 0.0,
  metalness: 0.1,
  transparent: true, opacity: 0.15,
  side: THREE.DoubleSide,
  envMapIntensity: 0.8,
});
const glassWallMat = new THREE.MeshStandardMaterial({
  color: 0xA0C8E0, roughness: 0.02,
  metalness: 0.1,
  transparent: true, opacity: 0.22,
  side: THREE.DoubleSide,
  envMapIntensity: 0.6,
});
const frameMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3, metalness: 0.7 });

export const courtyardFloorMesh = { ref: null };

// ── Floor ──
function buildFloor() {
  const shape = new THREE.Shape();
  const pts = P.map(([cx, cy]) => toWorld(cx, cy));
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshStandardMaterial({ color: 0xa69882, roughness: 0.7 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.01;
  mesh.receiveShadow = true;
  mesh.name = 'courtyard_floor';
  mesh.userData.roomId = 'courtyard';
  mesh.userData.isFloor = true;
  scene.add(mesh);
  courtyardFloorMesh.ref = mesh;
}

// ── Simple box wall util ──
function boxWall(x, z, w, d, h, yBase, mat) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x + w / 2, yBase + h / 2, z + d / 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  wallMeshes.push(mesh);
  return mesh;
}

// ── Courtyard walls ──
function buildWalls() {
  // We build the courtyard outer walls (not the apartment boundary — that's in apartment.js)
  // North wall (spec Y=0 → building Z=11.20)
  const [nx1] = toWorld(0, 0);
  const [nx2, nz] = toWorld(6.91, 0);
  boxWall(nx1, nz, nx2 - nx1, T, WEST_H, 0, wallMat);
  boxWall(nx1, nz, nx2 - nx1, T, GLASS_H - WEST_H, WEST_H, glassWallMat);

  // South wall (spec Y=11.20 → building Z=0)
  const [sx1, sz] = toWorld(0.63, 11.20);
  const [sx2] = toWorld(5.18, 11.20);
  boxWall(sx1, sz - T, sx2 - sx1, T, WEST_H, 0, wallMat);
  boxWall(sx1, sz - T, sx2 - sx1, T, GLASS_H - WEST_H, WEST_H, glassWallMat);

  // West upper (spec X=5.18, Y=3.20 to 11.20)
  const [wx, wz1] = toWorld(5.18, 11.20);
  const [, wz2] = toWorld(5.18, 3.20);
  boxWall(wx - T, wz1, T, wz2 - wz1, WEST_H, 0, wallMat);
  boxWall(wx - T, wz1, T, wz2 - wz1, GLASS_H - WEST_H, WEST_H, glassWallMat);

  // Bump horizontal (spec Y=3.20)
  const [bx1, bz] = toWorld(5.18, 3.20);
  const [bx2] = toWorld(6.91, 3.20);
  boxWall(bx1, bz, bx2 - bx1, T, WEST_H, 0, wallMat);
  boxWall(bx1, bz, bx2 - bx1, T, GLASS_H - WEST_H, WEST_H, glassWallMat);

  // Bump right (spec X=6.91, Y=0 to 3.20)
  const [brx, brz1] = toWorld(6.91, 3.20);
  const [, brz2] = toWorld(6.91, 0);
  boxWall(brx - T, brz1, T, brz2 - brz1, WEST_H, 0, wallMat);
  boxWall(brx - T, brz1, T, brz2 - brz1, GLASS_H - WEST_H, WEST_H, glassWallMat);
}

// ── Skylight (sloped glass panels) ──
function buildSkylight() {
  // Split into 3 regions matching the L-shape
  const regions = [
    { x1: 0.63, x2: 5.18, y1: 7.11, y2: 11.20 },
    { x1: 0,    x2: 5.18, y1: 3.20, y2: 7.11 },
    { x1: 0,    x2: 6.91, y1: 0,    y2: 3.20 },
  ];

  for (const r of regions) {
    const [wx1, wz1] = toWorld(r.x1, r.y2);
    const [wx2, wz2] = toWorld(r.x2, r.y1);
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      wx1, slopeH(r.x1), wz1,
      wx2, slopeH(r.x2), wz1,
      wx2, slopeH(r.x2), wz2,
      wx1, slopeH(r.x1), wz2,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, glassMat);
    mesh.name = 'skylight';
    scene.add(mesh);
  }
}

// ── Steel frame beams ──
function buildFrame() {
  const bw = 0.04;
  const bh = 0.06;

  // Slope angle: the skylight drops from EAST_H (7m at x=0) to GLASS_H (3m at x=6.91)
  const slopeAngle = Math.atan2(EAST_H - GLASS_H, 6.91);

  // Lateral beams (along X) — these follow the slope
  for (let i = 1; i < 12; i++) {
    const cy = (i / 12) * 11.20;
    let cx1, cx2;
    if (cy < 3.20) { cx1 = T; cx2 = 6.91 - T; }
    else if (cy < 7.11) { cx1 = T; cx2 = 5.18 - T; }
    else { cx1 = 0.63; cx2 = 5.18 - T; }

    const h1 = slopeH(cx1);
    const h2 = slopeH(cx2);
    const len = Math.sqrt(Math.pow(cx2 - cx1, 2) + Math.pow(h1 - h2, 2));
    const midX = OX + (cx1 + cx2) / 2;
    const midH = (h1 + h2) / 2;
    const [, wz] = toWorld(0, cy);

    const geo = new THREE.BoxGeometry(len, bh, bw);
    const mesh = new THREE.Mesh(geo, frameMat);
    mesh.position.set(midX, midH, wz);
    mesh.rotation.z = slopeAngle; // tilt along the slope
    scene.add(mesh);
  }

  // Longitudinal beams (along Z) — these sit at the slope height for their X
  for (let cx = 1; cx <= 6; cx++) {
    if (cx > 5.18 && cx <= 6.91) continue;
    let cyMin = 0;
    let cyMax = cx > 5.18 ? 3.20 : (cx > 0.63 ? 11.20 : 7.11);

    const [wx] = toWorld(cx, 0);
    const [, wz1] = toWorld(0, cyMax);
    const [, wz2] = toWorld(0, cyMin);
    const h = slopeH(cx);

    const geo = new THREE.BoxGeometry(bw, bh, Math.abs(wz2 - wz1));
    const mesh = new THREE.Mesh(geo, frameMat);
    mesh.position.set(wx, h, (wz1 + wz2) / 2);
    scene.add(mesh);
  }
}

// ── Label ──
function buildLabel() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 64;
  ctx.fillStyle = '#c8a96e';
  ctx.font = '600 26px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Courtyard', 128, 32);

  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  const [cx, cz] = toWorld(3.45, 5.6);
  sprite.position.set(cx, 2.6, cz);
  sprite.scale.set(2.5, 0.625, 1);
  scene.add(sprite);
}

// ── Ambient details — plants along walls, string lights ──
function buildAmbientDetails() {
  const potMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2D5A1E, roughness: 0.85 });

  // Place planters along the east wall (spec X ≈ 0.5, various Y)
  const planterPositions = [
    [0.5, 1.5], [0.5, 4.0], [0.5, 6.0], [0.5, 9.0], [0.5, 10.5],
    // Along south wall
    [2.0, 10.8], [3.5, 10.8],
    // Along north wall
    [2.5, 0.5], [4.5, 0.5],
    // Corner of bump
    [6.3, 2.8],
  ];

  for (const [cx, cy] of planterPositions) {
    const [wx, wz] = toWorld(cx, cy);
    const group = new THREE.Group();

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.13, 0.28, 8), potMat);
    pot.position.y = 0.14;
    pot.castShadow = true;
    group.add(pot);

    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), leafMat);
    leaf.position.y = 0.48;
    leaf.scale.set(1, 1.3, 1);
    leaf.castShadow = true;
    group.add(leaf);

    group.position.set(wx, 0, wz);
    scene.add(group);
  }

  // String lights — warm point lights along the courtyard at ~2.5m height
  const lightPositions = [
    [1.5, 2.0], [1.5, 5.0], [1.5, 8.0], [1.5, 10.0],
    [3.5, 2.0], [3.5, 5.0], [3.5, 8.0], [3.5, 10.0],
    [5.5, 1.5],
  ];

  for (const [cx, cy] of lightPositions) {
    const [wx, wz] = toWorld(cx, cy);
    const h = Math.min(slopeH(cx) - 0.5, 2.8);
    const light = new THREE.PointLight(0xFFE4B5, 0.3, 4);
    light.position.set(wx, h, wz);
    scene.add(light);

    // Tiny sphere to represent the bulb
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xFFE4B5, emissive: 0xFFE4B5, emissiveIntensity: 0.8 })
    );
    bulb.position.copy(light.position);
    scene.add(bulb);
  }
}

// ── Water Feature — reflecting pool with central fountain ──
function buildWaterFeature() {
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xA09888, roughness: 0.85 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1a6b6b,
    roughness: 0.02,
    metalness: 0.3,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    envMapIntensity: 1.2,
  });

  // Pool bounds in courtyard local coords
  const poolX1 = 1.5;
  const poolY1 = 4.0;
  const poolX2 = 4.5;
  const poolY2 = 6.5;
  const poolW = poolX2 - poolX1;   // 3.0
  const poolD = poolY2 - poolY1;   // 2.5
  const rimH = 0.15;
  const rimW = 0.10;

  const [wX1, wZ1] = toWorld(poolX1, poolY1);
  const [wX2, wZ2] = toWorld(poolX2, poolY2);

  // Pool border — 4 rim walls
  // North rim (low courtyard-Y side → high world-Z side)
  boxWall(wX1, wZ1 - rimW, poolW, rimW, rimH, 0, stoneMat);
  // South rim (high courtyard-Y side → low world-Z side)
  boxWall(wX1, wZ2, poolW, rimW, rimH, 0, stoneMat);
  // East rim (low courtyard-X side)
  boxWall(wX1, wZ2, rimW, wZ1 - wZ2, rimH, 0, stoneMat);
  // West rim (high courtyard-X side)
  boxWall(wX2 - rimW, wZ2, rimW, wZ1 - wZ2, rimH, 0, stoneMat);

  // Water surface
  const waterGeo = new THREE.PlaneGeometry(poolW - rimW * 2, poolD - rimW * 2);
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  const [wCenterX, wCenterZ] = toWorld((poolX1 + poolX2) / 2, (poolY1 + poolY2) / 2);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(wCenterX, 0.08, wCenterZ);
  waterMesh.receiveShadow = true;
  waterMesh.name = 'water_surface';
  scene.add(waterMesh);

  // Central fountain — stone cylinder
  const fountainBaseMat = new THREE.MeshStandardMaterial({ color: 0xA09888, roughness: 0.85 });
  const baseGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.5, 16);
  const baseMesh = new THREE.Mesh(baseGeo, fountainBaseMat);
  baseMesh.position.set(wCenterX, 0.25, wCenterZ);
  baseMesh.castShadow = true;
  scene.add(baseMesh);

  // Top cylinder
  const topGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.25, 12);
  const topMesh = new THREE.Mesh(topGeo, fountainBaseMat);
  topMesh.position.set(wCenterX, 0.625, wCenterZ);
  topMesh.castShadow = true;
  scene.add(topMesh);

  // Warm point light at fountain top
  const fountainLight = new THREE.PointLight(0xFFE8D0, 0.4, 3);
  fountainLight.position.set(wCenterX, 0.75, wCenterZ);
  scene.add(fountainLight);
}

// ── East Wall Detail — mashrabiya-inspired geometric lattice ──
function buildEastWallDetail() {
  const latticeMat = new THREE.MeshStandardMaterial({ color: 0xD8C8A8, roughness: 0.7 });
  const elemSize = 0.08;
  const elemDepth = 0.03;
  const spacingH = 0.4;  // horizontal spacing (along courtyard Y → world Z)
  const spacingV = 0.4;  // vertical spacing (along world Y height)

  const yMin = 3.0;
  const yMax = 6.5;
  const cyMin = 0;
  const cyMax = 11.20;

  // East wall face is at courtyard local x=0, world X = OX + 0.01 (just proud of interior face)
  const worldX = OX + 0.01;

  const [, wZStart] = toWorld(0, cyMin);
  const [, wZEnd] = toWorld(0, cyMax);
  const zMin = Math.min(wZStart, wZEnd);
  const zMax = Math.max(wZStart, wZEnd);

  const geo = new THREE.BoxGeometry(elemDepth, elemSize, elemSize);

  for (let h = yMin; h <= yMax; h += spacingV) {
    for (let z = zMin + spacingH / 2; z <= zMax - spacingH / 2; z += spacingH) {
      const mesh = new THREE.Mesh(geo, latticeMat);
      mesh.position.set(worldX, h, z);
      mesh.rotation.x = Math.PI / 4; // rotate 45° around Z in Three.js → rotate around X for wall-facing diamonds
      mesh.castShadow = true;
      scene.add(mesh);
    }
  }
}

// ── Seating Area — built-in benches with cushions ──
function buildSeatingArea() {
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xA08060, roughness: 0.7 });
  const cushionMat = new THREE.MeshStandardMaterial({ color: 0xC8A878, roughness: 0.6 });

  const benchH = 0.45;
  const benchDepth = 0.5;
  const cushionH = 0.06;
  const cushionInset = 0.04; // narrower than bench on each side

  // Bench 1: along north wall, courtyard (1.0, 0.5) to (5.0, 0.5), depth extends toward courtyard center (increasing cy)
  const [b1X1, b1Z] = toWorld(1.0, 0.5);
  const [b1X2] = toWorld(5.0, 0.5);
  const b1W = b1X2 - b1X1;

  // Bench body
  const bench1Geo = new THREE.BoxGeometry(b1W, benchH, benchDepth);
  const bench1 = new THREE.Mesh(bench1Geo, woodMat);
  bench1.position.set(b1X1 + b1W / 2, benchH / 2, b1Z - benchDepth / 2);
  bench1.castShadow = true;
  bench1.receiveShadow = true;
  scene.add(bench1);

  // Cushion on top
  const c1W = b1W - cushionInset * 2;
  const c1D = benchDepth - cushionInset * 2;
  const cushion1Geo = new THREE.BoxGeometry(c1W, cushionH, c1D);
  const cushion1 = new THREE.Mesh(cushion1Geo, cushionMat);
  cushion1.position.set(b1X1 + b1W / 2, benchH + cushionH / 2, b1Z - benchDepth / 2);
  cushion1.castShadow = true;
  scene.add(cushion1);

  // Bench 2: along bump horizontal wall, courtyard (5.5, 2.8) to (6.5, 2.8), depth extends toward courtyard center (increasing cy)
  const [b2X1, b2Z] = toWorld(5.5, 2.8);
  const [b2X2] = toWorld(6.5, 2.8);
  const b2W = b2X2 - b2X1;

  // Bench body
  const bench2Geo = new THREE.BoxGeometry(b2W, benchH, benchDepth);
  const bench2 = new THREE.Mesh(bench2Geo, woodMat);
  bench2.position.set(b2X1 + b2W / 2, benchH / 2, b2Z - benchDepth / 2);
  bench2.castShadow = true;
  bench2.receiveShadow = true;
  scene.add(bench2);

  // Cushion on top
  const c2W = b2W - cushionInset * 2;
  const c2D = benchDepth - cushionInset * 2;
  const cushion2Geo = new THREE.BoxGeometry(c2W, cushionH, c2D);
  const cushion2 = new THREE.Mesh(cushion2Geo, cushionMat);
  cushion2.position.set(b2X1 + b2W / 2, benchH + cushionH / 2, b2Z - benchDepth / 2);
  cushion2.castShadow = true;
  scene.add(cushion2);
}

// ── Public ──
export function buildCourtyard() {
  buildFloor();
  buildWalls();
  buildSkylight();
  buildFrame();
  buildAmbientDetails();
  buildWaterFeature();
  buildEastWallDetail();
  buildSeatingArea();
  buildLabel();
}
