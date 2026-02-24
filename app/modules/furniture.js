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
  { id: 'vanity',     name: 'Vanity Desk',  cat: 'bedroom',  icon: '🪞', w: 1.0, h: 0.75,d: 0.45,color: 0x8B7355 },

  // Living
  { id: 'sofa',          name: 'Sofa',          cat: 'living',   icon: '🛋️', w: 2.2, h: 0.85,d: 0.9, color: 0x6B4423 },
  { id: 'sectional',     name: 'L-Sectional',   cat: 'living',   icon: '🛋️', w: 2.8, h: 0.85,d: 2.8, color: 0x6B4423 },
  { id: 'armchair',      name: 'Armchair',      cat: 'living',   icon: '💺', w: 0.85,h: 0.85,d: 0.85,color: 0x7B5B3A },
  { id: 'coffee_tbl',    name: 'Coffee Table',  cat: 'living',   icon: '☕', w: 1.0, h: 0.4, d: 0.6, color: 0x8B6914 },
  { id: 'side_table',    name: 'Side Table',    cat: 'living',   icon: '🔲', w: 0.5, h: 0.55,d: 0.5, color: 0x8B6914 },
  { id: 'console_table', name: 'Console Table', cat: 'living',   icon: '🔲', w: 1.2, h: 0.75,d: 0.35,color: 0x654321 },
  { id: 'tv_stand',      name: 'TV Stand',      cat: 'living',   icon: '📺', w: 1.6, h: 0.5, d: 0.4, color: 0x333333 },
  { id: 'media_console', name: 'Media Console', cat: 'living',   icon: '📺', w: 1.8, h: 0.5, d: 0.4, color: 0x444444 },
  { id: 'bookshelf',     name: 'Bookshelf',     cat: 'living',   icon: '📚', w: 1.0, h: 1.8, d: 0.35,color: 0x5C4033 },
  { id: 'floor_lamp',    name: 'Floor Lamp',    cat: 'living',   icon: '💡', w: 0.3, h: 1.6, d: 0.3, color: 0xD4A860 },
  { id: 'pendant_lamp',  name: 'Pendant Lamp',  cat: 'living',   icon: '💡', w: 0.4, h: 0.3, d: 0.4, color: 0xD4A860 },
  { id: 'pouf',          name: 'Moroccan Pouf', cat: 'living',   icon: '🟤', w: 0.5, h: 0.35,d: 0.5, color: 0xC87830 },
  { id: 'floor_cushion', name: 'Floor Cushion', cat: 'living',   icon: '🟫', w: 0.7, h: 0.12,d: 0.7, color: 0xA05030 },
  { id: 'rug_round',     name: 'Round Rug',     cat: 'living',   icon: '⭕', w: 2.0, h: 0.01,d: 2.0, color: 0xA07850 },
  { id: 'rug_rect',      name: 'Area Rug',      cat: 'living',   icon: '🟫', w: 2.5, h: 0.01,d: 1.8, color: 0x8B5A2B },

  // Kitchen
  { id: 'counter',     name: 'Counter',       cat: 'kitchen',  icon: '🍽️', w: 2.0, h: 0.9, d: 0.6, color: 0xA0A0A0 },
  { id: 'island',      name: 'Kitchen Island',cat: 'kitchen',  icon: '🏝️', w: 1.5, h: 0.9, d: 0.8, color: 0x555555 },
  { id: 'fridge',      name: 'Fridge',        cat: 'kitchen',  icon: '🧊', w: 0.7, h: 1.8, d: 0.7, color: 0xE0E0E0 },
  { id: 'dining_tbl',  name: 'Dining Table',  cat: 'kitchen',  icon: '🪵', w: 1.4, h: 0.75,d: 0.8, color: 0xA0845C },
  { id: 'round_table', name: 'Round Table',   cat: 'kitchen',  icon: '⚪', w: 1.0, h: 0.75,d: 1.0, color: 0xA0845C },
  { id: 'chair',       name: 'Chair',         cat: 'kitchen',  icon: '🪑', w: 0.5, h: 0.9, d: 0.5, color: 0x654321 },
  { id: 'bar_stool',   name: 'Bar Stool',     cat: 'kitchen',  icon: '🪑', w: 0.4, h: 0.75,d: 0.4, color: 0x333333 },

  // Bathroom
  { id: 'toilet',  name: 'Toilet',  cat: 'bathroom', icon: '🚽', w: 0.4, h: 0.42,d: 0.65,color: 0xF0F0F0 },
  { id: 'sink',    name: 'Sink',    cat: 'bathroom', icon: '🚰', w: 0.55,h: 0.85,d: 0.45,color: 0xF0F0F0 },
  { id: 'bathtub', name: 'Bathtub', cat: 'bathroom', icon: '🛁', w: 0.8, h: 0.5, d: 1.7, color: 0xF5F5F5 },
  { id: 'shower',  name: 'Shower',  cat: 'bathroom', icon: '🚿', w: 0.9, h: 2.1, d: 0.9, color: 0xDDEEFF },

  // Outdoor / courtyard
  { id: 'planter',       name: 'Planter',       cat: 'outdoor',  icon: '🌿', w: 0.5, h: 0.6, d: 0.5, color: 0x228B22 },
  { id: 'large_planter', name: 'Large Planter', cat: 'outdoor',  icon: '🌳', w: 0.7, h: 0.9, d: 0.7, color: 0x228B22 },
  { id: 'bench',         name: 'Bench',         cat: 'outdoor',  icon: '🪑', w: 1.5, h: 0.45,d: 0.5, color: 0x8B7355 },
  { id: 'daybed',        name: 'Daybed',        cat: 'outdoor',  icon: '🛏️', w: 2.0, h: 0.45,d: 0.8, color: 0xA08060 },
  { id: 'lounge',        name: 'Lounge Chair',  cat: 'outdoor',  icon: '🏖️', w: 0.7, h: 0.4, d: 1.8, color: 0xC19A6B },
  { id: 'hanging_plant', name: 'Hanging Plant', cat: 'outdoor',  icon: '🌱', w: 0.35,h: 0.8, d: 0.35,color: 0x2D5A1E },
  { id: 'fire_pit',      name: 'Fire Pit',      cat: 'outdoor',  icon: '🔥', w: 0.8, h: 0.35,d: 0.8, color: 0x555555 },
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
  const matLight = new THREE.MeshStandardMaterial({
    color: new THREE.Color(item.color).multiplyScalar(1.3),
    roughness: 0.5,
    transparent,
    opacity,
  });

  const group = new THREE.Group();

  switch (id) {
    case 'bed_double':
    case 'bed_single': {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(item.w + 0.1, 0.18, item.d + 0.1), matDark);
      frame.position.y = 0.09;
      group.add(frame);
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.22, item.d), new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.7, transparent, opacity }));
      mattress.position.y = 0.29;
      group.add(mattress);
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
    case 'sectional': {
      // L-shaped sectional: main seat + perpendicular extension
      const seatW = 2.8, seatD = 0.9;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(seatW, 0.3, seatD), mat);
      seat.position.set(0, 0.25, seatD / 2 - item.d / 2);
      group.add(seat);
      const back1 = new THREE.Mesh(new THREE.BoxGeometry(seatW, 0.45, 0.12), matDark);
      back1.position.set(0, 0.55, -item.d / 2 + 0.06);
      group.add(back1);
      // Extension leg
      const extD = item.d - seatD;
      const ext = new THREE.Mesh(new THREE.BoxGeometry(seatD, 0.3, extD), mat);
      ext.position.set(-seatW / 2 + seatD / 2, 0.25, seatD / 2 - item.d / 2 + seatD / 2 + extD / 2);
      group.add(ext);
      const back2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, extD + seatD), matDark);
      back2.position.set(-seatW / 2 + 0.06, 0.55, 0);
      group.add(back2);
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
    case 'coffee_tbl':
    case 'side_table':
    case 'console_table': {
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
    case 'round_table': {
      // Cylinder top + pedestal
      const topGeo = new THREE.CylinderGeometry(item.w / 2, item.w / 2, 0.04, 24);
      const top = new THREE.Mesh(topGeo, mat);
      top.position.y = item.h - 0.02;
      group.add(top);
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, item.h - 0.04, 12), matDark);
      pedestal.position.y = (item.h - 0.04) / 2;
      group.add(pedestal);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 16), matDark);
      base.position.y = 0.015;
      group.add(base);
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
    case 'bar_stool': {
      // Tall legs + round seat + footrest torus
      const seatGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.04, 16);
      const seatMesh = new THREE.Mesh(seatGeo, mat);
      seatMesh.position.y = item.h - 0.02;
      group.add(seatMesh);
      // 4 legs
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, item.h - 0.04), matDark);
        leg.position.set(sx * 0.1, (item.h - 0.04) / 2, sz * 0.1);
        group.add(leg);
      }
      // Footrest ring
      const footrest = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 8, 16), matDark);
      footrest.position.y = item.h * 0.35;
      footrest.rotation.x = Math.PI / 2;
      group.add(footrest);
      break;
    }
    case 'island': {
      // Box body + contrasting top slab
      const body = new THREE.Mesh(new THREE.BoxGeometry(item.w, item.h - 0.04, item.d), matDark);
      body.position.y = (item.h - 0.04) / 2;
      group.add(body);
      const topSlab = new THREE.Mesh(new THREE.BoxGeometry(item.w + 0.04, 0.04, item.d + 0.04), matLight);
      topSlab.position.y = item.h - 0.02;
      group.add(topSlab);
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
    case 'pendant_lamp': {
      // Cable from ceiling + cone shade + PointLight
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.5), matDark);
      cable.position.y = 2.25;
      group.add(cable);
      const shade = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.25, 16, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xD4A860, roughness: 0.4, side: THREE.DoubleSide, transparent, opacity: ghost ? 0.35 : 0.9 })
      );
      shade.position.y = 1.55;
      shade.rotation.x = Math.PI; // open side down
      group.add(shade);
      if (!ghost) {
        const light = new THREE.PointLight(0xFFE4B5, 0.8, 6);
        light.position.y = 1.5;
        group.add(light);
      }
      break;
    }
    case 'vanity': {
      // Table + mirror panel
      const top = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.04, item.d), mat);
      top.position.y = item.h - 0.02;
      group.add(top);
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, item.h - 0.04), matDark);
        leg.position.set(sx * (item.w / 2 - 0.05), (item.h - 0.04) / 2, sz * (item.d / 2 - 0.05));
        group.add(leg);
      }
      // Mirror
      const mirror = new THREE.Mesh(
        new THREE.BoxGeometry(item.w * 0.7, 0.6, 0.02),
        new THREE.MeshStandardMaterial({ color: 0xC0D0E0, roughness: 0.05, metalness: 0.8, transparent, opacity })
      );
      mirror.position.set(0, item.h + 0.32, -item.d / 2 + 0.01);
      group.add(mirror);
      break;
    }
    case 'shower': {
      // 3 glass walls + showerhead
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0xBBDDFF, roughness: 0.0, metalness: 0.1,
        transparent: true, opacity: ghost ? 0.15 : 0.12,
        side: THREE.DoubleSide,
      });
      // Back wall
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(item.w, item.h, 0.01), glassMat);
      backWall.position.set(0, item.h / 2, -item.d / 2);
      group.add(backWall);
      // Side walls
      for (const s of [-1, 1]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.01, item.h, item.d), glassMat);
        side.position.set(s * item.w / 2, item.h / 2, 0);
        group.add(side);
      }
      // Showerhead
      const head = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.02, 12),
        new THREE.MeshStandardMaterial({ color: 0xCCCCCC, metalness: 0.8, roughness: 0.2, transparent, opacity })
      );
      head.position.set(0, item.h - 0.15, -item.d / 2 + 0.15);
      group.add(head);
      break;
    }
    case 'pouf': {
      // Squished sphere
      const geo = new THREE.SphereGeometry(item.w / 2, 16, 12);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.y = 0.6;
      mesh.position.y = item.h * 0.5;
      group.add(mesh);
      break;
    }
    case 'floor_cushion': {
      // Rounded low box
      const geo = new THREE.BoxGeometry(item.w, item.h, item.d);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = item.h / 2;
      group.add(mesh);
      break;
    }
    case 'rug_round': {
      // Circle geometry with concentric ring colors
      const geo = new THREE.CircleGeometry(item.w / 2, 32);
      const rugMat = new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.85, transparent, opacity, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, rugMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.005;
      group.add(mesh);
      // Inner ring
      const inner = new THREE.Mesh(
        new THREE.RingGeometry(item.w / 4 - 0.05, item.w / 4, 32),
        new THREE.MeshStandardMaterial({ color: 0xC8A060, roughness: 0.85, transparent, opacity, side: THREE.DoubleSide })
      );
      inner.rotation.x = -Math.PI / 2;
      inner.position.y = 0.006;
      group.add(inner);
      break;
    }
    case 'rug_rect': {
      // Flat plane with kilim-inspired border
      const geo = new THREE.PlaneGeometry(item.w, item.d);
      const rugMat = new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.85, transparent, opacity, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, rugMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.005;
      group.add(mesh);
      // Border frame
      const borderMat = new THREE.MeshStandardMaterial({ color: 0xC87830, roughness: 0.85, transparent, opacity, side: THREE.DoubleSide });
      const bw = 0.08;
      for (const [bx, bz, bW, bD] of [
        [0, item.d / 2 - bw / 2, item.w, bw],
        [0, -item.d / 2 + bw / 2, item.w, bw],
        [item.w / 2 - bw / 2, 0, bw, item.d - bw * 2],
        [-item.w / 2 + bw / 2, 0, bw, item.d - bw * 2],
      ]) {
        const border = new THREE.Mesh(new THREE.PlaneGeometry(bW, bD), borderMat);
        border.rotation.x = -Math.PI / 2;
        border.position.set(bx, 0.006, bz);
        group.add(border);
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
    case 'large_planter': {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.22, 0.5, 12),
        new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9, transparent, opacity })
      );
      pot.position.y = 0.25;
      group.add(pot);
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x2D5A1E, roughness: 0.85, transparent, opacity })
      );
      leaf.position.y = 0.75;
      leaf.scale.y = 1.4;
      group.add(leaf);
      break;
    }
    case 'hanging_plant': {
      // Chains from ceiling + pot + foliage
      for (const dx of [-0.08, 0.08]) {
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.2), matDark);
        chain.position.set(dx, 2.1, 0);
        group.add(chain);
      }
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.10, 0.18, 8),
        new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9, transparent, opacity })
      );
      pot.position.y = 1.5;
      group.add(pot);
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x2D5A1E, roughness: 0.9, transparent, opacity })
      );
      leaf.position.y = 1.55;
      leaf.scale.set(1.2, 0.8, 1.2);
      group.add(leaf);
      // Trailing vines
      const vineMat = new THREE.MeshStandardMaterial({ color: 0x3A7A2A, roughness: 0.9, transparent, opacity });
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.008, 0.4, 4), vineMat);
        vine.position.set(Math.cos(angle) * 0.12, 1.3, Math.sin(angle) * 0.12);
        vine.rotation.z = Math.PI / 6 * (i % 2 === 0 ? 1 : -1);
        group.add(vine);
      }
      break;
    }
    case 'daybed': {
      // Wide bench + thick cushion + raised back
      const base = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.2, item.d), matDark);
      base.position.y = 0.1;
      group.add(base);
      const cushion = new THREE.Mesh(
        new THREE.BoxGeometry(item.w - 0.04, 0.15, item.d - 0.04),
        new THREE.MeshStandardMaterial({ color: 0xE8DDD0, roughness: 0.7, transparent, opacity })
      );
      cushion.position.y = 0.275;
      group.add(cushion);
      const back = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.35, 0.08), matDark);
      back.position.set(0, 0.375, -item.d / 2 + 0.04);
      group.add(back);
      break;
    }
    case 'fire_pit': {
      // Cylinder ring + emissive "flame" spheres + PointLight
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(item.w / 2 - 0.05, 0.08, 12, 24),
        new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8, transparent, opacity })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.12;
      group.add(ring);
      // Inner base
      const innerBase = new THREE.Mesh(
        new THREE.CylinderGeometry(item.w / 2 - 0.1, item.w / 2 - 0.1, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9, transparent, opacity })
      );
      innerBase.position.y = 0.04;
      group.add(innerBase);
      // Flame spheres
      if (!ghost) {
        const flameMat = new THREE.MeshStandardMaterial({
          color: 0xFF6600, emissive: 0xFF4400, emissiveIntensity: 1.5,
          transparent: true, opacity: 0.8,
        });
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2;
          const flame = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), flameMat);
          flame.position.set(Math.cos(angle) * 0.12, 0.15 + Math.random() * 0.1, Math.sin(angle) * 0.12);
          flame.scale.y = 1.5;
          group.add(flame);
        }
        const fireLight = new THREE.PointLight(0xFF6600, 0.8, 4);
        fireLight.position.y = 0.3;
        group.add(fireLight);
      }
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
