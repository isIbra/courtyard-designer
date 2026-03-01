// ── 3D Procedural Hand — Viewmodel Overlay ──
// Replaces the SVG/CSS hand with a Three.js rendered hand
// rendered as a viewmodel (separate scene/camera, always in front).

import * as THREE from 'three';
import { renderer, camera } from './scene.js';
import { viewMode } from './controls.js';

// ── Hand scene + camera ──
const handScene = new THREE.Scene();
const handCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 10);

// ── Materials ──
const handMat = new THREE.MeshBasicMaterial({
  color: 0xe8d5a8, transparent: true, opacity: 0.25, depthTest: true,
});
const wireMat = new THREE.MeshBasicMaterial({
  color: 0xf0dca0, wireframe: true, transparent: true, opacity: 0.4,
});
const jointMat = new THREE.MeshBasicMaterial({
  color: 0xf0dca0, transparent: true, opacity: 0.8,
});
const energyMat = new THREE.MeshBasicMaterial({
  color: 0xdfc08a, transparent: true, opacity: 0.5,
});

// Tool colors
const TOOL_COLORS = {
  furniture: 0xdfc08a,
  wall:      0x8cc8a0,
  floor:     0x9ab0d8,
  stair:     0xc8aa80,
  eraser:    0xd89090,
};

// ── Hand group ──
const handGroup = new THREE.Group();
const toolMount = new THREE.Group();
const fingers = [];
const energyLines = [];
let _time = 0;

// ── State machine ──
let _state = 'hidden';
let _prevState = 'hidden';
let _tool = null;
let _tween = null; // { prop, target, start, duration, elapsed, easing, onDone }
const _tweens = [];

// Target positions
const REST_POS = new THREE.Vector3(0.42, -0.32, -0.65);
const HIDDEN_POS = new THREE.Vector3(0.42, -2.0, -0.65);
const PLACE_OFFSET = new THREE.Vector3(0, 0, -0.15);

// ── Finger data ──
const FINGER_DEFS = [
  // [name, palmAttachX, palmAttachY, lengths[prox,med,dist], baseRotZ]
  { name: 'thumb',  ax: -0.14, ay: 0.02, lens: [0.06, 0.05, 0.04], baseRotZ: -0.5, baseRotX: 0.3 },
  { name: 'index',  ax: -0.06, ay: 0.08, lens: [0.07, 0.05, 0.04], baseRotZ: -0.08, baseRotX: 0 },
  { name: 'middle', ax: -0.01, ay: 0.09, lens: [0.08, 0.055, 0.045], baseRotZ: 0, baseRotX: 0 },
  { name: 'ring',   ax: 0.04,  ay: 0.08, lens: [0.07, 0.05, 0.04], baseRotZ: 0.06, baseRotX: 0 },
  { name: 'pinky',  ax: 0.09,  ay: 0.06, lens: [0.055, 0.04, 0.035], baseRotZ: 0.15, baseRotX: 0 },
];

// ── Finger pose targets per tool ──
const FINGER_POSES = {
  null:      { thumb: [0,0], index: [0,0,0], middle: [0,0,0], ring: [0,0,0], pinky: [0,0,0] },
  furniture: { thumb: [-0.3,0.2], index: [0.15,0.1,0.05], middle: [0.1,0.08,0.03], ring: [0.12,0.1,0.05], pinky: [0.15,0.12,0.06] },
  wall:      { thumb: [0.2,-0.1], index: [0,0,0], middle: [0,0,0], ring: [0,0,0], pinky: [0.05,0.03,0.02] },
  floor:     { thumb: [-0.4,0.2], index: [-0.2,-0.1,-0.05], middle: [0.3,0.2,0.1], ring: [0.3,0.2,0.1], pinky: [0.35,0.25,0.15] },
  stair:     { thumb: [0.1,0], index: [0.05,0.03,0.02], middle: [0.05,0.03,0.02], ring: [0.08,0.05,0.03], pinky: [0.1,0.06,0.03] },
  eraser:    { thumb: [0.3,0.15], index: [-0.15,-0.1,-0.05], middle: [0.8,0.6,0.4], ring: [0.8,0.6,0.4], pinky: [0.85,0.65,0.45] },
};

// ── Tool holograms ──
const toolHolograms = {};

// ── Particle pool ──
const PARTICLE_COUNT = 12;
const particles = [];
let particlesActive = false;

// ── Build hand geometry ──
function buildPalmGeometry() {
  // Custom palm shape: tapered pentagon cross-section extruded with slight curve
  // Wider at knuckles, narrower at wrist, with organic thickness
  const shape = new THREE.Shape();
  // Bottom-left (pinky side wrist)
  shape.moveTo(-0.07, -0.05);
  // Left edge curves out to pinky knuckle
  shape.quadraticCurveTo(-0.11, 0.0, -0.12, 0.05);
  // Top edge (knuckle line) — slight arch
  shape.quadraticCurveTo(-0.08, 0.07, 0.0, 0.075);
  shape.quadraticCurveTo(0.08, 0.07, 0.12, 0.05);
  // Right edge (thumb side) — curves in more
  shape.quadraticCurveTo(0.11, 0.0, 0.08, -0.05);
  // Bottom (wrist) — straight-ish
  shape.quadraticCurveTo(0.0, -0.06, -0.07, -0.05);

  const extrudeSettings = {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 2,
    curveSegments: 8,
  };
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  // Rotate so palm faces camera (extrude goes along Z, we want thickness along Z)
  geo.rotateX(Math.PI / 2);
  // Center the depth
  geo.translate(0, 0, -0.025);
  return geo;
}

function buildWristGeometry() {
  // Tapered cylinder — narrower than palm, connects forearm
  const geo = new THREE.CylinderGeometry(0.055, 0.045, 0.1, 8);
  return geo;
}

function buildHand() {
  // Wrist — tapered cylinder
  const wristGeo = buildWristGeometry();
  const wrist = new THREE.Mesh(wristGeo, handMat);
  const wristWire = new THREE.Mesh(wristGeo, wireMat);
  wrist.add(wristWire);
  wrist.position.set(0, -0.08, 0);
  handGroup.add(wrist);

  // Wrist glow ring
  const wristRingGeo = new THREE.TorusGeometry(0.052, 0.004, 6, 16);
  const wristRing = new THREE.Mesh(wristRingGeo, jointMat.clone());
  wristRing.material.opacity = 0.5;
  wristRing.rotation.x = Math.PI / 2;
  wristRing.position.set(0, -0.03, 0);
  handGroup.add(wristRing);

  // Palm — organic extruded shape
  const palmGeo = buildPalmGeometry();
  const palm = new THREE.Mesh(palmGeo, handMat);
  const palmWire = new THREE.Mesh(palmGeo, wireMat);
  palm.add(palmWire);
  palm.position.set(0, 0.02, 0);
  handGroup.add(palm);

  // Palm center glow node
  const palmNodeGeo = new THREE.SphereGeometry(0.015, 8, 8);
  const palmNodeMat = new THREE.MeshBasicMaterial({ color: 0xf0dca0, transparent: true, opacity: 0.6 });
  const palmNode = new THREE.Mesh(palmNodeGeo, palmNodeMat);
  palmNode.position.set(0, 0.025, 0);
  handGroup.add(palmNode);
  // Outer glow ring around palm node
  const palmRingGeo = new THREE.RingGeometry(0.02, 0.028, 16);
  const palmRingMat = new THREE.MeshBasicMaterial({ color: 0xdfc08a, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
  const palmRing = new THREE.Mesh(palmRingGeo, palmRingMat);
  palmRing.position.set(0, 0.026, 0);
  palmRing.rotation.x = -Math.PI / 2;
  handGroup.add(palmRing);

  // Fingers
  for (const def of FINGER_DEFS) {
    const finger = buildFinger(def);
    finger.group.position.set(def.ax, 0.04, 0);
    finger.group.rotation.z = def.baseRotZ;
    finger.group.rotation.x = def.baseRotX || 0;
    handGroup.add(finger.group);
    fingers.push(finger);
  }

  // Energy lines (wrist to each fingertip)
  for (let i = 0; i < 5; i++) {
    const lineGeo = new THREE.CylinderGeometry(0.002, 0.002, 0.2, 4);
    const line = new THREE.Mesh(lineGeo, energyMat.clone());
    line.material.opacity = 0.3;
    handGroup.add(line);
    energyLines.push(line);
  }

  // Tool mount — above fingertips
  toolMount.position.set(0, 0.22, 0);
  handGroup.add(toolMount);

  // Build tool holograms
  buildToolHolograms();

  // Set initial position
  handGroup.position.copy(HIDDEN_POS);
  handGroup.rotation.set(0.1, -0.15, 0.05);
  handGroup.visible = false;

  handScene.add(handGroup);

  // Build particle pool
  buildParticles();
}

function buildFinger(def) {
  const group = new THREE.Group();
  const segments = [];
  const joints = [];

  let yOff = 0;
  for (let i = 0; i < 3; i++) {
    const len = def.lens[i];
    const radius = 0.012 - i * 0.002;

    // Segment
    const segGeo = new THREE.CapsuleGeometry(radius, len, 4, 6);
    const seg = new THREE.Mesh(segGeo, handMat);
    const segWire = new THREE.Mesh(segGeo, wireMat);
    seg.add(segWire);

    // Pivot group for this segment
    const pivot = new THREE.Group();
    pivot.position.set(0, yOff, 0);
    seg.position.set(0, len / 2 + radius, 0);
    pivot.add(seg);

    if (i === 0) {
      group.add(pivot);
    } else {
      // Attach to previous segment's end
      segments[i - 1].seg.add(pivot);
      pivot.position.set(0, def.lens[i - 1] / 2 + (0.012 - (i - 1) * 0.002), 0);
    }

    segments.push({ pivot, seg, len, radius });

    // Joint sphere (between segments)
    if (i < 2) {
      const jointGeo = new THREE.SphereGeometry(radius + 0.004, 6, 6);
      const joint = new THREE.Mesh(jointGeo, jointMat.clone());
      if (i === 0) {
        joint.position.set(0, len + radius * 2, 0);
        pivot.add(joint);
      }
      joints.push(joint);
    }

    yOff = len + radius * 2;
  }

  // Fingertip sphere
  const lastSeg = segments[2];
  const tipGeo = new THREE.SphereGeometry(lastSeg.radius + 0.003, 6, 6);
  const tip = new THREE.Mesh(tipGeo, jointMat.clone());
  tip.position.set(0, lastSeg.len / 2 + lastSeg.radius, 0);
  lastSeg.seg.add(tip);

  return { group, segments, joints, tip, name: def.name };
}

function buildToolHolograms() {
  // Furniture — small cube
  const furniGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
  const furniMat = new THREE.MeshBasicMaterial({ color: TOOL_COLORS.furniture, transparent: true, opacity: 0.7 });
  const furniWire = new THREE.MeshBasicMaterial({ color: TOOL_COLORS.furniture, wireframe: true, transparent: true, opacity: 0.9 });
  const furniMesh = new THREE.Group();
  furniMesh.add(new THREE.Mesh(furniGeo, furniMat));
  furniMesh.add(new THREE.Mesh(furniGeo, furniWire));
  // Add edges for isometric look
  const furniEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(furniGeo),
    new THREE.LineBasicMaterial({ color: TOOL_COLORS.furniture, transparent: true, opacity: 0.9 })
  );
  furniMesh.add(furniEdge);
  furniMesh.visible = false;
  toolMount.add(furniMesh);
  toolHolograms.furniture = furniMesh;

  // Wall — flat panel
  const wallGeo = new THREE.BoxGeometry(0.06, 0.045, 0.008);
  const wallMat = new THREE.MeshBasicMaterial({ color: TOOL_COLORS.wall, transparent: true, opacity: 0.7 });
  const wallWire = new THREE.MeshBasicMaterial({ color: TOOL_COLORS.wall, wireframe: true, transparent: true, opacity: 0.9 });
  const wallMesh = new THREE.Group();
  wallMesh.add(new THREE.Mesh(wallGeo, wallMat));
  wallMesh.add(new THREE.Mesh(wallGeo, wallWire));
  // Brick lines
  const brickLine1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.001, 0.009), new THREE.MeshBasicMaterial({ color: TOOL_COLORS.wall, transparent: true, opacity: 0.5 }));
  brickLine1.position.y = 0.01;
  wallMesh.add(brickLine1);
  const brickLine2 = brickLine1.clone();
  brickLine2.position.y = -0.01;
  wallMesh.add(brickLine2);
  wallMesh.visible = false;
  toolMount.add(wallMesh);
  toolHolograms.wall = wallMesh;

  // Floor — thin diamond
  const floorGeo = new THREE.PlaneGeometry(0.055, 0.055);
  const floorMat = new THREE.MeshBasicMaterial({ color: TOOL_COLORS.floor, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
  const floorMesh = new THREE.Group();
  const floorPlane = new THREE.Mesh(floorGeo, floorMat);
  floorPlane.rotation.x = -Math.PI / 4;
  floorPlane.rotation.z = Math.PI / 4;
  floorMesh.add(floorPlane);
  const floorWire = new THREE.Mesh(floorGeo, new THREE.MeshBasicMaterial({ color: TOOL_COLORS.floor, wireframe: true, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  floorWire.rotation.x = -Math.PI / 4;
  floorWire.rotation.z = Math.PI / 4;
  floorMesh.add(floorWire);
  floorMesh.visible = false;
  toolMount.add(floorMesh);
  toolHolograms.floor = floorMesh;

  // Stair — 3 steps
  const stairMesh = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const stepGeo = new THREE.BoxGeometry(0.04, 0.01, 0.015);
    const stepMat = new THREE.MeshBasicMaterial({ color: TOOL_COLORS.stair, transparent: true, opacity: 0.7 });
    const step = new THREE.Mesh(stepGeo, stepMat);
    step.position.set(0, i * 0.012 - 0.012, i * 0.012 - 0.012);
    stairMesh.add(step);
    const stepWire = new THREE.Mesh(stepGeo, new THREE.MeshBasicMaterial({ color: TOOL_COLORS.stair, wireframe: true, transparent: true, opacity: 0.9 }));
    stepWire.position.copy(step.position);
    stairMesh.add(stepWire);
  }
  stairMesh.visible = false;
  toolMount.add(stairMesh);
  toolHolograms.stair = stairMesh;

  // Eraser — X shape
  const eraserMesh = new THREE.Group();
  const barGeo = new THREE.BoxGeometry(0.06, 0.008, 0.008);
  const eraserMat = new THREE.MeshBasicMaterial({ color: TOOL_COLORS.eraser, transparent: true, opacity: 0.8 });
  const bar1 = new THREE.Mesh(barGeo, eraserMat);
  bar1.rotation.z = Math.PI / 4;
  eraserMesh.add(bar1);
  const bar2 = new THREE.Mesh(barGeo, eraserMat);
  bar2.rotation.z = -Math.PI / 4;
  eraserMesh.add(bar2);
  // Circle
  const circleGeo = new THREE.RingGeometry(0.025, 0.028, 16);
  const circleMat = new THREE.MeshBasicMaterial({ color: TOOL_COLORS.eraser, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
  eraserMesh.add(new THREE.Mesh(circleGeo, circleMat));
  eraserMesh.visible = false;
  toolMount.add(eraserMesh);
  toolHolograms.eraser = eraserMesh;
}

function buildParticles() {
  const geo = new THREE.SphereGeometry(0.006, 4, 4);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xf0dca0, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    handScene.add(mesh);
    particles.push({
      mesh,
      vel: new THREE.Vector3(),
      life: 0,
      maxLife: 0,
    });
  }
}

// ── Easing ──
function easeOutSpring(t) {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInCubic(t) { return t * t * t; }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

// ── Tween system ──
function addTween(target, prop, endVal, duration, easing, onDone) {
  // Remove existing tween for same target+prop
  for (let i = _tweens.length - 1; i >= 0; i--) {
    if (_tweens[i].target === target && _tweens[i].prop === prop) {
      _tweens.splice(i, 1);
    }
  }
  _tweens.push({
    target, prop,
    startVal: target[prop],
    endVal,
    duration,
    elapsed: 0,
    easing: easing || easeOutCubic,
    onDone,
  });
}

function addTweenV3(target, endVal, duration, easing, onDone) {
  for (let i = _tweens.length - 1; i >= 0; i--) {
    if (_tweens[i].target === target && _tweens[i].prop === '_v3') {
      _tweens.splice(i, 1);
    }
  }
  _tweens.push({
    target, prop: '_v3',
    startVal: target.clone(),
    endVal: endVal.clone(),
    duration,
    elapsed: 0,
    easing: easing || easeOutCubic,
    onDone,
  });
}

function updateTweens(dt) {
  for (let i = _tweens.length - 1; i >= 0; i--) {
    const tw = _tweens[i];
    tw.elapsed += dt;
    let t = Math.min(tw.elapsed / tw.duration, 1);
    t = tw.easing(t);

    if (tw.prop === '_v3') {
      tw.target.lerpVectors(tw.startVal, tw.endVal, t);
    } else {
      tw.target[tw.prop] = tw.startVal + (tw.endVal - tw.startVal) * t;
    }

    if (tw.elapsed >= tw.duration) {
      _tweens.splice(i, 1);
      if (tw.onDone) tw.onDone();
    }
  }
}

// ── Finger pose interpolation ──
const _currentPose = {};
const _targetPose = {};
for (const def of FINGER_DEFS) {
  _currentPose[def.name] = def.name === 'thumb' ? [0, 0] : [0, 0, 0];
  _targetPose[def.name] = def.name === 'thumb' ? [0, 0] : [0, 0, 0];
}

function setFingerPose(tool) {
  const pose = FINGER_POSES[tool] || FINGER_POSES[null];
  for (const key of Object.keys(pose)) {
    const arr = pose[key];
    for (let i = 0; i < arr.length; i++) {
      _targetPose[key][i] = arr[i];
    }
  }
}

function updateFingerPose(dt) {
  const speed = 6; // lerp speed
  for (const finger of fingers) {
    const cur = _currentPose[finger.name];
    const tgt = _targetPose[finger.name];
    for (let i = 0; i < cur.length; i++) {
      cur[i] += (tgt[i] - cur[i]) * Math.min(speed * dt, 1);
    }
    // Apply to segments
    for (let i = 0; i < finger.segments.length; i++) {
      if (i < cur.length) {
        finger.segments[i].pivot.rotation.x = -cur[i];
      }
    }
  }
}

// ── Energy line update ──
function updateEnergyLines() {
  for (let i = 0; i < 5 && i < energyLines.length; i++) {
    const line = energyLines[i];
    const finger = fingers[i];
    if (!finger) continue;

    // Get fingertip world position (relative to handGroup)
    const tipWorld = new THREE.Vector3();
    finger.tip.getWorldPosition(tipWorld);
    handGroup.worldToLocal(tipWorld);

    const wristPos = new THREE.Vector3(0, -0.06, 0);
    const mid = new THREE.Vector3().lerpVectors(wristPos, tipWorld, 0.5);
    const dist = wristPos.distanceTo(tipWorld);

    line.position.copy(mid);
    line.scale.y = dist / 0.2;
    line.lookAt(handGroup.localToWorld(tipWorld.clone()));
    line.rotateX(Math.PI / 2);

    // Pulsing opacity
    line.material.opacity = 0.15 + Math.sin(_time * 3 + i * 1.2) * 0.1;
  }
}

// ── State machine ──
function enterState(state) {
  _prevState = _state;
  _state = state;

  // Clear existing tweens on state change
  _tweens.length = 0;

  switch (state) {
    case 'hidden':
      handGroup.visible = false;
      break;

    case 'entering': {
      handGroup.visible = true;
      handGroup.position.copy(HIDDEN_POS);
      setFingerPose(_tool);

      // Spring up to rest position
      addTweenV3(handGroup.position, REST_POS, 0.7, easeOutSpring, () => {
        enterState('idle');
      });

      // Stagger finger unfurl — start curled, uncurl
      for (let i = 0; i < fingers.length; i++) {
        const name = fingers[i].name;
        const curled = name === 'thumb' ? [0.8, 0.6] : [1.2, 0.9, 0.6];
        for (let j = 0; j < curled.length; j++) {
          _currentPose[name][j] = curled[j];
        }
      }
      break;
    }

    case 'idle':
      // Just let the per-frame idle bob/sway run
      break;

    case 'placing': {
      // Thrust forward
      const target = REST_POS.clone().add(PLACE_OFFSET);
      addTweenV3(handGroup.position, target, 0.15, easeOutCubic, () => {
        // Flash joints bright
        flashJoints();
        // Return
        addTweenV3(handGroup.position, REST_POS.clone(), 0.25, easeOutCubic, () => {
          enterState('idle');
        });
      });
      break;
    }

    case 'switching': {
      // Quick retract down
      const downPos = REST_POS.clone();
      downPos.y -= 0.6;
      addTweenV3(handGroup.position, downPos, 0.2, easeInCubic, () => {
        // Swap tool hologram
        updateToolHologram();
        setFingerPose(_tool);
        // Re-enter from below
        addTweenV3(handGroup.position, REST_POS.clone(), 0.3, easeOutSpring, () => {
          enterState('idle');
        });
      });
      break;
    }

    case 'erasing': {
      // Sharp downward slam
      const slamPos = REST_POS.clone();
      slamPos.y -= 0.08;
      addTweenV3(handGroup.position, slamPos, 0.12, easeInCubic, () => {
        // Shake
        _shakeTime = 0.2;
        addTweenV3(handGroup.position, REST_POS.clone(), 0.2, easeOutCubic, () => {
          enterState('idle');
        });
      });
      break;
    }

    case 'rotating': {
      // Wrist twist
      addTween(handGroup.rotation, 'z', handGroup.rotation.z + 0.26, 0.18, easeOutCubic, () => {
        addTween(handGroup.rotation, 'z', 0.05, 0.2, easeOutSpring, () => {
          enterState('idle');
        });
      });
      break;
    }

    case 'exiting': {
      addTweenV3(handGroup.position, HIDDEN_POS.clone(), 0.4, easeInCubic, () => {
        enterState('hidden');
      });
      break;
    }
  }
}

// ── Shake effect ──
let _shakeTime = 0;

function flashJoints() {
  for (const finger of fingers) {
    for (const joint of finger.joints) {
      const origOpacity = joint.material.opacity;
      joint.material.opacity = 1.0;
      joint.material.color.setHex(0xffffff);
      // Fade back
      setTimeout(() => {
        joint.material.opacity = origOpacity;
        joint.material.color.setHex(0xf0dca0);
      }, 200);
    }
    // Flash tip too
    const origTipOp = finger.tip.material.opacity;
    finger.tip.material.opacity = 1.0;
    finger.tip.material.color.setHex(0xffffff);
    setTimeout(() => {
      finger.tip.material.opacity = origTipOp;
      finger.tip.material.color.setHex(0xf0dca0);
    }, 200);
  }
}

function updateToolHologram() {
  for (const [key, mesh] of Object.entries(toolHolograms)) {
    mesh.visible = (key === _tool);
  }
}

// ── Particles ──
function spawnBurst() {
  const origin = toolMount.getWorldPosition(new THREE.Vector3());
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = particles[i];
    p.mesh.position.copy(origin);
    p.mesh.visible = true;
    p.mesh.material.opacity = 1.0;
    // Random direction
    p.vel.set(
      (Math.random() - 0.5) * 1.5,
      Math.random() * 1.0 + 0.3,
      (Math.random() - 0.5) * 1.5
    );
    p.life = 0;
    p.maxLife = 0.4 + Math.random() * 0.2;
  }
  particlesActive = true;
}

function updateParticles(dt) {
  if (!particlesActive) return;
  let anyAlive = false;
  for (const p of particles) {
    if (p.life >= p.maxLife) {
      p.mesh.visible = false;
      continue;
    }
    anyAlive = true;
    p.life += dt;
    const t = p.life / p.maxLife;

    // Move with gravity
    p.vel.y -= dt * 3.0;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.material.opacity = 1.0 - t;
    p.mesh.scale.setScalar(1.0 - t * 0.5);
  }
  if (!anyAlive) particlesActive = false;
}

// ── Per-frame update ──
export function updateHand3D(dt) {
  if (_state === 'hidden') return;
  if (viewMode !== 'walk') return;

  _time += dt;
  updateTweens(dt);
  updateFingerPose(dt);

  // Idle bob + sway
  if (_state === 'idle') {
    const bob = Math.sin(_time * 1.5) * 0.015;
    const sway = Math.sin(_time * 0.8) * 0.01;
    handGroup.position.x = REST_POS.x + sway;
    handGroup.position.y = REST_POS.y + bob;
    handGroup.position.z = REST_POS.z;

    // Tool hologram gentle rotation
    if (_tool && toolHolograms[_tool]) {
      toolHolograms[_tool].rotation.y = Math.sin(_time * 0.7) * 0.3;
    }
  }

  // Shake effect
  if (_shakeTime > 0) {
    _shakeTime -= dt;
    handGroup.position.x += Math.sin(_time * 60) * 0.01 * (_shakeTime / 0.2);
  }

  // Energy lines
  updateEnergyLines();

  // Pulsing energy animation on energy line dash
  for (let i = 0; i < energyLines.length; i++) {
    energyLines[i].material.opacity = 0.15 + Math.sin(_time * 4 + i) * 0.12;
  }

  // Particles
  updateParticles(dt);
}

// ── Render (called after main render) ──
export function renderHand3D() {
  if (_state === 'hidden') return;
  if (viewMode !== 'walk') return;

  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(handScene, handCamera);
  renderer.autoClear = true;
}

// ── Resize ──
export function resizeHand3D() {
  handCamera.aspect = window.innerWidth / window.innerHeight;
  handCamera.updateProjectionMatrix();
}

// ── Public API ──
export function initHand3D() {
  buildHand();
}

export function showHand3D(tool) {
  _tool = tool;
  updateToolHologram();
  setFingerPose(tool);
  enterState('entering');
}

export function hideHand3D() {
  if (_state === 'hidden') return;
  enterState('exiting');
}

export function switchHandTool3D(tool) {
  _tool = tool;
  if (_state === 'hidden') return;
  enterState('switching');
}

export function setHandState3D(state) {
  if (_state === 'hidden') return;
  // Only allow these transitional states
  if (['placing', 'erasing', 'rotating'].includes(state)) {
    enterState(state);
  }
}

export function triggerBurst3D() {
  spawnBurst();
}
