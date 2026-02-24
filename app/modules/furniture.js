import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { scene } from './scene.js';
import { FLOOR_HEIGHT } from './floor-manager.js';

// ── GLTFLoader singleton & cache ──
const loader = new GLTFLoader();
const modelCache = new Map(); // path -> Promise<THREE.Group>

function loadGLTF(path) {
  if (modelCache.has(path)) return modelCache.get(path);
  const promise = new Promise((resolve, reject) => {
    loader.load(
      path,
      (gltf) => resolve(gltf.scene),
      undefined,
      (err) => { console.warn(`Failed to load model: ${path}`, err); reject(err); }
    );
  });
  modelCache.set(path, promise);
  return promise;
}

/** Fit a loaded model into target w/h/d box, keeping proportions */
function fitModel(model, targetW, targetH, targetD) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  if (size.x < 0.001 || size.y < 0.001 || size.z < 0.001) return;
  const sx = targetW / size.x;
  const sy = targetH / size.y;
  const sz = targetD / size.z;
  const s = Math.min(sx, sy, sz);
  model.scale.multiplyScalar(s);
  // Re-center on X/Z origin, sit on Y=0
  const box2 = new THREE.Box3().setFromObject(model);
  const center = box2.getCenter(new THREE.Vector3());
  const min = box2.min;
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= min.y;
}

// ── Catalog ──
// model: path relative to /models/kenney/
export const CATALOG = [
  // ── Bedroom ──
  { id: 'bed_double',  name: 'Double Bed',     cat: 'bedroom',  w: 1.8, h: 0.6, d: 2.0, color: 0x8B7355, model: 'bedDouble.glb' },
  { id: 'bed_single',  name: 'Single Bed',     cat: 'bedroom',  w: 1.0, h: 0.6, d: 2.0, color: 0x8B7355, model: 'bedSingle.glb' },
  { id: 'bed_king',    name: 'King Bed',        cat: 'bedroom',  w: 2.1, h: 0.6, d: 2.2, color: 0x8B7355, model: 'bedDouble.glb' },
  { id: 'bunk_bed',    name: 'Bunk Bed',        cat: 'bedroom',  w: 1.0, h: 1.8, d: 2.0, color: 0x654321, model: 'bedBunk.glb' },
  { id: 'wardrobe',    name: 'Wardrobe',        cat: 'bedroom',  w: 1.2, h: 2.0, d: 0.6, color: 0x654321, model: 'bookcaseClosedDoors.glb' },
  { id: 'nightstand',  name: 'Nightstand',      cat: 'bedroom',  w: 0.5, h: 0.55,d: 0.4, color: 0x8B7355, model: 'sideTableDrawers.glb' },
  { id: 'dresser',     name: 'Dresser',         cat: 'bedroom',  w: 1.0, h: 0.85,d: 0.5, color: 0x654321, model: 'cabinetBedDrawer.glb' },
  { id: 'vanity',      name: 'Vanity Desk',     cat: 'bedroom',  w: 1.0, h: 0.75,d: 0.45,color: 0x8B7355, model: 'cabinetBedDrawerTable.glb' },
  { id: 'chest',       name: 'Storage Chest',   cat: 'bedroom',  w: 0.9, h: 0.5, d: 0.45,color: 0x7B5B3A, model: 'cabinetBed.glb' },
  { id: 'mirror_floor',name: 'Floor Mirror',    cat: 'bedroom',  w: 0.6, h: 1.7, d: 0.08,color: 0xC0D0E0, model: 'bathroomMirror.glb' },
  { id: 'coat_rack',   name: 'Coat Rack',       cat: 'bedroom',  w: 0.4, h: 1.7, d: 0.4, color: 0x654321, model: 'coatRackStanding.glb' },

  // ── Living ──
  { id: 'sofa',           name: 'Sofa',            cat: 'living', w: 2.2, h: 0.85,d: 0.9, color: 0x6B4423, model: 'loungeSofa.glb' },
  { id: 'sofa_3seat',     name: '3-Seat Sofa',     cat: 'living', w: 2.8, h: 0.85,d: 0.9, color: 0x5A3A1A, model: 'loungeSofaLong.glb' },
  { id: 'sectional',      name: 'L-Sectional',     cat: 'living', w: 2.8, h: 0.85,d: 2.8, color: 0x6B4423, model: 'loungeSofaCorner.glb' },
  { id: 'loveseat',       name: 'Loveseat',        cat: 'living', w: 1.6, h: 0.85,d: 0.85,color: 0x6B4423, model: 'loungeDesignSofa.glb' },
  { id: 'armchair',       name: 'Armchair',        cat: 'living', w: 0.85,h: 0.85,d: 0.85,color: 0x7B5B3A, model: 'loungeChair.glb' },
  { id: 'recliner',       name: 'Recliner',        cat: 'living', w: 0.9, h: 1.0, d: 0.9, color: 0x5A3A1A, model: 'loungeChairRelax.glb' },
  { id: 'ottoman',        name: 'Ottoman',         cat: 'living', w: 0.7, h: 0.4, d: 0.7, color: 0x6B4423, model: 'loungeSofaOttoman.glb' },
  { id: 'design_chair',   name: 'Design Chair',    cat: 'living', w: 0.7, h: 0.85,d: 0.7, color: 0x888888, model: 'loungeDesignChair.glb' },
  { id: 'coffee_tbl',     name: 'Coffee Table',    cat: 'living', w: 1.0, h: 0.4, d: 0.6, color: 0x8B6914, model: 'tableCoffee.glb' },
  { id: 'coffee_glass',   name: 'Glass Coffee Tbl',cat: 'living', w: 1.0, h: 0.4, d: 0.6, color: 0x8B6914, model: 'tableCoffeeGlass.glb' },
  { id: 'side_table',     name: 'Side Table',      cat: 'living', w: 0.5, h: 0.55,d: 0.5, color: 0x8B6914, model: 'sideTable.glb' },
  { id: 'console_table',  name: 'Console Table',   cat: 'living', w: 1.2, h: 0.75,d: 0.4, color: 0x654321, model: 'tableCross.glb' },
  { id: 'tv_stand',       name: 'TV Stand',        cat: 'living', w: 1.6, h: 0.5, d: 0.4, color: 0x333333, model: 'cabinetTelevision.glb' },
  { id: 'media_console',  name: 'Media Console',   cat: 'living', w: 1.8, h: 0.5, d: 0.4, color: 0x444444, model: 'cabinetTelevisionDoors.glb' },
  { id: 'tv_wall',        name: 'Wall TV',         cat: 'living', w: 1.2, h: 0.7, d: 0.08,color: 0x111111, model: 'televisionModern.glb' },
  { id: 'tv_vintage',     name: 'Vintage TV',      cat: 'living', w: 0.6, h: 0.5, d: 0.4, color: 0x333333, model: 'televisionVintage.glb' },
  { id: 'bookshelf',      name: 'Bookshelf',       cat: 'living', w: 1.0, h: 1.8, d: 0.35,color: 0x5C4033, model: 'bookcaseOpen.glb' },
  { id: 'bookshelf_low',  name: 'Low Bookshelf',   cat: 'living', w: 1.0, h: 0.9, d: 0.35,color: 0x5C4033, model: 'bookcaseOpenLow.glb' },
  { id: 'tall_bookcase',  name: 'Tall Bookcase',   cat: 'living', w: 1.2, h: 2.0, d: 0.35,color: 0x5C4033, model: 'bookcaseClosedWide.glb' },
  { id: 'cabinet',        name: 'Cabinet',         cat: 'living', w: 1.0, h: 0.9, d: 0.4, color: 0x654321, model: 'bookcaseClosed.glb' },
  { id: 'books',          name: 'Books',           cat: 'living', w: 0.3, h: 0.25,d: 0.2, color: 0x8B4513, model: 'books.glb' },
  { id: 'floor_lamp',     name: 'Floor Lamp',      cat: 'living', w: 0.35,h: 1.5, d: 0.35,color: 0xD4A860, model: 'lampRoundFloor.glb' },
  { id: 'floor_lamp_sq',  name: 'Square Floor Lamp',cat:'living', w: 0.35,h: 1.5, d: 0.35,color: 0xD4A860, model: 'lampSquareFloor.glb' },
  { id: 'table_lamp',     name: 'Table Lamp',      cat: 'living', w: 0.25,h: 0.35,d: 0.25,color: 0xD4A860, model: 'lampRoundTable.glb' },
  { id: 'pendant_lamp',   name: 'Pendant Lamp',    cat: 'living', w: 0.4, h: 0.3, d: 0.4, color: 0xD4A860, model: 'lampSquareCeiling.glb' },
  { id: 'wall_lamp',      name: 'Wall Lamp',       cat: 'living', w: 0.2, h: 0.25,d: 0.15,color: 0xD4A860, model: 'lampWall.glb' },
  { id: 'ceiling_fan',    name: 'Ceiling Fan',     cat: 'living', w: 1.2, h: 0.3, d: 1.2, color: 0x888888, model: 'ceilingFan.glb' },
  { id: 'plant_pot',      name: 'Potted Plant',    cat: 'living', w: 0.4, h: 0.8, d: 0.4, color: 0x2D5A1E, model: 'pottedPlant.glb' },
  { id: 'plant_small',    name: 'Small Plant',     cat: 'living', w: 0.25,h: 0.3, d: 0.25,color: 0x2D5A1E, model: 'plantSmall1.glb' },
  { id: 'rug_round',      name: 'Round Rug',       cat: 'living', w: 2.0, h: 0.02,d: 2.0, color: 0xA07850, model: 'rugRound.glb' },
  { id: 'rug_rect',       name: 'Area Rug',        cat: 'living', w: 2.5, h: 0.02,d: 1.8, color: 0x8B5A2B, model: 'rugRectangle.glb' },
  { id: 'rug_square',     name: 'Square Rug',      cat: 'living', w: 2.0, h: 0.02,d: 2.0, color: 0xA07850, model: 'rugSquare.glb' },
  { id: 'rug_doormat',    name: 'Doormat',         cat: 'living', w: 0.8, h: 0.02,d: 0.5, color: 0x8B5A2B, model: 'rugDoormat.glb' },
  { id: 'pillow',         name: 'Pillow',          cat: 'living', w: 0.4, h: 0.15,d: 0.4, color: 0xE8DDD0, model: 'pillow.glb' },
  { id: 'radio',          name: 'Radio',           cat: 'living', w: 0.3, h: 0.2, d: 0.15,color: 0x8B7355, model: 'radio.glb' },
  { id: 'speaker',        name: 'Speaker',         cat: 'living', w: 0.25,h: 0.4, d: 0.25,color: 0x333333, model: 'speaker.glb' },
  { id: 'bear',           name: 'Teddy Bear',      cat: 'living', w: 0.3, h: 0.35,d: 0.25,color: 0xC19A6B, model: 'bear.glb' },

  // ── Kitchen ──
  { id: 'counter',        name: 'Counter',         cat: 'kitchen', w: 1.0, h: 0.9, d: 0.6, color: 0xA0A0A0, model: 'kitchenBar.glb' },
  { id: 'counter_end',    name: 'Counter End',     cat: 'kitchen', w: 0.6, h: 0.9, d: 0.6, color: 0xA0A0A0, model: 'kitchenBarEnd.glb' },
  { id: 'island',         name: 'Kitchen Cabinet', cat: 'kitchen', w: 1.0, h: 0.9, d: 0.6, color: 0x555555, model: 'kitchenCabinet.glb' },
  { id: 'cabinet_drawer', name: 'Cabinet Drawer',  cat: 'kitchen', w: 1.0, h: 0.9, d: 0.6, color: 0xF5F0E8, model: 'kitchenCabinetDrawer.glb' },
  { id: 'cabinet_upper',  name: 'Upper Cabinet',   cat: 'kitchen', w: 0.8, h: 0.6, d: 0.35,color: 0xF5F0E8, model: 'kitchenCabinetUpper.glb' },
  { id: 'cabinet_upper_d',name: 'Upper Cab Double',cat: 'kitchen', w: 1.0, h: 0.6, d: 0.35,color: 0xF5F0E8, model: 'kitchenCabinetUpperDouble.glb' },
  { id: 'fridge',         name: 'Fridge',          cat: 'kitchen', w: 0.7, h: 1.8, d: 0.7, color: 0xE0E0E0, model: 'kitchenFridge.glb' },
  { id: 'fridge_large',   name: 'Large Fridge',    cat: 'kitchen', w: 0.9, h: 2.0, d: 0.8, color: 0xE0E0E0, model: 'kitchenFridgeLarge.glb' },
  { id: 'fridge_small',   name: 'Mini Fridge',     cat: 'kitchen', w: 0.5, h: 0.8, d: 0.5, color: 0xE0E0E0, model: 'kitchenFridgeSmall.glb' },
  { id: 'oven',           name: 'Stove/Oven',      cat: 'kitchen', w: 0.6, h: 0.9, d: 0.6, color: 0xC0C0C0, model: 'kitchenStove.glb' },
  { id: 'stove',          name: 'Electric Stove',  cat: 'kitchen', w: 0.6, h: 0.9, d: 0.6, color: 0x333333, model: 'kitchenStoveElectric.glb' },
  { id: 'sink_kitchen',   name: 'Kitchen Sink',    cat: 'kitchen', w: 0.8, h: 0.9, d: 0.6, color: 0xC0C0C0, model: 'kitchenSink.glb' },
  { id: 'microwave',      name: 'Microwave',       cat: 'kitchen', w: 0.5, h: 0.3, d: 0.35,color: 0xB0B0B0, model: 'kitchenMicrowave.glb' },
  { id: 'hood_large',     name: 'Range Hood',      cat: 'kitchen', w: 0.8, h: 0.4, d: 0.5, color: 0xC0C0C0, model: 'hoodLarge.glb' },
  { id: 'hood_modern',    name: 'Modern Hood',     cat: 'kitchen', w: 0.6, h: 0.5, d: 0.4, color: 0xC0C0C0, model: 'hoodModern.glb' },
  { id: 'blender',        name: 'Blender',         cat: 'kitchen', w: 0.15,h: 0.4, d: 0.15,color: 0x888888, model: 'kitchenBlender.glb' },
  { id: 'coffee_machine', name: 'Coffee Machine',  cat: 'kitchen', w: 0.25,h: 0.35,d: 0.3, color: 0x333333, model: 'kitchenCoffeeMachine.glb' },
  { id: 'toaster',        name: 'Toaster',         cat: 'kitchen', w: 0.25,h: 0.18,d: 0.15,color: 0xC0C0C0, model: 'toaster.glb' },
  { id: 'dining_tbl',     name: 'Dining Table',    cat: 'kitchen', w: 1.4, h: 0.75,d: 0.8, color: 0xA0845C, model: 'table.glb' },
  { id: 'dining_tbl_cloth',name:'Table w/ Cloth',  cat: 'kitchen', w: 1.4, h: 0.75,d: 0.8, color: 0xF5F0E8, model: 'tableCloth.glb' },
  { id: 'round_table',    name: 'Round Table',     cat: 'kitchen', w: 1.0, h: 0.75,d: 1.0, color: 0xA0845C, model: 'tableRound.glb' },
  { id: 'glass_table',    name: 'Glass Table',     cat: 'kitchen', w: 1.2, h: 0.75,d: 0.8, color: 0xBBDDFF, model: 'tableGlass.glb' },
  { id: 'chair',          name: 'Chair',           cat: 'kitchen', w: 0.5, h: 0.9, d: 0.5, color: 0x654321, model: 'chair.glb' },
  { id: 'chair_cushion',  name: 'Cushion Chair',   cat: 'kitchen', w: 0.5, h: 0.9, d: 0.5, color: 0x654321, model: 'chairCushion.glb' },
  { id: 'chair_modern',   name: 'Modern Chair',    cat: 'kitchen', w: 0.5, h: 0.85,d: 0.5, color: 0x888888, model: 'chairModernCushion.glb' },
  { id: 'chair_rounded',  name: 'Rounded Chair',   cat: 'kitchen', w: 0.5, h: 0.8, d: 0.5, color: 0x654321, model: 'chairRounded.glb' },
  { id: 'bar_stool',      name: 'Bar Stool',       cat: 'kitchen', w: 0.4, h: 0.75,d: 0.4, color: 0x333333, model: 'stoolBar.glb' },
  { id: 'bar_stool_sq',   name: 'Square Stool',    cat: 'kitchen', w: 0.4, h: 0.75,d: 0.4, color: 0x333333, model: 'stoolBarSquare.glb' },
  { id: 'trashcan',       name: 'Trash Can',       cat: 'kitchen', w: 0.3, h: 0.6, d: 0.3, color: 0x888888, model: 'trashcan.glb' },

  // ── Bathroom ──
  { id: 'toilet',         name: 'Toilet',          cat: 'bathroom', w: 0.4, h: 0.45,d: 0.65,color: 0xF0F0F0, model: 'toilet.glb' },
  { id: 'toilet_square',  name: 'Square Toilet',   cat: 'bathroom', w: 0.4, h: 0.45,d: 0.65,color: 0xF0F0F0, model: 'toiletSquare.glb' },
  { id: 'sink',           name: 'Sink',            cat: 'bathroom', w: 0.55,h: 0.85,d: 0.45,color: 0xF0F0F0, model: 'bathroomSink.glb' },
  { id: 'sink_square',    name: 'Square Sink',     cat: 'bathroom', w: 0.55,h: 0.85,d: 0.45,color: 0xF0F0F0, model: 'bathroomSinkSquare.glb' },
  { id: 'bathtub',        name: 'Bathtub',         cat: 'bathroom', w: 0.8, h: 0.5, d: 1.7, color: 0xF5F5F5, model: 'bathtub.glb' },
  { id: 'shower',         name: 'Shower',          cat: 'bathroom', w: 0.9, h: 2.1, d: 0.9, color: 0xDDEEFF, model: 'shower.glb' },
  { id: 'shower_round',   name: 'Round Shower',    cat: 'bathroom', w: 0.9, h: 2.1, d: 0.9, color: 0xDDEEFF, model: 'showerRound.glb' },
  { id: 'vanity_bath',    name: 'Bath Vanity',     cat: 'bathroom', w: 1.0, h: 0.85,d: 0.5, color: 0xF0F0F0, model: 'bathroomCabinet.glb' },
  { id: 'vanity_drawer',  name: 'Vanity Drawer',   cat: 'bathroom', w: 1.0, h: 0.85,d: 0.5, color: 0xF0F0F0, model: 'bathroomCabinetDrawer.glb' },
  { id: 'mirror_bath',    name: 'Bath Mirror',     cat: 'bathroom', w: 0.6, h: 0.6, d: 0.05,color: 0xC0D0E0, model: 'bathroomMirror.glb' },
  { id: 'laundry',        name: 'Washer',          cat: 'bathroom', w: 0.6, h: 0.85,d: 0.6, color: 0xE0E0E0, model: 'washer.glb' },
  { id: 'dryer',          name: 'Dryer',           cat: 'bathroom', w: 0.6, h: 0.85,d: 0.6, color: 0xD0D0D0, model: 'dryer.glb' },
  { id: 'washer_dryer',   name: 'Stacked W/D',     cat: 'bathroom', w: 0.6, h: 1.7, d: 0.6, color: 0xE0E0E0, model: 'washerDryerStacked.glb' },

  // ── Office ──
  { id: 'desk',           name: 'Desk',            cat: 'office', w: 1.4, h: 0.75,d: 0.7, color: 0x8B7355, model: 'desk.glb' },
  { id: 'desk_corner',    name: 'Corner Desk',     cat: 'office', w: 1.6, h: 0.75,d: 1.6, color: 0x654321, model: 'deskCorner.glb' },
  { id: 'office_chair',   name: 'Office Chair',    cat: 'office', w: 0.6, h: 1.0, d: 0.6, color: 0x333333, model: 'chairDesk.glb' },
  { id: 'monitor',        name: 'Monitor',         cat: 'office', w: 0.55,h: 0.4, d: 0.2, color: 0x222222, model: 'computerScreen.glb' },
  { id: 'laptop',         name: 'Laptop',          cat: 'office', w: 0.35,h: 0.03,d: 0.25,color: 0x333333, model: 'laptop.glb' },
  { id: 'keyboard',       name: 'Keyboard',        cat: 'office', w: 0.4, h: 0.03,d: 0.15,color: 0x333333, model: 'computerKeyboard.glb' },
  { id: 'mouse',          name: 'Mouse',           cat: 'office', w: 0.06,h: 0.03,d: 0.1, color: 0x333333, model: 'computerMouse.glb' },

  // ── Outdoor / Courtyard ──
  { id: 'planter',        name: 'Potted Plant',    cat: 'outdoor', w: 0.4, h: 0.8, d: 0.4, color: 0x228B22, model: 'pottedPlant.glb' },
  { id: 'plant_sm1',      name: 'Small Plant 1',   cat: 'outdoor', w: 0.2, h: 0.25,d: 0.2, color: 0x228B22, model: 'plantSmall1.glb' },
  { id: 'plant_sm2',      name: 'Small Plant 2',   cat: 'outdoor', w: 0.2, h: 0.25,d: 0.2, color: 0x228B22, model: 'plantSmall2.glb' },
  { id: 'plant_sm3',      name: 'Small Plant 3',   cat: 'outdoor', w: 0.2, h: 0.3, d: 0.2, color: 0x228B22, model: 'plantSmall3.glb' },
  { id: 'bench',          name: 'Bench',           cat: 'outdoor', w: 1.5, h: 0.45,d: 0.5, color: 0x8B7355, model: 'bench.glb' },
  { id: 'bench_cushion',  name: 'Cushion Bench',   cat: 'outdoor', w: 1.5, h: 0.5, d: 0.5, color: 0x8B7355, model: 'benchCushion.glb' },
  { id: 'bench_low',      name: 'Low Bench',       cat: 'outdoor', w: 1.5, h: 0.35,d: 0.5, color: 0x8B7355, model: 'benchCushionLow.glb' },
];

// ── Placed furniture ──
export const placed = [];

// ── Procedural fallback box (used for ghost preview or if model fails) ──
function createFallbackBox(item, ghost) {
  const opacity = ghost ? 0.35 : 1;
  const transparent = ghost;
  const mat = new THREE.MeshStandardMaterial({
    color: item.color,
    roughness: 0.6,
    transparent,
    opacity,
  });
  const group = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(item.w, item.h, item.d), mat);
  box.position.y = item.h / 2;
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);
  return group;
}

// ── Create 3D mesh for a catalog item ──
// Returns a THREE.Group immediately. If the item has a model, it loads async.
// Ghost preview always uses a simple transparent box.
export function createMesh(id, ghost = false) {
  const item = CATALOG.find((c) => c.id === id);
  if (!item) return null;

  // Ghost preview: always use transparent fallback box
  if (ghost) {
    const group = createFallbackBox(item, true);
    group.userData = { furnitureId: id, item };
    return group;
  }

  // No model → procedural fallback
  if (!item.model) {
    const group = createFallbackBox(item, false);
    group.userData = { furnitureId: id, item };
    return group;
  }

  // Has model → return group immediately, load GLB async
  const group = new THREE.Group();
  group.userData = { furnitureId: id, item };

  // Add a temporary placeholder box while model loads
  const placeholder = createFallbackBox(item, false);
  placeholder.userData._isPlaceholder = true;
  group.add(placeholder);

  const modelPath = `/models/kenney/${item.model}`;
  loadGLTF(modelPath).then((original) => {
    // Remove placeholder
    group.remove(placeholder);
    placeholder.traverse((c) => { if (c.isMesh) c.geometry.dispose(); });

    // Clone the loaded model
    const clone = original.clone();
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Fit to catalog dimensions
    fitModel(clone, item.w, item.h, item.d);
    group.add(clone);
  }).catch(() => {
    // Keep placeholder on failure — it's already there
  });

  return group;
}

// ── Place furniture in scene ──
export function placeItem(id, x, z, rotY = 0, floor = 0) {
  const mesh = createMesh(id);
  if (!mesh) return null;
  const yBase = floor * FLOOR_HEIGHT;
  mesh.position.set(x, yBase, z);
  mesh.rotation.y = rotY;
  mesh.userData.floor = floor;
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

/** Preload all models in catalog (fire-and-forget, populates cache) */
export function preloadModels() {
  const paths = new Set();
  for (const item of CATALOG) {
    if (item.model) paths.add(`/models/kenney/${item.model}`);
  }
  for (const path of paths) {
    loadGLTF(path);
  }
}

// ── Thumbnail rendering ──
const THUMB_SIZE = 128;
export const thumbnails = new Map(); // id -> dataURL

export async function generateThumbnails() {
  const thumbRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  thumbRenderer.setSize(THUMB_SIZE, THUMB_SIZE);
  thumbRenderer.setPixelRatio(1);
  thumbRenderer.setClearColor(0x000000, 0);

  const thumbScene = new THREE.Scene();
  const thumbCamera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);

  // 3-point lighting
  thumbScene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(3, 5, 4);
  thumbScene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-2, 3, -1);
  thumbScene.add(fill);

  const lightCount = thumbScene.children.length;
  const thumbByModel = new Map(); // model path -> dataURL (skip duplicate renders)

  for (const item of CATALOG) {
    if (!item.model) continue;
    const modelPath = `/models/kenney/${item.model}`;

    // Reuse thumbnail for items sharing the same GLB
    if (thumbByModel.has(modelPath)) {
      thumbnails.set(item.id, thumbByModel.get(modelPath));
      continue;
    }

    try {
      const original = await loadGLTF(modelPath);
      const clone = original.clone();

      // Compute bounding box & frame camera
      const box = new THREE.Box3().setFromObject(clone);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const halfFov = (35 / 2) * Math.PI / 180;
      const dist = (maxDim / 2) / Math.tan(halfFov) * 1.5;

      thumbCamera.position.set(
        center.x + dist * 0.65,
        center.y + dist * 0.5,
        center.z + dist * 0.65
      );
      thumbCamera.lookAt(center);

      // Clear previous model (keep lights)
      while (thumbScene.children.length > lightCount) {
        thumbScene.remove(thumbScene.children[thumbScene.children.length - 1]);
      }

      thumbScene.add(clone);
      thumbRenderer.render(thumbScene, thumbCamera);

      const dataURL = thumbRenderer.domElement.toDataURL('image/png');
      thumbnails.set(item.id, dataURL);
      thumbByModel.set(modelPath, dataURL);

      thumbScene.remove(clone);
    } catch (e) {
      // Skip failed models
    }
  }

  // Free resources
  thumbRenderer.dispose();
}
