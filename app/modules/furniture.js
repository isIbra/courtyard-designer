import * as THREE from 'three';
import { scene } from './scene.js';

// ── Catalog ──
export const CATALOG = [
  // Bedroom
  { id: 'bed_double', name: 'Double Bed',   cat: 'bedroom',  icon: '🛏️', w: 1.8, h: 0.5, d: 2.0, color: 0x8B7355 },
  { id: 'bed_single', name: 'Single Bed',   cat: 'bedroom',  icon: '🛏️', w: 0.9, h: 0.5, d: 2.0, color: 0x8B7355 },
  { id: 'wardrobe',   name: 'Wardrobe',     cat: 'bedroom',  icon: '🚪', w: 1.2, h: 2.0, d: 0.6, color: 0x654321 },
  { id: 'nightstand', name: 'Nightstand',   cat: 'bedroom',  icon: '🗄️', w: 0.45,h: 0.55,d: 0.4, color: 0x8B7355 },
  { id: 'dresser',    name: 'Dresser',      cat: 'bedroom',  icon: '🗄️', w: 1.0, h: 0.85,d: 0.5, color: 0x654321 },

  // Living
  { id: 'sofa',       name: 'Sofa',         cat: 'living',   icon: '🛋️', w: 2.2, h: 0.85,d: 0.9, color: 0x6B4423 },
  { id: 'armchair',   name: 'Armchair',     cat: 'living',   icon: '💺', w: 0.85,h: 0.85,d: 0.85,color: 0x7B5B3A },
  { id: 'coffee_tbl', name: 'Coffee Table', cat: 'living',   icon: '☕', w: 1.0, h: 0.4, d: 0.6, color: 0x8B6914 },
  { id: 'tv_stand',   name: 'TV Stand',     cat: 'living',   icon: '📺', w: 1.6, h: 0.5, d: 0.4, color: 0x333333 },
  { id: 'bookshelf',  name: 'Bookshelf',    cat: 'living',   icon: '📚', w: 1.0, h: 1.8, d: 0.35,color: 0x5C4033 },
  { id: 'floor_lamp', name: 'Floor Lamp',   cat: 'living',   icon: '💡', w: 0.3, h: 1.6, d: 0.3, color: 0xD4A860 },

  // Kitchen
  { id: 'counter',    name: 'Counter',      cat: 'kitchen',  icon: '🍽️', w: 2.0, h: 0.9, d: 0.6, color: 0xA0A0A0 },
  { id: 'fridge',     name: 'Fridge',       cat: 'kitchen',  icon: '🧊', w: 0.7, h: 1.8, d: 0.7, color: 0xE0E0E0 },
  { id: 'dining_tbl', name: 'Dining Table', cat: 'kitchen',  icon: '🪵', w: 1.4, h: 0.75,d: 0.8, color: 0xA0845C },
  { id: 'chair',      name: 'Chair',        cat: 'kitchen',  icon: '🪑', w: 0.5, h: 0.9, d: 0.5, color: 0x654321 },

  // Bathroom
  { id: 'toilet',     name: 'Toilet',       cat: 'bathroom', icon: '🚽', w: 0.4, h: 0.42,d: 0.65,color: 0xF0F0F0 },
  { id: 'sink',       name: 'Sink',         cat: 'bathroom', icon: '🚰', w: 0.55,h: 0.85,d: 0.45,color: 0xF0F0F0 },
  { id: 'bathtub',    name: 'Bathtub',      cat: 'bathroom', icon: '🛁', w: 0.8, h: 0.5, d: 1.7, color: 0xF5F5F5 },

  // Outdoor / courtyard
  { id: 'planter',    name: 'Planter',      cat: 'outdoor',  icon: '🌿', w: 0.5, h: 0.6, d: 0.5, color: 0x228B22 },
  { id: 'bench',      name: 'Bench',        cat: 'outdoor',  icon: '🪑', w: 1.5, h: 0.45,d: 0.5, color: 0x8B7355 },
  { id: 'lounge',     name: 'Lounge Chair', cat: 'outdoor',  icon: '🏖️', w: 0.7, h: 0.4, d: 1.8, color: 0xC19A6B },
];

// ── Placed furniture ──
export const placed = [];

// ── Create 3D mesh for a catalog item ──
export function createMesh(id, ghost = false) {
  const item = CATALOG.find((c) => c.id === id);
  if (!item) return null;

  const opacity = ghost ? 0.35 : 1;
  const transparent = ghost;

  const mat = new THREE.MeshStandardMaterial({
    color: item.color,
    roughness: 0.6,
    transparent,
    opacity,
  });
  const matDark = new THREE.MeshStandardMaterial({
    color: new THREE.Color(item.color).multiplyScalar(0.75),
    roughness: 0.6,
    transparent,
    opacity,
  });

  const group = new THREE.Group();

  switch (id) {
    case 'bed_double':
    case 'bed_single': {
      // frame
      const frame = new THREE.Mesh(new THREE.BoxGeometry(item.w + 0.1, 0.18, item.d + 0.1), matDark);
      frame.position.y = 0.09;
      group.add(frame);
      // mattress
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.22, item.d), new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.7, transparent, opacity }));
      mattress.position.y = 0.29;
      group.add(mattress);
      // headboard
      const hb = new THREE.Mesh(new THREE.BoxGeometry(item.w + 0.1, 0.7, 0.06), matDark);
      hb.position.set(0, 0.53, -item.d / 2);
      group.add(hb);
      break;
    }
    case 'sofa': {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.3, item.d), mat);
      seat.position.y = 0.25;
      group.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.45, 0.12), matDark);
      back.position.set(0, 0.55, -item.d / 2 + 0.06);
      group.add(back);
      for (const s of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, item.d), matDark);
        arm.position.set(s * (item.w / 2 - 0.05), 0.4, 0);
        group.add(arm);
      }
      break;
    }
    case 'armchair': {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.25, item.d - 0.1), mat);
      seat.position.y = 0.23;
      group.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.5, 0.1), matDark);
      back.position.set(0, 0.55, -item.d / 2 + 0.05);
      group.add(back);
      break;
    }
    case 'dining_tbl':
    case 'coffee_tbl': {
      const top = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.04, item.d), mat);
      top.position.y = item.h - 0.02;
      group.add(top);
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, item.h - 0.04), matDark);
        leg.position.set(sx * (item.w / 2 - 0.06), (item.h - 0.04) / 2, sz * (item.d / 2 - 0.06));
        group.add(leg);
      }
      break;
    }
    case 'chair': {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.04, item.d), mat);
      seat.position.y = 0.45;
      group.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.42, 0.04), matDark);
      back.position.set(0, 0.68, -item.d / 2 + 0.02);
      group.add(back);
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.45), matDark);
        leg.position.set(sx * (item.w / 2 - 0.04), 0.225, sz * (item.d / 2 - 0.04));
        group.add(leg);
      }
      break;
    }
    case 'floor_lamp': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.3), matDark);
      pole.position.y = 0.65;
      group.add(pole);
      const shade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.16, 0.22),
        new THREE.MeshStandardMaterial({ color: 0xFFF8DC, roughness: 0.5, transparent, opacity: ghost ? 0.35 : 0.85 })
      );
      shade.position.y = 1.42;
      group.add(shade);
      if (!ghost) {
        const light = new THREE.PointLight(0xFFE4B5, 0.6, 5);
        light.position.y = 1.4;
        group.add(light);
      }
      break;
    }
    case 'planter': {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.15, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9, transparent, opacity })
      );
      pot.position.y = 0.15;
      group.add(pot);
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x2D5A1E, roughness: 0.9, transparent, opacity })
      );
      leaf.position.y = 0.55;
      leaf.scale.y = 1.3;
      group.add(leaf);
      break;
    }
    default: {
      // Fallback box
      const box = new THREE.Mesh(new THREE.BoxGeometry(item.w, item.h, item.d), mat);
      box.position.y = item.h / 2;
      group.add(box);
    }
  }

  group.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });

  group.userData = { furnitureId: id, item };
  return group;
}

// ── Place furniture in scene ──
export function placeItem(id, x, z, rotY = 0) {
  const mesh = createMesh(id);
  if (!mesh) return null;
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rotY;
  scene.add(mesh);
  placed.push(mesh);
  return mesh;
}

// ── Remove furniture ──
export function removeItem(mesh) {
  scene.remove(mesh);
  const idx = placed.indexOf(mesh);
  if (idx !== -1) placed.splice(idx, 1);
}
