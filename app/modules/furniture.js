import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { scene } from './scene.js';
import { FLOOR_HEIGHT } from './floor-manager.js';

// Building XZ coordinates are ~3.4× larger than meters (Y is 1:1 meters).
// Furniture catalog dimensions are in real meters, so we scale XZ to match the scene.
export const SCENE_XZ_SCALE = 3.4;

// ── GLTFLoader singleton & cache ──
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
dracoLoader.setDecoderConfig({ type: 'js' });
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
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

/** Fit a loaded model into target w/h/d box, scaled to match scene coordinates.
 *  XZ dimensions are multiplied by SCENE_XZ_SCALE since the building uses
 *  ~3.4× larger XZ units than meters, while Y (height) is 1:1 meters. */
function fitModel(model, targetW, targetH, targetD) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  if (size.x < 0.001 || size.y < 0.001 || size.z < 0.001) return;
  const sceneW = targetW * SCENE_XZ_SCALE;
  const sceneD = targetD * SCENE_XZ_SCALE;
  model.scale.set(sceneW / size.x, targetH / size.y, sceneD / size.z);
  // Re-center on X/Z origin, sit on Y=0
  const box2 = new THREE.Box3().setFromObject(model);
  const center = box2.getCenter(new THREE.Vector3());
  const min = box2.min;
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= min.y;
}

// ── PBR Material Overrides ──

const CATEGORY_MATERIAL_OVERRIDES = {
  bedroom:  { roughness: 0.65, metalness: 0, envMapIntensity: 0.4 },
  living:   { roughness: 0.55, metalness: 0.05, envMapIntensity: 0.5 },
  kitchen:  { roughness: 0.35, metalness: 0.15, envMapIntensity: 0.6 },
  bathroom: { roughness: 0.2, metalness: 0.1, envMapIntensity: 0.7 },
  office:   { roughness: 0.45, metalness: 0.1, envMapIntensity: 0.5 },
  outdoor:  { roughness: 0.7, metalness: 0, envMapIntensity: 0.3 },
};

const ITEM_MATERIAL_OVERRIDES = {
  // Lamps — warm emissive glow
  floor_lamp:    { emissive: 0xFFE4B5, emissiveIntensity: 0.5 },
  floor_lamp_sq: { emissive: 0xFFE4B5, emissiveIntensity: 0.5 },
  table_lamp:    { emissive: 0xFFE4B5, emissiveIntensity: 0.6 },
  pendant_lamp:  { emissive: 0xFFE4B5, emissiveIntensity: 0.4 },
  wall_lamp:     { emissive: 0xFFE4B5, emissiveIntensity: 0.5 },
  // Glass tables
  coffee_glass:  { roughness: 0.05, envMapIntensity: 0.9, transparent: true, opacity: 0.3 },
  glass_table:   { roughness: 0.05, envMapIntensity: 0.9, transparent: true, opacity: 0.3 },
  // Mirrors
  mirror_floor:  { roughness: 0.02, metalness: 0.9, envMapIntensity: 1.0 },
  mirror_bath:   { roughness: 0.02, metalness: 0.9, envMapIntensity: 1.0 },
  // Appliances (metallic)
  fridge:        { roughness: 0.15, metalness: 0.6, envMapIntensity: 0.7 },
  fridge_large:  { roughness: 0.15, metalness: 0.6, envMapIntensity: 0.7 },
  fridge_small:  { roughness: 0.2, metalness: 0.5, envMapIntensity: 0.6 },
  oven:          { roughness: 0.15, metalness: 0.6, envMapIntensity: 0.7 },
  stove:         { roughness: 0.15, metalness: 0.5, envMapIntensity: 0.6 },
  microwave:     { roughness: 0.2, metalness: 0.5, envMapIntensity: 0.6 },
  hood_large:    { roughness: 0.15, metalness: 0.6, envMapIntensity: 0.7 },
  hood_modern:   { roughness: 0.15, metalness: 0.6, envMapIntensity: 0.7 },
  laundry:       { roughness: 0.2, metalness: 0.5, envMapIntensity: 0.6 },
  dryer:         { roughness: 0.2, metalness: 0.5, envMapIntensity: 0.6 },
  washer_dryer:  { roughness: 0.2, metalness: 0.5, envMapIntensity: 0.6 },
  // Ceramics (smooth glossy)
  toilet:        { roughness: 0.12, envMapIntensity: 0.6 },
  toilet_square: { roughness: 0.12, envMapIntensity: 0.6 },
  sink:          { roughness: 0.15, envMapIntensity: 0.5 },
  sink_square:   { roughness: 0.15, envMapIntensity: 0.5 },
  sink_kitchen:  { roughness: 0.15, metalness: 0.4, envMapIntensity: 0.6 },
  bathtub:       { roughness: 0.12, envMapIntensity: 0.6 },
  shower:        { roughness: 0.1, envMapIntensity: 0.5, transparent: true, opacity: 0.4 },
  shower_round:  { roughness: 0.1, envMapIntensity: 0.5, transparent: true, opacity: 0.4 },
  // TV/monitors
  tv_wall:       { roughness: 0.1, metalness: 0.3, emissive: 0x111122, emissiveIntensity: 0.3 },
  tv_vintage:    { roughness: 0.3, metalness: 0.2 },
  monitor:       { roughness: 0.1, metalness: 0.3, emissive: 0x111122, emissiveIntensity: 0.3 },
  laptop:        { roughness: 0.15, metalness: 0.4, envMapIntensity: 0.6 },
};

/** Apply PBR material overrides to a furniture group */
function applyMaterialOverrides(group, catalogItem) {
  const catOverrides = CATEGORY_MATERIAL_OVERRIDES[catalogItem.cat] || {};
  const itemOverrides = ITEM_MATERIAL_OVERRIDES[catalogItem.id] || {};
  const merged = { ...catOverrides, ...itemOverrides };

  if (Object.keys(merged).length === 0) return;

  group.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mat = child.material;
    if (!mat.isMeshStandardMaterial) return;

    if (merged.roughness !== undefined) mat.roughness = merged.roughness;
    if (merged.metalness !== undefined) mat.metalness = merged.metalness;
    if (merged.envMapIntensity !== undefined) mat.envMapIntensity = merged.envMapIntensity;
    if (merged.emissive !== undefined) mat.emissive = new THREE.Color(merged.emissive);
    if (merged.emissiveIntensity !== undefined) mat.emissiveIntensity = merged.emissiveIntensity;
    if (merged.transparent !== undefined) {
      mat.transparent = merged.transparent;
      mat.opacity = merged.opacity !== undefined ? merged.opacity : 1.0;
    }
    mat.needsUpdate = true;
  });
}

// ── Contact shadow disc ──
const contactShadowCache = new Map(); // size -> texture

function getContactShadowTexture() {
  const key = 128;
  if (contactShadowCache.has(key)) return contactShadowCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = key;
  canvas.height = key;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0.0, 'rgba(0,0,0,0.35)');
  grad.addColorStop(0.4, 'rgba(0,0,0,0.2)');
  grad.addColorStop(0.7, 'rgba(0,0,0,0.08)');
  grad.addColorStop(1.0, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, key, key);
  const tex = new THREE.CanvasTexture(canvas);
  contactShadowCache.set(key, tex);
  return tex;
}

function createContactShadow(item) {
  const shadowSize = Math.max(item.w, item.d) * SCENE_XZ_SCALE * 1.1;
  const geo = new THREE.PlaneGeometry(shadowSize, shadowSize);
  const mat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.005;
  mesh.name = '__contactShadow';
  return mesh;
}

// ── Catalog ──
// model: path relative to /models/ (kenney/ = low-poly kit, ikea/ = realistic IKEA)
export const CATALOG = [
  // ── Bedroom ──
  { id: 'bed_double',  name: 'Double Bed',     cat: 'bedroom',  w: 1.8, h: 0.6, d: 2.0, color: 0x8B7355, model: 'ikea/hemnes_bed_frame_white_stain_luroey.glb' },
  { id: 'bed_single',  name: 'Single Bed',     cat: 'bedroom',  w: 1.0, h: 0.6, d: 2.0, color: 0x8B7355, model: 'kenney/bedSingle.glb' },
  { id: 'bed_king',    name: 'King Bed',        cat: 'bedroom',  w: 2.1, h: 0.6, d: 2.2, color: 0x8B7355, model: 'ikea/nordli_bed_with_headboard_and_storage_an.glb' },
  { id: 'bunk_bed',    name: 'Bunk Bed',        cat: 'bedroom',  w: 1.0, h: 1.8, d: 2.0, color: 0x654321, model: 'kenney/bedBunk.glb' },
  { id: 'wardrobe',    name: 'Wardrobe',        cat: 'bedroom',  w: 1.2, h: 2.0, d: 0.6, color: 0x654321, model: 'ikea/kleppstad_wardrobe_with_3_doors_white.glb' },
  { id: 'nightstand',  name: 'Nightstand',      cat: 'bedroom',  w: 0.5, h: 0.55,d: 0.4, color: 0x8B7355, model: 'ikea/hemnes_2_drawer_chest_black_brown.glb' },
  { id: 'dresser',     name: 'Dresser',         cat: 'bedroom',  w: 1.0, h: 0.85,d: 0.5, color: 0x654321, model: 'ikea/hauga_2_drawer_chest_white.glb' },
  { id: 'vanity',      name: 'Vanity Desk',     cat: 'bedroom',  w: 1.0, h: 0.75,d: 0.45,color: 0x8B7355, model: 'kenney/cabinetBedDrawerTable.glb' },
  { id: 'chest',       name: 'Storage Chest',   cat: 'bedroom',  w: 0.9, h: 0.5, d: 0.45,color: 0x7B5B3A, model: 'kenney/cabinetBed.glb' },
  { id: 'mirror_floor',name: 'Floor Mirror',    cat: 'bedroom',  w: 0.6, h: 1.7, d: 0.08,color: 0xC0D0E0, model: 'kenney/bathroomMirror.glb' },
  { id: 'coat_rack',   name: 'Coat Rack',       cat: 'bedroom',  w: 0.4, h: 1.7, d: 0.4, color: 0x654321, model: 'kenney/coatRackStanding.glb' },

  // ── Living ──
  { id: 'sofa',           name: 'Sofa',            cat: 'living', w: 2.2, h: 0.85,d: 0.9, color: 0x6B4423, model: 'ikea/morabo_sofa_gunnared_dark_gray_wood.glb' },
  { id: 'sofa_3seat',     name: '3-Seat Sofa',     cat: 'living', w: 2.8, h: 0.85,d: 0.9, color: 0x5A3A1A, model: 'ikea/finnala_sofa_gunnared_medium_gray.glb' },
  { id: 'sectional',      name: 'L-Sectional',     cat: 'living', w: 2.8, h: 0.85,d: 2.8, color: 0x6B4423, model: 'ikea/uppland_sectional_4_seat_corner_hakebo_d.glb' },
  { id: 'loveseat',       name: 'Loveseat',        cat: 'living', w: 1.6, h: 0.85,d: 0.85,color: 0x6B4423, model: 'ikea/glostad_loveseat_knisa_medium_blue.glb' },
  { id: 'armchair',       name: 'Armchair',        cat: 'living', w: 0.85,h: 0.85,d: 0.85,color: 0x7B5B3A, model: 'ikea/strandmon_wing_chair_nordvalla_dark_gray.glb' },
  { id: 'recliner',       name: 'Recliner',        cat: 'living', w: 0.9, h: 1.0, d: 0.9, color: 0x5A3A1A, model: 'kenney/loungeChairRelax.glb' },
  { id: 'ottoman',        name: 'Ottoman',         cat: 'living', w: 0.7, h: 0.4, d: 0.7, color: 0x6B4423, model: 'kenney/loungeSofaOttoman.glb' },
  { id: 'design_chair',   name: 'Design Chair',    cat: 'living', w: 0.7, h: 0.85,d: 0.7, color: 0x888888, model: 'ikea/froeset_chair_white_stained_oak_veneer.glb' },
  { id: 'coffee_tbl',     name: 'Coffee Table',    cat: 'living', w: 1.0, h: 0.4, d: 0.6, color: 0x8B6914, model: 'ikea/lack_coffee_table_black_brown.glb' },
  { id: 'coffee_glass',   name: 'Glass Coffee Tbl',cat: 'living', w: 1.0, h: 0.4, d: 0.6, color: 0x8B6914, model: 'ikea/stockholm_2025_coffee_table_oak_veneer_g.glb' },
  { id: 'side_table',     name: 'Side Table',      cat: 'living', w: 0.5, h: 0.55,d: 0.5, color: 0x8B6914, model: 'ikea/lack_side_table_white.glb' },
  { id: 'console_table',  name: 'Console Table',   cat: 'living', w: 1.2, h: 0.75,d: 0.4, color: 0x654321, model: 'kenney/tableCross.glb' },
  { id: 'tv_stand',       name: 'TV Stand',        cat: 'living', w: 1.6, h: 0.5, d: 0.4, color: 0x333333, model: 'ikea/besta_tv_bench_with_doors_white_lappvike.glb' },
  { id: 'media_console',  name: 'Media Console',   cat: 'living', w: 1.8, h: 0.5, d: 0.4, color: 0x444444, model: 'ikea/hemnes_tv_unit_black_brown.glb' },
  { id: 'tv_wall',        name: 'Wall TV',         cat: 'living', w: 1.2, h: 0.7, d: 0.08,color: 0x111111, model: 'kenney/televisionModern.glb' },
  { id: 'tv_vintage',     name: 'Vintage TV',      cat: 'living', w: 0.6, h: 0.5, d: 0.4, color: 0x333333, model: 'kenney/televisionVintage.glb' },
  { id: 'bookshelf',      name: 'Bookshelf',       cat: 'living', w: 1.0, h: 1.8, d: 0.35,color: 0x5C4033, model: 'ikea/billy_bookcase_dark_brown_oak_effect.glb' },
  { id: 'bookshelf_low',  name: 'Low Bookshelf',   cat: 'living', w: 1.0, h: 0.9, d: 0.35,color: 0x5C4033, model: 'ikea/kallax_shelf_unit_black_brown.glb' },
  { id: 'tall_bookcase',  name: 'Tall Bookcase',   cat: 'living', w: 1.2, h: 2.0, d: 0.35,color: 0x5C4033, model: 'ikea/billy_oxberg_bookcase_with_doors_dark_br.glb' },
  { id: 'cabinet',        name: 'Cabinet',         cat: 'living', w: 1.0, h: 0.9, d: 0.4, color: 0x654321, model: 'ikea/hauga_high_cabinet_with_2_doors_white.glb' },
  { id: 'books',          name: 'Books',           cat: 'living', w: 0.3, h: 0.25,d: 0.2, color: 0x8B4513, model: 'kenney/books.glb' },
  { id: 'floor_lamp',     name: 'Floor Lamp',      cat: 'living', w: 0.35,h: 1.5, d: 0.35,color: 0xD4A860, model: 'ikea/lauters_floor_lamp_ash_white.glb' },
  { id: 'floor_lamp_sq',  name: 'Square Floor Lamp',cat:'living', w: 0.35,h: 1.5, d: 0.35,color: 0xD4A860, model: 'ikea/vindkast_floor_lamp_white.glb' },
  { id: 'table_lamp',     name: 'Table Lamp',      cat: 'living', w: 0.25,h: 0.35,d: 0.25,color: 0xD4A860, model: 'ikea/fado_table_lamp_white.glb' },
  { id: 'pendant_lamp',   name: 'Pendant Lamp',    cat: 'living', w: 0.4, h: 0.3, d: 0.4, color: 0xD4A860, model: 'kenney/lampSquareCeiling.glb' },
  { id: 'wall_lamp',      name: 'Wall Lamp',       cat: 'living', w: 0.2, h: 0.25,d: 0.15,color: 0xD4A860, model: 'kenney/lampWall.glb' },
  { id: 'ceiling_fan',    name: 'Ceiling Fan',     cat: 'living', w: 1.2, h: 0.3, d: 1.2, color: 0x888888, model: 'kenney/ceilingFan.glb' },
  { id: 'plant_pot',      name: 'Potted Plant',    cat: 'living', w: 0.4, h: 0.8, d: 0.4, color: 0x2D5A1E, model: 'ikea/klarbaer_plant_pot_with_saucer_indoor_ou.glb' },
  { id: 'plant_small',    name: 'Small Plant',     cat: 'living', w: 0.25,h: 0.3, d: 0.25,color: 0x2D5A1E, model: 'kenney/plantSmall1.glb' },
  { id: 'rug_round',      name: 'Round Rug',       cat: 'living', w: 2.0, h: 0.02,d: 2.0, color: 0xA07850, model: 'kenney/rugRound.glb' },
  { id: 'rug_rect',       name: 'Area Rug',        cat: 'living', w: 2.5, h: 0.02,d: 1.8, color: 0x8B5A2B, model: 'ikea/lohals_rug_flatwoven_natural.glb' },
  { id: 'rug_square',     name: 'Square Rug',      cat: 'living', w: 2.0, h: 0.02,d: 2.0, color: 0xA07850, model: 'ikea/aerende_rug_high_pile_gray.glb' },
  { id: 'rug_doormat',    name: 'Doormat',         cat: 'living', w: 0.8, h: 0.02,d: 0.5, color: 0x8B5A2B, model: 'ikea/vaegskylt_door_mat_blue_green_black.glb' },
  { id: 'pillow',         name: 'Pillow',          cat: 'living', w: 0.4, h: 0.15,d: 0.4, color: 0xE8DDD0, model: 'kenney/pillow.glb' },
  { id: 'radio',          name: 'Radio',           cat: 'living', w: 0.3, h: 0.2, d: 0.15,color: 0x8B7355, model: 'kenney/radio.glb' },
  { id: 'speaker',        name: 'Speaker',         cat: 'living', w: 0.25,h: 0.4, d: 0.25,color: 0x333333, model: 'kenney/speaker.glb' },
  { id: 'bear',           name: 'Teddy Bear',      cat: 'living', w: 0.3, h: 0.35,d: 0.25,color: 0xC19A6B, model: 'kenney/bear.glb' },

  // ── Kitchen ──
  { id: 'counter',        name: 'Counter',         cat: 'kitchen', w: 1.0, h: 0.9, d: 0.6, color: 0xA0A0A0, model: 'kenney/kitchenBar.glb' },
  { id: 'counter_end',    name: 'Counter End',     cat: 'kitchen', w: 0.6, h: 0.9, d: 0.6, color: 0xA0A0A0, model: 'kenney/kitchenBarEnd.glb' },
  { id: 'island',         name: 'Kitchen Cabinet', cat: 'kitchen', w: 1.0, h: 0.9, d: 0.6, color: 0x555555, model: 'kenney/kitchenCabinet.glb' },
  { id: 'cabinet_drawer', name: 'Cabinet Drawer',  cat: 'kitchen', w: 1.0, h: 0.9, d: 0.6, color: 0xF5F0E8, model: 'kenney/kitchenCabinetDrawer.glb' },
  { id: 'cabinet_upper',  name: 'Upper Cabinet',   cat: 'kitchen', w: 0.8, h: 0.6, d: 0.35,color: 0xF5F0E8, model: 'kenney/kitchenCabinetUpper.glb' },
  { id: 'cabinet_upper_d',name: 'Upper Cab Double',cat: 'kitchen', w: 1.0, h: 0.6, d: 0.35,color: 0xF5F0E8, model: 'kenney/kitchenCabinetUpperDouble.glb' },
  { id: 'fridge',         name: 'Fridge',          cat: 'kitchen', w: 0.7, h: 1.8, d: 0.7, color: 0xE0E0E0, model: 'kenney/kitchenFridge.glb' },
  { id: 'fridge_large',   name: 'Large Fridge',    cat: 'kitchen', w: 0.9, h: 2.0, d: 0.8, color: 0xE0E0E0, model: 'kenney/kitchenFridgeLarge.glb' },
  { id: 'fridge_small',   name: 'Mini Fridge',     cat: 'kitchen', w: 0.5, h: 0.8, d: 0.5, color: 0xE0E0E0, model: 'kenney/kitchenFridgeSmall.glb' },
  { id: 'oven',           name: 'Stove/Oven',      cat: 'kitchen', w: 0.6, h: 0.9, d: 0.6, color: 0xC0C0C0, model: 'kenney/kitchenStove.glb' },
  { id: 'stove',          name: 'Electric Stove',  cat: 'kitchen', w: 0.6, h: 0.9, d: 0.6, color: 0x333333, model: 'kenney/kitchenStoveElectric.glb' },
  { id: 'sink_kitchen',   name: 'Kitchen Sink',    cat: 'kitchen', w: 0.8, h: 0.9, d: 0.6, color: 0xC0C0C0, model: 'kenney/kitchenSink.glb' },
  { id: 'microwave',      name: 'Microwave',       cat: 'kitchen', w: 0.5, h: 0.3, d: 0.35,color: 0xB0B0B0, model: 'kenney/kitchenMicrowave.glb' },
  { id: 'hood_large',     name: 'Range Hood',      cat: 'kitchen', w: 0.8, h: 0.4, d: 0.5, color: 0xC0C0C0, model: 'kenney/hoodLarge.glb' },
  { id: 'hood_modern',    name: 'Modern Hood',     cat: 'kitchen', w: 0.6, h: 0.5, d: 0.4, color: 0xC0C0C0, model: 'kenney/hoodModern.glb' },
  { id: 'blender',        name: 'Blender',         cat: 'kitchen', w: 0.15,h: 0.4, d: 0.15,color: 0x888888, model: 'kenney/kitchenBlender.glb' },
  { id: 'coffee_machine', name: 'Coffee Machine',  cat: 'kitchen', w: 0.25,h: 0.35,d: 0.3, color: 0x333333, model: 'kenney/kitchenCoffeeMachine.glb' },
  { id: 'toaster',        name: 'Toaster',         cat: 'kitchen', w: 0.25,h: 0.18,d: 0.15,color: 0xC0C0C0, model: 'kenney/toaster.glb' },
  { id: 'dining_tbl',     name: 'Dining Table',    cat: 'kitchen', w: 1.4, h: 0.75,d: 0.8, color: 0xA0845C, model: 'ikea/skogsta_dining_table_acacia_black.glb' },
  { id: 'dining_tbl_cloth',name:'Table w/ Cloth',  cat: 'kitchen', w: 1.4, h: 0.75,d: 0.8, color: 0xF5F0E8, model: 'kenney/tableCloth.glb' },
  { id: 'round_table',    name: 'Round Table',     cat: 'kitchen', w: 1.0, h: 0.75,d: 1.0, color: 0xA0845C, model: 'ikea/docksta_table_white_white.glb' },
  { id: 'glass_table',    name: 'Glass Table',     cat: 'kitchen', w: 1.2, h: 0.75,d: 0.8, color: 0xBBDDFF, model: 'kenney/tableGlass.glb' },
  { id: 'chair',          name: 'Chair',           cat: 'kitchen', w: 0.5, h: 0.9, d: 0.5, color: 0x654321, model: 'ikea/nordviken_chair_black.glb' },
  { id: 'chair_cushion',  name: 'Cushion Chair',   cat: 'kitchen', w: 0.5, h: 0.9, d: 0.5, color: 0x654321, model: 'ikea/krylbo_chair_tonerud_dark_beige.glb' },
  { id: 'chair_modern',   name: 'Modern Chair',    cat: 'kitchen', w: 0.5, h: 0.85,d: 0.5, color: 0x888888, model: 'ikea/tobias_chair_brown_red_chrome_plated.glb' },
  { id: 'chair_rounded',  name: 'Rounded Chair',   cat: 'kitchen', w: 0.5, h: 0.8, d: 0.5, color: 0x654321, model: 'ikea/sandsberg_chair_white.glb' },
  { id: 'bar_stool',      name: 'Bar Stool',       cat: 'kitchen', w: 0.4, h: 0.75,d: 0.4, color: 0x333333, model: 'kenney/stoolBar.glb' },
  { id: 'bar_stool_sq',   name: 'Square Stool',    cat: 'kitchen', w: 0.4, h: 0.75,d: 0.4, color: 0x333333, model: 'kenney/stoolBarSquare.glb' },
  { id: 'trashcan',       name: 'Trash Can',       cat: 'kitchen', w: 0.3, h: 0.6, d: 0.3, color: 0x888888, model: 'ikea/droenjoens_wastepaper_basket_white.glb' },

  // ── Bathroom ──
  { id: 'toilet',         name: 'Toilet',          cat: 'bathroom', w: 0.4, h: 0.45,d: 0.65,color: 0xF0F0F0, model: 'kenney/toilet.glb' },
  { id: 'toilet_square',  name: 'Square Toilet',   cat: 'bathroom', w: 0.4, h: 0.45,d: 0.65,color: 0xF0F0F0, model: 'kenney/toiletSquare.glb' },
  { id: 'sink',           name: 'Sink',            cat: 'bathroom', w: 0.55,h: 0.85,d: 0.45,color: 0xF0F0F0, model: 'kenney/bathroomSink.glb' },
  { id: 'sink_square',    name: 'Square Sink',     cat: 'bathroom', w: 0.55,h: 0.85,d: 0.45,color: 0xF0F0F0, model: 'kenney/bathroomSinkSquare.glb' },
  { id: 'bathtub',        name: 'Bathtub',         cat: 'bathroom', w: 0.8, h: 0.5, d: 1.7, color: 0xF5F5F5, model: 'kenney/bathtub.glb' },
  { id: 'shower',         name: 'Shower',          cat: 'bathroom', w: 0.9, h: 2.1, d: 0.9, color: 0xDDEEFF, model: 'kenney/shower.glb' },
  { id: 'shower_round',   name: 'Round Shower',    cat: 'bathroom', w: 0.9, h: 2.1, d: 0.9, color: 0xDDEEFF, model: 'kenney/showerRound.glb' },
  { id: 'vanity_bath',    name: 'Bath Vanity',     cat: 'bathroom', w: 1.0, h: 0.85,d: 0.5, color: 0xF0F0F0, model: 'kenney/bathroomCabinet.glb' },
  { id: 'vanity_drawer',  name: 'Vanity Drawer',   cat: 'bathroom', w: 1.0, h: 0.85,d: 0.5, color: 0xF0F0F0, model: 'kenney/bathroomCabinetDrawer.glb' },
  { id: 'mirror_bath',    name: 'Bath Mirror',     cat: 'bathroom', w: 0.6, h: 0.6, d: 0.05,color: 0xC0D0E0, model: 'kenney/bathroomMirror.glb' },
  { id: 'laundry',        name: 'Washer',          cat: 'bathroom', w: 0.6, h: 0.85,d: 0.6, color: 0xE0E0E0, model: 'kenney/washer.glb' },
  { id: 'dryer',          name: 'Dryer',           cat: 'bathroom', w: 0.6, h: 0.85,d: 0.6, color: 0xD0D0D0, model: 'kenney/dryer.glb' },
  { id: 'washer_dryer',   name: 'Stacked W/D',     cat: 'bathroom', w: 0.6, h: 1.7, d: 0.6, color: 0xE0E0E0, model: 'kenney/washerDryerStacked.glb' },

  // ── Office ──
  { id: 'desk',           name: 'Desk',            cat: 'office', w: 1.4, h: 0.75,d: 0.7, color: 0x8B7355, model: 'ikea/lagkapten_alex_desk_white.glb' },
  { id: 'desk_corner',    name: 'Corner Desk',     cat: 'office', w: 1.6, h: 0.75,d: 1.6, color: 0x654321, model: 'kenney/deskCorner.glb' },
  { id: 'office_chair',   name: 'Office Chair',    cat: 'office', w: 0.6, h: 1.0, d: 0.6, color: 0x333333, model: 'ikea/millberget_swivel_chair_murum_black.glb' },
  { id: 'monitor',        name: 'Monitor',         cat: 'office', w: 0.55,h: 0.4, d: 0.2, color: 0x222222, model: 'kenney/computerScreen.glb' },
  { id: 'laptop',         name: 'Laptop',          cat: 'office', w: 0.35,h: 0.03,d: 0.25,color: 0x333333, model: 'kenney/laptop.glb' },
  { id: 'keyboard',       name: 'Keyboard',        cat: 'office', w: 0.4, h: 0.03,d: 0.15,color: 0x333333, model: 'kenney/computerKeyboard.glb' },
  { id: 'mouse',          name: 'Mouse',           cat: 'office', w: 0.06,h: 0.03,d: 0.1, color: 0x333333, model: 'kenney/computerMouse.glb' },

  // ── Outdoor / Courtyard ──
  { id: 'planter',        name: 'Potted Plant',    cat: 'outdoor', w: 0.4, h: 0.8, d: 0.4, color: 0x228B22, model: 'kenney/pottedPlant.glb' },
  { id: 'plant_sm1',      name: 'Small Plant 1',   cat: 'outdoor', w: 0.2, h: 0.25,d: 0.2, color: 0x228B22, model: 'kenney/plantSmall1.glb' },
  { id: 'plant_sm2',      name: 'Small Plant 2',   cat: 'outdoor', w: 0.2, h: 0.25,d: 0.2, color: 0x228B22, model: 'kenney/plantSmall2.glb' },
  { id: 'plant_sm3',      name: 'Small Plant 3',   cat: 'outdoor', w: 0.2, h: 0.3, d: 0.2, color: 0x228B22, model: 'kenney/plantSmall3.glb' },
  { id: 'bench',          name: 'Bench',           cat: 'outdoor', w: 1.5, h: 0.45,d: 0.5, color: 0x8B7355, model: 'kenney/bench.glb' },
  { id: 'bench_cushion',  name: 'Cushion Bench',   cat: 'outdoor', w: 1.5, h: 0.5, d: 0.5, color: 0x8B7355, model: 'kenney/benchCushion.glb' },
  { id: 'bench_low',      name: 'Low Bench',       cat: 'outdoor', w: 1.5, h: 0.35,d: 0.5, color: 0x8B7355, model: 'kenney/benchCushionLow.glb' },

  // ── Additional Bedroom (IKEA) ──
  { id: 'bed_upholstered',name: 'Upholstered Bed',  cat: 'bedroom', w: 1.6, h: 0.6, d: 2.1, color: 0xB0A090, model: 'ikea/gladstad_upholstered_bed_frame_kabusa_li.glb' },
  { id: 'bed_storage',    name: 'Storage Bed',      cat: 'bedroom', w: 1.6, h: 0.6, d: 2.1, color: 0xE0E0E0, model: 'ikea/brimnes_bed_frame_with_storage_headboard.glb' },
  { id: 'bed_pine',       name: 'Pine Bed',         cat: 'bedroom', w: 1.5, h: 0.6, d: 2.0, color: 0xC4A872, model: 'ikea/tarva_bed_frame_pine.glb' },
  { id: 'bed_metal',      name: 'Metal Bed',        cat: 'bedroom', w: 1.5, h: 0.6, d: 2.0, color: 0x555555, model: 'ikea/stjaernoe_bed_frame_anthracite.glb' },
  { id: 'bed_minimal',    name: 'Minimal Bed',      cat: 'bedroom', w: 1.5, h: 0.5, d: 2.0, color: 0xE0E0E0, model: 'ikea/vevelstad_bed_frame_white.glb' },
  { id: 'bed_mandal',     name: 'Platform Bed',     cat: 'bedroom', w: 1.6, h: 0.5, d: 2.1, color: 0xC4A872, model: 'ikea/mandal_bed_frame_with_storage_birch_whit.glb' },
  { id: 'mattress',       name: 'Mattress',         cat: 'bedroom', w: 1.6, h: 0.25,d: 2.0, color: 0xF0F0F0, model: 'ikea/vesteroey_pocket_spring_mattress_medium_.glb' },
  { id: 'wardrobe_slide', name: 'Sliding Wardrobe', cat: 'bedroom', w: 1.5, h: 2.0, d: 0.6, color: 0x888888, model: 'ikea/hauga_wardrobe_with_sliding_doors_gray.glb' },
  { id: 'wardrobe_open',  name: 'Open Wardrobe',    cat: 'bedroom', w: 1.2, h: 1.9, d: 0.6, color: 0xC4A872, model: 'ikea/nordkisa_open_wardrobe_with_sliding_door.glb' },
  { id: 'wardrobe_black', name: 'Black Wardrobe',   cat: 'bedroom', w: 1.2, h: 2.0, d: 0.6, color: 0x222222, model: 'ikea/brimnes_wardrobe_with_3_doors_black.glb' },
  { id: 'wardrobe_aurdal',name: 'System Wardrobe',  cat: 'bedroom', w: 1.8, h: 2.2, d: 0.6, color: 0xE0E0E0, model: 'ikea/aurdal_wardrobe_combination_white.glb' },
  { id: 'nightstand_wh',  name: 'White Nightstand', cat: 'bedroom', w: 0.45,h: 0.55,d: 0.4, color: 0xE0E0E0, model: 'ikea/brimnes_nightstand_white.glb' },
  { id: 'nightstand_pine',name: 'Pine Nightstand',  cat: 'bedroom', w: 0.48,h: 0.55,d: 0.36,color: 0xC4A872, model: 'ikea/tarva_nightstand_pine.glb' },
  { id: 'nightstand_gray',name: 'Gray Nightstand',  cat: 'bedroom', w: 0.45,h: 0.55,d: 0.4, color: 0x888888, model: 'ikea/brimnes_nightstand_gray.glb' },
  { id: 'dresser_gray',   name: 'Gray Dresser',     cat: 'bedroom', w: 1.0, h: 0.85,d: 0.5, color: 0x888888, model: 'ikea/hauga_2_drawer_chest_gray.glb' },

  // ── Additional Living (IKEA + Kenney) ──
  { id: 'sofa_sleeper',   name: 'Sleeper Sofa',     cat: 'living', w: 2.3, h: 0.85,d: 1.5, color: 0x555555, model: 'ikea/friheten_klagshamn_sleeper_sectional_3_s.glb' },
  { id: 'sofa_linen',     name: 'Linen Sofa',       cat: 'living', w: 2.2, h: 0.85,d: 0.9, color: 0xD4C8A8, model: 'ikea/hyltarp_sofa_gransel_natural.glb' },
  { id: 'sofa_chaise',    name: 'Chaise Sofa',      cat: 'living', w: 2.8, h: 0.85,d: 1.5, color: 0xC8B898, model: 'ikea/kivik_sofa_with_chaise_tibbleby_beige_gr.glb' },
  { id: 'sofa_stockholm', name: 'Stockholm Sofa',   cat: 'living', w: 2.4, h: 0.85,d: 0.9, color: 0xC8B898, model: 'ikea/stockholm_2025_3_seat_sofa_alhamn_beige.glb' },
  { id: 'loveseat_red',   name: 'Red Loveseat',     cat: 'living', w: 1.5, h: 0.75,d: 0.85,color: 0xCC3333, model: 'ikea/klippan_loveseat_langban_bright_red.glb' },
  { id: 'armchair_yellow',name: 'Yellow Armchair',   cat: 'living', w: 0.85,h: 1.0, d: 0.85,color: 0xE8C840, model: 'ikea/strandmon_wing_chair_skiftebo_yellow.glb' },
  { id: 'armchair_beige', name: 'Beige Armchair',    cat: 'living', w: 0.85,h: 1.0, d: 0.85,color: 0xD4C8A8, model: 'ikea/strandmon_wing_chair_kelinge_beige.glb' },
  { id: 'armchair_leather',name:'Leather Armchair',  cat: 'living', w: 0.7, h: 0.8, d: 0.75,color: 0x222222, model: 'ikea/ekeroe_armchair_bomstad_black.glb' },
  { id: 'armchair_brown', name: 'Brown Armchair',    cat: 'living', w: 0.75,h: 0.85,d: 0.8, color: 0x8B5B3A, model: 'ikea/vedbo_armchair_gunnared_light_brown_pink.glb' },
  { id: 'armchair_ottoman',name:'Armchair + Ottoman',cat: 'living', w: 0.85,h: 1.0, d: 1.2, color: 0x333355, model: 'ikea/strandmon_armchair_and_ottoman_djuparp_d.glb' },
  { id: 'tray_table',     name: 'Tray Table',       cat: 'living', w: 0.45,h: 0.53,d: 0.45,color: 0x555555, model: 'ikea/gladom_tray_table_dark_gray_green.glb' },
  { id: 'nesting_tables', name: 'Nesting Tables',   cat: 'living', w: 0.5, h: 0.55,d: 0.35,color: 0x654321, model: 'ikea/stockholm_nesting_tables_set_of_2_walnut.glb' },
  { id: 'side_tbl_gold',  name: 'Gold Side Table',  cat: 'living', w: 0.45,h: 0.55,d: 0.45,color: 0xD4A860, model: 'ikea/torsjoe_side_table_gold_effect_glass.glb' },
  { id: 'tv_unit_black',  name: 'TV Unit Black',    cat: 'living', w: 1.5, h: 0.4, d: 0.4, color: 0x222222, model: 'ikea/lack_tv_unit_black_brown.glb' },
  { id: 'tv_unit_rattan', name: 'Rattan TV Unit',   cat: 'living', w: 1.3, h: 0.5, d: 0.4, color: 0xC4A872, model: 'ikea/fryksas_tv_unit_rattan.glb' },
  { id: 'tv_wall_unit',   name: 'TV Wall Unit',     cat: 'living', w: 2.0, h: 1.6, d: 0.4, color: 0xE0E0E0, model: 'ikea/skruvby_tv_storage_combination_white.glb' },
  { id: 'tv_industrial',  name: 'Industrial TV',    cat: 'living', w: 1.5, h: 0.5, d: 0.4, color: 0x333333, model: 'ikea/fjaellbo_tv_unit_black.glb' },
  { id: 'bookcase_white', name: 'White Bookcase',   cat: 'living', w: 0.5, h: 1.8, d: 0.25,color: 0xF0F0F0, model: 'ikea/baggebo_bookcase_white.glb' },
  { id: 'shelf_metal',    name: 'Metal Shelf',      cat: 'living', w: 0.6, h: 1.0, d: 0.3, color: 0xE0E0E0, model: 'ikea/baggebo_shelf_unit_metal_white.glb' },
  { id: 'shelf_oak',      name: 'Oak Shelf Unit',   cat: 'living', w: 1.0, h: 1.5, d: 0.35,color: 0xC4A872, model: 'ikea/kallax_shelf_unit_white_stained_oak_effe.glb' },
  { id: 'shelf_open',     name: 'Open Shelf Blue',  cat: 'living', w: 0.36,h: 1.0, d: 0.36,color: 0x4477AA, model: 'ikea/ekenabben_open_shelf_unit_aspen_blue.glb' },
  { id: 'lamp_arched',    name: 'Arched Floor Lamp', cat:'living', w: 0.4, h: 1.8, d: 0.4, color: 0xD4A860, model: 'ikea/skottorp_skaftet_floor_lamp_arched_light.glb' },
  { id: 'lamp_reading',   name: 'Reading Lamp',     cat: 'living', w: 0.3, h: 1.5, d: 0.3, color: 0x222222, model: 'ikea/ranarp_floor_reading_lamp_black.glb' },
  { id: 'lamp_brass_tbl', name: 'Brass Table Lamp', cat: 'living', w: 0.25,h: 0.4, d: 0.25,color: 0xD4A860, model: 'ikea/arstid_table_lamp_nickel_plated_white.glb' },
  { id: 'lamp_chrome',    name: 'Chrome Table Lamp',cat: 'living', w: 0.2, h: 0.35,d: 0.2, color: 0xC0C0C0, model: 'ikea/simrishamn_table_lamp_chrome_plated_opal.glb' },
  { id: 'lamp_brass_flr', name: 'Brass Floor Lamp', cat: 'living', w: 0.3, h: 1.6, d: 0.3, color: 0xD4A860, model: 'ikea/arstid_floor_lamp_brass_white.glb' },
  { id: 'lamp_marble',    name: 'Marble Floor Lamp',cat: 'living', w: 0.35,h: 1.7, d: 0.35,color: 0x888888, model: 'ikea/evedal_floor_lamp_marble_gray.glb' },
  { id: 'rug_multicolor', name: 'Multicolor Rug',   cat: 'living', w: 2.4, h: 0.02,d: 1.7, color: 0xCC6644, model: 'ikea/onsevig_rug_low_pile_multicolor.glb' },
  { id: 'rug_natural',    name: 'Natural Rug',      cat: 'living', w: 2.4, h: 0.02,d: 1.7, color: 0xC4A872, model: 'ikea/starreklinte_rug_flatwoven_natural_black.glb' },
  { id: 'rug_handmade',   name: 'Handmade Rug',     cat: 'living', w: 2.0, h: 0.02,d: 1.4, color: 0xAA6644, model: 'ikea/halved_rug_flatwoven_handmade_multicolor.glb' },
  { id: 'rug_white',      name: 'White Pile Rug',   cat: 'living', w: 2.0, h: 0.03,d: 1.5, color: 0xF0E8D0, model: 'ikea/aerende_rug_high_pile_off_white.glb' },
  { id: 'picture_ledge',  name: 'Picture Ledge',    cat: 'living', w: 0.75,h: 0.1, d: 0.1, color: 0xC4A872, model: 'ikea/nordhaegg_picture_ledge_pine.glb' },
  { id: 'vase',           name: 'Vase',             cat: 'living', w: 0.15,h: 0.3, d: 0.15,color: 0xE0E0E0, model: 'ikea/pelarbjoerk_vase_white.glb' },
  { id: 'frame',          name: 'Picture Frame',    cat: 'living', w: 0.3, h: 0.4, d: 0.05,color: 0xC4A872, model: 'ikea/roedalm_frame_birch_effect.glb' },
  { id: 'lounge_sofa_k',  name: 'Design Sofa',      cat: 'living', w: 2.0, h: 0.8, d: 0.8, color: 0x6B4423, model: 'kenney/loungeDesignSofa.glb' },
  { id: 'lounge_corner_k',name: 'Corner Sofa',      cat: 'living', w: 2.2, h: 0.8, d: 2.2, color: 0x6B4423, model: 'kenney/loungeSofaCorner.glb' },
  { id: 'lounge_long_k',  name: 'Long Sofa',        cat: 'living', w: 2.8, h: 0.8, d: 0.8, color: 0x6B4423, model: 'kenney/loungeSofaLong.glb' },
  { id: 'lounge_chair_k', name: 'Lounge Chair',     cat: 'living', w: 0.8, h: 0.8, d: 0.8, color: 0x654321, model: 'kenney/loungeChair.glb' },
  { id: 'lounge_design_k',name: 'Design Chair',     cat: 'living', w: 0.7, h: 0.8, d: 0.7, color: 0x888888, model: 'kenney/loungeDesignChair.glb' },
  { id: 'speaker_sm',     name: 'Small Speaker',    cat: 'living', w: 0.15,h: 0.2, d: 0.15,color: 0x333333, model: 'kenney/speakerSmall.glb' },

  // ── Additional Kitchen (IKEA + Kenney) ──
  { id: 'countertop_oak', name: 'Oak Countertop',   cat: 'kitchen', w: 1.86,h: 0.04,d: 0.64,color: 0xC4A872, model: 'ikea/karlby_countertop_oak_veneer.glb' },
  { id: 'countertop_waln',name: 'Walnut Countertop',cat: 'kitchen', w: 1.86,h: 0.04,d: 0.64,color: 0x654321, model: 'ikea/karlby_countertop_walnut_veneer.glb' },
  { id: 'countertop_marb',name: 'Marble Countertop',cat: 'kitchen', w: 1.86,h: 0.04,d: 0.64,color: 0xE8E0D0, model: 'ikea/ekbacken_countertop_white_marble_effect_.glb' },
  { id: 'countertop_conc',name: 'Concrete Counter', cat: 'kitchen', w: 1.86,h: 0.04,d: 0.64,color: 0xA0A0A0, model: 'ikea/ekbacken_countertop_concrete_effect_lami.glb' },
  { id: 'drop_leaf_tbl',  name: 'Drop-leaf Table',  cat: 'kitchen', w: 0.9, h: 0.75,d: 0.6, color: 0xC4A872, model: 'ikea/ommjaenge_drop_leaf_table_pine_stained_b.glb' },
  { id: 'extend_tbl',     name: 'Extendable Table', cat: 'kitchen', w: 1.4, h: 0.75,d: 0.85,color: 0xE0E0E0, model: 'ikea/vihals_extendable_table_white.glb' },
  { id: 'wood_table',     name: 'Wood Table',       cat: 'kitchen', w: 1.4, h: 0.75,d: 0.85,color: 0x333333, model: 'ikea/lisabo_table_black_ash_veneer.glb' },
  { id: 'gate_table',     name: 'Gateleg Table',    cat: 'kitchen', w: 0.9, h: 0.75,d: 0.8, color: 0xE0E0E0, model: 'ikea/norden_gateleg_table_white.glb' },
  { id: 'chair_wood',     name: 'Wood Chair',       cat: 'kitchen', w: 0.45,h: 0.9, d: 0.5, color: 0xC4A872, model: 'ikea/pinntorp_chair_light_brown_stained.glb' },
  { id: 'chair_birch',    name: 'Birch Chair',      cat: 'kitchen', w: 0.45,h: 0.85,d: 0.5, color: 0xC4A872, model: 'ikea/hoegved_chair_birch_veneer.glb' },
  { id: 'chair_blue',     name: 'Blue Chair',       cat: 'kitchen', w: 0.45,h: 0.85,d: 0.45,color: 0x4466AA, model: 'ikea/sandsberg_chair_blue.glb' },
  { id: 'chair_stacking', name: 'Stacking Chair',   cat: 'kitchen', w: 0.5, h: 0.8, d: 0.5, color: 0xE0E0E0, model: 'ikea/groensta_chair_indoor_outdoor_white.glb' },
  { id: 'cabinet_corner', name: 'Corner Cabinet',   cat: 'kitchen', w: 0.6, h: 0.9, d: 0.6, color: 0xF5F0E8, model: 'kenney/kitchenCabinetCornerRound.glb' },
  { id: 'cabinet_upper_c',name: 'Upper Corner Cab', cat: 'kitchen', w: 0.6, h: 0.6, d: 0.35,color: 0xF5F0E8, model: 'kenney/kitchenCabinetUpperCorner.glb' },
  { id: 'fridge_builtin', name: 'Built-in Fridge',  cat: 'kitchen', w: 0.6, h: 1.8, d: 0.6, color: 0xE0E0E0, model: 'kenney/kitchenFridgeBuiltIn.glb' },

  // ── Additional Bathroom (IKEA) ──
  { id: 'faucet_brass',   name: 'Brass Faucet',     cat: 'bathroom', w: 0.15,h: 0.25,d: 0.2, color: 0xD4A860, model: 'ikea/macksjoen_centerset_sink_faucet_brass_co.glb' },
  { id: 'faucet_black',   name: 'Black Faucet',     cat: 'bathroom', w: 0.2, h: 0.3, d: 0.2, color: 0x222222, model: 'ikea/macksjoen_widespread_sink_faucet_black.glb' },
  { id: 'faucet_chrome',  name: 'Chrome Faucet',    cat: 'bathroom', w: 0.15,h: 0.25,d: 0.2, color: 0xC0C0C0, model: 'ikea/macksjoen_centerset_sink_faucet_chrome_p.glb' },

  // ── Additional Office (IKEA + Kenney) ──
  { id: 'gaming_desk',    name: 'Gaming Desk',      cat: 'office', w: 1.4, h: 0.75,d: 0.7, color: 0x555555, model: 'ikea/utespelare_gaming_desk_ash_effect_gray.glb' },
  { id: 'desk_walnut',    name: 'Walnut Desk',      cat: 'office', w: 1.4, h: 0.75,d: 0.7, color: 0x654321, model: 'ikea/mittzon_desk_walnut_veneer_black.glb' },
  { id: 'desk_micke',     name: 'Compact Desk',     cat: 'office', w: 1.0, h: 0.75,d: 0.5, color: 0xE0E0E0, model: 'ikea/micke_desk_white_anthracite.glb' },
  { id: 'gaming_chair',   name: 'Gaming Chair',     cat: 'office', w: 0.6, h: 1.1, d: 0.6, color: 0x4477CC, model: 'ikea/styrspel_gaming_chair_blue_light_gray.glb' },
  { id: 'conf_chair',     name: 'Conference Chair', cat: 'office', w: 0.6, h: 1.0, d: 0.6, color: 0x555555, model: 'ikea/langfjaell_conference_chair_gunnared_dar.glb' },
  { id: 'desk_lamp',      name: 'Desk Lamp',        cat: 'office', w: 0.2, h: 0.4, d: 0.2, color: 0x222222, model: 'ikea/skurup_work_lamp_black.glb' },
  { id: 'drawer_unit',    name: 'Drawer Unit',      cat: 'office', w: 0.36,h: 0.7, d: 0.58,color: 0x444444, model: 'ikea/alex_drawer_unit_black_brown.glb' },
  { id: 'cable_mgmt',     name: 'Cable Tray',       cat: 'office', w: 0.9, h: 0.1, d: 0.15,color: 0xE0E0E0, model: 'ikea/foersaesong_cable_management_tray_white.glb' },

  // ── Additional Outdoor (Kenney + IKEA) ──
  { id: 'chair_outdoor',  name: 'Outdoor Chair',    cat: 'outdoor', w: 0.5, h: 0.8, d: 0.5, color: 0xE0E0E0, model: 'ikea/groensta_chair_indoor_outdoor_white.glb' },
  { id: 'plant_pot_gray', name: 'Gray Plant Pot',   cat: 'outdoor', w: 0.35,h: 0.4, d: 0.35,color: 0xA0A0A0, model: 'ikea/koersbaersbjoerk_plant_pot_light_grey_be.glb' },

  // ── Remaining IKEA Beds ──
  { id: 'bed_neiden',     name: 'Pine Frame Bed',   cat: 'bedroom', w: 1.5, h: 0.5, d: 2.0, color: 0xC4A872, model: 'ikea/neiden_bed_frame_pine.glb' },
  { id: 'bed_slattum',    name: 'Upholstered Dark', cat: 'bedroom', w: 1.5, h: 0.6, d: 2.0, color: 0x444444, model: 'ikea/slattum_upholstered_bed_frame_vissle_dar.glb' },
  { id: 'bed_vihals',     name: 'White Frame Bed',  cat: 'bedroom', w: 1.5, h: 0.6, d: 2.0, color: 0xE0E0E0, model: 'ikea/vihals_bed_frame_white.glb' },
  { id: 'bed_songesand',  name: 'Brown Bed',        cat: 'bedroom', w: 1.6, h: 0.6, d: 2.1, color: 0x8B6914, model: 'ikea/songesand_bed_frame_brown_luroey.glb' },
  { id: 'bed_kleppstad',  name: 'Kleppstad Bed',    cat: 'bedroom', w: 1.5, h: 0.6, d: 2.0, color: 0xE0E0E0, model: 'ikea/kleppstad_bed_frame_white_vissle_beige.glb' },
  { id: 'bed_tonstad',    name: 'Storage Bed Brown', cat:'bedroom', w: 1.6, h: 0.6, d: 2.1, color: 0x8B6914, model: 'ikea/tonstad_bed_frame_with_storage_brown_sta.glb' },

  // ── Remaining IKEA Wardrobes ──
  { id: 'wardrobe_dark',  name: 'Dark Gray Wardrobe',cat:'bedroom', w: 1.8, h: 2.2, d: 0.6, color: 0x444444, model: 'ikea/aurdal_wardrobe_combination_dark_gray.glb' },
  { id: 'wardrobe_gray',  name: 'Gray Wardrobe',    cat: 'bedroom', w: 1.0, h: 2.0, d: 0.5, color: 0x888888, model: 'ikea/gullaberg_wardrobe_gray.glb' },
  { id: 'wardrobe_brown', name: 'Brown Wardrobe',   cat: 'bedroom', w: 1.2, h: 2.0, d: 0.6, color: 0x654321, model: 'ikea/idanaes_wardrobe_dark_brown_stained.glb' },
  { id: 'wardrobe_rakk',  name: '2-Door Wardrobe',  cat: 'bedroom', w: 0.8, h: 2.0, d: 0.6, color: 0x333333, model: 'ikea/rakkestad_wardrobe_with_2_doors_black_br.glb' },
  { id: 'wardrobe_white2',name: 'White Wardrobe L',  cat:'bedroom', w: 1.2, h: 2.0, d: 0.6, color: 0xE0E0E0, model: 'ikea/idanaes_wardrobe_white.glb' },

  // ── Remaining IKEA Nightstands ──
  { id: 'ns_storklinta',  name: 'Storklinta White', cat: 'bedroom', w: 0.45,h: 0.55,d: 0.4, color: 0xE0E0E0, model: 'ikea/storklinta_nightstand_white_with_1_drawe.glb' },
  { id: 'ns_songesand',   name: 'Brown Nightstand', cat: 'bedroom', w: 0.45,h: 0.55,d: 0.4, color: 0x8B6914, model: 'ikea/songesand_nightstand_brown.glb' },
  { id: 'ns_storklinta_d',name: 'Oak Nightstand',   cat: 'bedroom', w: 0.45,h: 0.55,d: 0.4, color: 0x654321, model: 'ikea/storklinta_nightstand_dark_brown_oak_eff.glb' },
  { id: 'ns_tonstad_wh',  name: 'Off-white NS',     cat: 'bedroom', w: 0.45,h: 0.55,d: 0.4, color: 0xF0EDE0, model: 'ikea/tonstad_nightstand_off_white.glb' },
  { id: 'ns_graf_wh',     name: 'Modern NS White',  cat: 'bedroom', w: 0.4, h: 0.5, d: 0.35,color: 0xE0E0E0, model: 'ikea/grafjaellet_nightstand_white.glb' },
  { id: 'ns_graf_dk',     name: 'Modern NS Dark',   cat: 'bedroom', w: 0.4, h: 0.5, d: 0.35,color: 0x555555, model: 'ikea/grafjaellet_nightstand_anthracite.glb' },
  { id: 'ns_wallmount_a', name: 'Wall Mount NS A',  cat: 'bedroom', w: 0.35,h: 0.15,d: 0.3, color: 0x555555, model: 'ikea/grafjaellet_wall_mounted_bedside_table_a.glb' },
  { id: 'ns_wallmount_w', name: 'Wall Mount NS W',  cat: 'bedroom', w: 0.35,h: 0.15,d: 0.3, color: 0xE0E0E0, model: 'ikea/grafjaellet_wall_mounted_bedside_table_w.glb' },
  { id: 'ns_gullaberg',   name: 'Vintage NS',       cat: 'bedroom', w: 0.45,h: 0.55,d: 0.4, color: 0x888888, model: 'ikea/gullaberg_nightstand_with_1_drawer_with_.glb' },
  { id: 'ns_tonstad_oak', name: 'Oak Veneer NS',    cat: 'bedroom', w: 0.45,h: 0.55,d: 0.4, color: 0xC4A872, model: 'ikea/tonstad_nightstand_oak_veneer.glb' },
  { id: 'ns_storklinta_g',name: 'Green Nightstand',  cat:'bedroom', w: 0.45,h: 0.55,d: 0.4, color: 0x668866, model: 'ikea/storklinta_nightstand_gray_green_with_2_.glb' },
  { id: 'ns_storemolla',  name: 'Rustic Nightstand', cat:'bedroom', w: 0.45,h: 0.55,d: 0.4, color: 0x8B7355, model: 'ikea/storemolla_nightstand_gray_brown_stained.glb' },

  // ── Remaining IKEA Sofas ──
  { id: 'sofa_beige_ch',  name: 'Beige Chaise Sofa',cat: 'living', w: 2.8, h: 0.85,d: 1.5, color: 0xD4C8A8, model: 'ikea/finnala_sofa_with_chaise_gunnared_beige.glb' },
  { id: 'sofa_gray_ch',   name: 'Gray Chaise Sofa', cat: 'living', w: 2.8, h: 0.85,d: 1.5, color: 0x888888, model: 'ikea/finnala_sofa_with_chaise_gunnared_medium.glb' },
  { id: 'sofa_blue',      name: 'Blue Sofa',        cat: 'living', w: 2.2, h: 0.85,d: 0.9, color: 0x334466, model: 'ikea/uppland_sofa_kilanda_dark_blue.glb' },
  { id: 'sofa_metal_leg', name: 'Metal Leg Sofa',   cat: 'living', w: 2.2, h: 0.85,d: 0.9, color: 0x555555, model: 'ikea/morabo_sofa_gunnared_dark_gray_metal.glb' },

  // ── Remaining IKEA Armchairs ──
  { id: 'arm_bingsta',    name: 'Gray Armchair',    cat: 'living', w: 0.7, h: 0.8, d: 0.75,color: 0x555555, model: 'ikea/bingsta_armchair_vissle_dark_gray_kabusa.glb' },
  { id: 'arm_morabo',     name: 'Morabo Armchair',  cat: 'living', w: 0.8, h: 0.8, d: 0.85,color: 0x555555, model: 'ikea/morabo_armchair_gunnared_dark_gray_wood.glb' },
  { id: 'arm_rock_beige', name: 'Beige Rocker',     cat: 'living', w: 0.75,h: 0.8, d: 0.8, color: 0xD4C8A8, model: 'ikea/rocksjoen_armchair_kilanda_light_beige.glb' },
  { id: 'arm_rock_white', name: 'White Rocker',     cat: 'living', w: 0.75,h: 0.8, d: 0.8, color: 0xE0E0E0, model: 'ikea/rocksjoen_armchair_blekinge_white.glb' },
  { id: 'arm_red',        name: 'Red Armchair',     cat: 'living', w: 0.8, h: 0.85,d: 0.85,color: 0x993333, model: 'ikea/saltsjoebaden_armchair_tonerud_red_brown.glb' },
  { id: 'arm_blue',       name: 'Blue Armchair',    cat: 'living', w: 0.8, h: 0.85,d: 0.85,color: 0x334466, model: 'ikea/uppland_armchair_kilanda_dark_blue.glb' },
  { id: 'swivel_black',   name: 'Black Swivel',     cat: 'living', w: 0.7, h: 0.8, d: 0.7, color: 0x222222, model: 'ikea/dyvlinge_swivel_chair_kelinge_black.glb' },
  { id: 'swivel_orange',  name: 'Orange Swivel',    cat: 'living', w: 0.7, h: 0.8, d: 0.7, color: 0xCC6633, model: 'ikea/dyvlinge_swivel_chair_kelinge_orange.glb' },

  // ── Remaining IKEA Tables ──
  { id: 'lack_nest',      name: 'Nesting Tables',   cat: 'living', w: 0.5, h: 0.55,d: 0.35,color: 0xE0E0E0, model: 'ikea/lack_nesting_tables_set_of_2_white.glb' },
  { id: 'lack_coffee_wh', name: 'White Coffee Tbl', cat: 'living', w: 1.18,h: 0.45,d: 0.78,color: 0xE0E0E0, model: 'ikea/lack_coffee_table_white.glb' },
  { id: 'lack_coffee_oak',name: 'Oak Coffee Table', cat: 'living', w: 1.18,h: 0.45,d: 0.78,color: 0xC4A872, model: 'ikea/lack_coffee_table_white_stained_oak_effe.glb' },
  { id: 'side_aemmaryd',  name: 'Gray Side Table',  cat: 'living', w: 0.45,h: 0.55,d: 0.45,color: 0x888888, model: 'ikea/aemmaryd_side_table_gray.glb' },
  { id: 'side_holmerud',  name: 'Oak Side Table',   cat: 'living', w: 0.45,h: 0.55,d: 0.45,color: 0xC4A872, model: 'ikea/holmerud_side_table_oak_effect.glb' },
  { id: 'side_baggboda',  name: 'White Side Table', cat: 'living', w: 0.45,h: 0.55,d: 0.45,color: 0xE0E0E0, model: 'ikea/baggboda_side_table_white.glb' },
  { id: 'side_tanebro_y', name: 'Yellow Side Tbl',  cat: 'outdoor',w: 0.45,h: 0.5, d: 0.45,color: 0xE8D080, model: 'ikea/tanebro_side_table_indoor_outdoor_pale_y.glb' },
  { id: 'side_tanebro_dk',name: 'Anthracite Side',  cat: 'outdoor',w: 0.45,h: 0.5, d: 0.45,color: 0x555555, model: 'ikea/tanebro_side_table_indoor_outdoor_anthra.glb' },
  { id: 'side_tanebro_g', name: 'Green Side Tbl',   cat: 'outdoor',w: 0.45,h: 0.5, d: 0.45,color: 0x556655, model: 'ikea/tanebro_side_table_indoor_outdoor_dark_g.glb' },
  { id: 'laptop_stand_wh',name: 'Laptop Stand',     cat: 'office', w: 0.6, h: 0.65,d: 0.36,color: 0xE0E0E0, model: 'ikea/vittsjoe_laptop_stand_white_glass.glb' },
  { id: 'laptop_stand_bk',name: 'Laptop Stand Dark',cat: 'office', w: 0.6, h: 0.65,d: 0.36,color: 0x333333, model: 'ikea/vittsjoe_laptop_stand_black_brown_glass.glb' },

  // ── Remaining IKEA TV Units ──
  { id: 'tv_lack_white',  name: 'Lack TV White',    cat: 'living', w: 1.5, h: 0.36,d: 0.36,color: 0xE0E0E0, model: 'ikea/lack_tv_unit_white.glb' },
  { id: 'tv_kallax_bk',   name: 'Kallax TV Black',  cat: 'living', w: 1.5, h: 0.6, d: 0.4, color: 0x333333, model: 'ikea/kallax_tv_unit_black_brown.glb' },
  { id: 'tv_kallax_wh',   name: 'Kallax TV White',  cat: 'living', w: 1.5, h: 0.6, d: 0.4, color: 0xE0E0E0, model: 'ikea/kallax_tv_unit_white.glb' },
  { id: 'tv_besta_white', name: 'Besta TV White',   cat: 'living', w: 1.8, h: 0.4, d: 0.4, color: 0xE0E0E0, model: 'ikea/besta_tv_unit_white.glb' },
  { id: 'tv_radmansoe',   name: 'Walnut TV Unit',   cat: 'living', w: 1.6, h: 0.5, d: 0.4, color: 0x654321, model: 'ikea/radmansoe_tv_unit_brown_walnut_effect.glb' },

  // ── Remaining IKEA Shelves/Bookcases ──
  { id: 'kallax_4ins_bk', name: 'Kallax 4-Insert B',cat: 'living', w: 0.77,h: 0.77,d: 0.39,color: 0x333333, model: 'ikea/kallax_shelf_unit_with_4_inserts_black_b.glb' },
  { id: 'kallax_4ins_wh', name: 'Kallax 4-Insert W',cat: 'living', w: 0.77,h: 0.77,d: 0.39,color: 0xE0E0E0, model: 'ikea/kallax_shelf_unit_with_4_inserts_white_s.glb' },
  { id: 'shelf_open_wh',  name: 'Open Shelf White', cat: 'living', w: 0.36,h: 1.0, d: 0.36,color: 0xE0E0E0, model: 'ikea/ekenabben_open_shelf_unit_aspen_white.glb' },
  { id: 'wall_shelf',     name: 'Wall Shelf',       cat: 'living', w: 0.6, h: 0.2, d: 0.28,color: 0xE0E0E0, model: 'ikea/lack_wall_shelf_unit_white.glb' },
  { id: 'billy_doors_bk', name: 'Billy w/ Doors',   cat: 'living', w: 0.8, h: 2.0, d: 0.3, color: 0x222222, model: 'ikea/billy_bookcase_with_doors_black_oak_effe.glb' },
  { id: 'billy_oxberg_ok',name: 'Billy Oxberg Oak', cat: 'living', w: 0.8, h: 2.0, d: 0.3, color: 0xC4A872, model: 'ikea/billy_oxberg_bookcase_with_doors_oak_eff.glb' },
  { id: 'billy_walnut',   name: 'Billy Walnut',     cat: 'living', w: 0.8, h: 2.0, d: 0.3, color: 0x654321, model: 'ikea/billy_bookcase_brown_walnut_effect.glb' },

  // ── Remaining IKEA Floor Lamps ──
  { id: 'lamp_isjakt',    name: 'LED Uplighter',    cat: 'living', w: 0.3, h: 1.8, d: 0.3, color: 0xE0E0E0, model: 'ikea/isjakt_led_floor_uplighter_reading_lamp_.glb' },
  { id: 'lamp_brown_ash', name: 'Brown Ash Lamp',   cat: 'living', w: 0.35,h: 1.5, d: 0.35,color: 0x8B6914, model: 'ikea/lauters_floor_lamp_brown_ash_white.glb' },
  { id: 'lamp_3spot',     name: '3-Spot Floor Lamp', cat:'living', w: 0.3, h: 1.6, d: 0.3, color: 0xE0E0E0, model: 'ikea/nymane_floor_lamp_with_3_spotlights_whit.glb' },
  { id: 'lamp_beech',     name: 'Beech Floor Lamp', cat: 'living', w: 0.3, h: 1.5, d: 0.3, color: 0xC4A872, model: 'ikea/oekensand_floor_lamp_beech_white.glb' },
  { id: 'lamp_tagarp',    name: 'Uplighter B/W',    cat: 'living', w: 0.25,h: 1.7, d: 0.25,color: 0x222222, model: 'ikea/tagarp_floor_uplighter_black_white.glb' },
  { id: 'lamp_vidja',     name: 'Cylinder Lamp',    cat: 'living', w: 0.14,h: 1.38,d: 0.14,color: 0xE0E0E0, model: 'ikea/vidja_floor_lamp_white.glb' },
  { id: 'lamp_tagarp_rd', name: 'Reading Uplighter',cat: 'living', w: 0.25,h: 1.8, d: 0.25,color: 0x222222, model: 'ikea/tagarp_floor_uplighter_reading_lamp_blac.glb' },
  { id: 'lamp_stockholm', name: 'Stockholm Lamp',   cat: 'living', w: 0.4, h: 1.5, d: 0.4, color: 0xE0E0E0, model: 'ikea/stockholm_2025_floor_lamp_white_textile_.glb' },
  { id: 'lamp_barlast',   name: 'Barlast Lamp',     cat: 'living', w: 0.25,h: 1.5, d: 0.25,color: 0x222222, model: 'ikea/barlast_floor_lamp_black_white.glb' },

  // ── Remaining IKEA Table Lamps ──
  { id: 'tlamp_tokabo',   name: 'Opal Table Lamp',  cat: 'living', w: 0.2, h: 0.28,d: 0.2, color: 0xE8E0D0, model: 'ikea/tokabo_table_lamp_glass_opal.glb' },
  { id: 'tlamp_kuddlava', name: 'Pleated Lamp',     cat: 'living', w: 0.2, h: 0.35,d: 0.2, color: 0xE0E0E0, model: 'ikea/kuddlava_table_lamp_pleated_white.glb' },
  { id: 'tlamp_taernaby',  name: 'Dimmable Lamp',   cat: 'living', w: 0.2, h: 0.35,d: 0.2, color: 0x555555, model: 'ikea/taernaby_table_lamp_dimmable_anthracite.glb' },
  { id: 'tlamp_portable', name: 'Portable LED',     cat: 'living', w: 0.13,h: 0.26,d: 0.13,color: 0xE0E0E0, model: 'ikea/noedmast_led_portable_lamp_battery_opera.glb' },
  { id: 'tlamp_yellow',   name: 'Yellow Lamp',      cat: 'living', w: 0.2, h: 0.32,d: 0.2, color: 0xE8C840, model: 'ikea/blasverk_table_lamp_yellow.glb' },
  { id: 'tlamp_beige',    name: 'Beige Table Lamp', cat: 'living', w: 0.2, h: 0.32,d: 0.2, color: 0xD4C8A8, model: 'ikea/blasverk_table_lamp_beige.glb' },
  { id: 'tlamp_ceramic',  name: 'Ceramic Lamp',     cat: 'living', w: 0.2, h: 0.35,d: 0.2, color: 0xF0EDE0, model: 'ikea/blidvaeder_table_lamp_off_white_ceramic_.glb' },
  { id: 'tlamp_frosted',  name: 'Frosted Glass Lamp',cat:'living', w: 0.18,h: 0.3, d: 0.18,color: 0xE0E0E0, model: 'ikea/groenoe_table_lamp_frosted_glass_white.glb' },
  { id: 'tlamp_beige2',   name: 'Warm Table Lamp',  cat: 'living', w: 0.2, h: 0.35,d: 0.2, color: 0xD4C8A8, model: 'ikea/taernaby_table_lamp_dimmable_beige.glb' },
  { id: 'tlamp_dk_yellow',name: 'Dark Yellow Lamp', cat: 'living', w: 0.2, h: 0.35,d: 0.2, color: 0xBB9933, model: 'ikea/taernaby_table_lamp_dimmable_dark_yellow.glb' },

  // ── Remaining IKEA Rugs ──
  { id: 'rug_black_nat',  name: 'Black Natural Rug',cat: 'living', w: 2.0, h: 0.02,d: 1.4, color: 0x333333, model: 'ikea/tiphede_rug_flatwoven_black_natural.glb' },
  { id: 'rug_elsystem',   name: 'Multicolor Low',   cat: 'living', w: 2.4, h: 0.02,d: 1.7, color: 0xCC8844, model: 'ikea/elsystem_rug_low_pile_multicolor.glb' },
  { id: 'rug_highpile',   name: 'White Beige Pile',  cat:'living', w: 2.0, h: 0.03,d: 1.5, color: 0xF0E8D0, model: 'ikea/tagspar_rug_high_pile_white_beige.glb' },
  { id: 'rug_nat_black',  name: 'Natural Black Rug',cat: 'living', w: 2.0, h: 0.02,d: 1.4, color: 0xC4A872, model: 'ikea/tiphede_rug_flatwoven_natural_black.glb' },
  { id: 'rug_green',      name: 'Green Flat Rug',   cat: 'living', w: 2.0, h: 0.02,d: 1.4, color: 0x558855, model: 'ikea/ridstig_rug_flatwoven_off_white_green.glb' },
  { id: 'rug_pink',       name: 'Pink Orange Rug',  cat: 'living', w: 0.8, h: 0.02,d: 0.5, color: 0xCC6688, model: 'ikea/vaegskylt_rug_flatwoven_pink_orange.glb' },
  { id: 'rug_beige',      name: 'Beige Flat Rug',   cat: 'living', w: 2.0, h: 0.02,d: 1.4, color: 0xD4C8A8, model: 'ikea/tidtabell_rug_flatwoven_beige.glb' },

  // ── Remaining IKEA Dining Tables ──
  { id: 'tbl_rosentorp',  name: 'Extendable White', cat: 'kitchen', w: 1.4, h: 0.75,d: 0.85,color: 0xE0E0E0, model: 'ikea/rosentorp_extendable_table_white.glb' },
  { id: 'tbl_vihals',     name: 'White Table',      cat: 'kitchen', w: 1.4, h: 0.75,d: 0.85,color: 0xE0E0E0, model: 'ikea/vihals_table_white_white.glb' },
  { id: 'tbl_skogsta',    name: 'Acacia Table',     cat: 'kitchen', w: 2.35,h: 0.74,d: 1.0, color: 0xC4A872, model: 'ikea/skogsta_table_acacia.glb' },
  { id: 'tbl_skansnaes',  name: 'Beech Extendable', cat: 'kitchen', w: 1.5, h: 0.75,d: 0.9, color: 0xC4A872, model: 'ikea/skansnaes_extendable_table_brown_beech_v.glb' },
  { id: 'tbl_bergshyttan', name:'Dark Ash Table',   cat: 'kitchen', w: 1.3, h: 0.75,d: 0.8, color: 0x444444, model: 'ikea/bergshyttan_table_dark_brown_ash_veneer.glb' },
  { id: 'tbl_moerbylanga', name:'Oak Dining Table',  cat:'kitchen', w: 2.2, h: 0.74,d: 1.0, color: 0x8B6914, model: 'ikea/moerbylanga_table_oak_veneer_brown_stain.glb' },

  // ── Remaining IKEA Chairs ──
  { id: 'chair_gray_turq',name: 'Turquoise Chair',  cat: 'kitchen', w: 0.5, h: 0.8, d: 0.5, color: 0x559999, model: 'ikea/groensta_chair_indoor_outdoor_gray_turqu.glb' },
  { id: 'chair_skansnaes',name: 'Beech Chair',      cat: 'kitchen', w: 0.45,h: 0.85,d: 0.5, color: 0x222222, model: 'ikea/skansnaes_chair_black_beech.glb' },
  { id: 'chair_rosentorp',name: 'White Chair',      cat: 'kitchen', w: 0.5, h: 0.85,d: 0.5, color: 0xE0E0E0, model: 'ikea/rosentorp_chair_white.glb' },

  // ── Remaining IKEA Office ──
  { id: 'desk_alex_bb',   name: 'Alex Desk Brown',  cat: 'office', w: 1.32,h: 0.76,d: 0.58,color: 0x444444, model: 'ikea/alex_desk_black_brown.glb' },
  { id: 'desk_alex_blue', name: 'Alex Desk Blue',   cat: 'office', w: 1.32,h: 0.76,d: 0.58,color: 0x334466, model: 'ikea/alex_desk_black_blue.glb' },
  { id: 'desk_lagk_bb_w', name: 'Desk Brown/White', cat: 'office', w: 1.4, h: 0.75,d: 0.6, color: 0x654321, model: 'ikea/lagkapten_alex_desk_black_brown_white.glb' },
  { id: 'desk_lagk_bb_b', name: 'Desk Brown/Black', cat: 'office', w: 1.4, h: 0.75,d: 0.6, color: 0x333333, model: 'ikea/lagkapten_alex_desk_black_brown_black.glb' },
  { id: 'desk_lagk_bb',   name: 'Lagkapten Brown',  cat: 'office', w: 1.4, h: 0.75,d: 0.6, color: 0x654321, model: 'ikea/lagkapten_alex_desk_black_brown.glb' },
  { id: 'desk_tonstad',   name: 'Oak Desk',         cat: 'office', w: 1.4, h: 0.75,d: 0.65,color: 0xC4A872, model: 'ikea/tonstad_desk_oak_veneer.glb' },
  { id: 'tabletop_gray',  name: 'Gray Tabletop',    cat: 'office', w: 1.4, h: 0.04,d: 0.6, color: 0x555555, model: 'ikea/lagkapten_tabletop_dark_gray_wood_effect.glb' },
  { id: 'ochair_white',   name: 'White Swivel',     cat: 'office', w: 0.55,h: 0.9, d: 0.55,color: 0xE0E0E0, model: 'ikea/loberget_malskaer_swivel_chair_white.glb' },
  { id: 'ochair_padded',  name: 'Padded Swivel',    cat: 'office', w: 0.55,h: 0.9, d: 0.55,color: 0xE0E0E0, model: 'ikea/loberget_malskaer_swivel_chair_pad_white.glb' },
  { id: 'kids_chair',     name: 'Kids Desk Chair',  cat: 'office', w: 0.5, h: 0.8, d: 0.5, color: 0xE0E0E0, model: 'ikea/loberget_sibben_childs_desk_chair_white.glb' },
  { id: 'sit_stand',      name: 'Sit/Stand Stool',  cat: 'office', w: 0.4, h: 0.65,d: 0.4, color: 0x555555, model: 'ikea/lidkullen_sit_stand_support_gunnared_dar.glb' },
  { id: 'ochair_dark',    name: 'Dark Swivel',      cat: 'office', w: 0.6, h: 0.95,d: 0.6, color: 0x444444, model: 'ikea/eldberget_malskaer_swivel_chair_dark_gra.glb' },
  { id: 'swivel_rosentorp',name:'Swivel Chair',     cat: 'office', w: 0.55,h: 0.85,d: 0.55,color: 0xD4C8A8, model: 'ikea/rosentorp_swivel_chair_white_kilanda_lig.glb' },
  { id: 'cable_box',      name: 'Cable Box',        cat: 'office', w: 0.4, h: 0.13,d: 0.25,color: 0xC4A872, model: 'ikea/hoensnaet_cable_management_box_natural.glb' },

  // ── Remaining IKEA Countertops ──
  { id: 'ct_moellekulla', name: 'Moellekulla Oak',  cat: 'kitchen', w: 1.86,h: 0.04,d: 0.64,color: 0xC4A872, model: 'ikea/moellekulla_countertop_oak_veneer.glb' },
  { id: 'ct_saeljan_oak', name: 'Laminate Oak',     cat: 'kitchen', w: 1.86,h: 0.04,d: 0.64,color: 0xC4A872, model: 'ikea/saeljan_countertop_oak_effect_laminate.glb' },
  { id: 'ct_island_waln', name: 'Island Countertop',cat: 'kitchen', w: 2.46,h: 0.04,d: 0.64,color: 0x654321, model: 'ikea/karlby_countertop_for_kitchen_island_wal.glb' },
  { id: 'ct_vrena',       name: 'Vrena Oak',        cat: 'kitchen', w: 1.86,h: 0.04,d: 0.64,color: 0xC4A872, model: 'ikea/vrena_countertop_oak_veneer.glb' },
  { id: 'ct_ekb_ash',     name: 'Ash Countertop',   cat: 'kitchen', w: 1.86,h: 0.04,d: 0.64,color: 0xD4C8A8, model: 'ikea/ekbacken_countertop_ash_effect_laminate.glb' },
  { id: 'ct_ekb_gray',    name: 'Gray Concrete CT',  cat:'kitchen', w: 1.86,h: 0.04,d: 0.64,color: 0xA0A0A0, model: 'ikea/ekbacken_countertop_light_gray_concrete_.glb' },
  { id: 'ct_moeckleryd',  name: 'White Laminate CT', cat:'kitchen', w: 1.86,h: 0.04,d: 0.64,color: 0xE0E0E0, model: 'ikea/moeckleryd_countertop_white_laminate.glb' },
  { id: 'ct_holmared',    name: 'Bamboo Countertop',cat: 'kitchen', w: 1.86,h: 0.04,d: 0.64,color: 0xC4A872, model: 'ikea/holmared_countertop_bamboo_veneer.glb' },
  { id: 'ct_ekb_walnut',  name: 'Walnut Laminate',  cat: 'kitchen', w: 1.86,h: 0.04,d: 0.64,color: 0x654321, model: 'ikea/ekbacken_countertop_brown_walnut_effect_.glb' },
  { id: 'ct_saeljan_dk',  name: 'Dark Stone CT',    cat: 'kitchen', w: 1.86,h: 0.04,d: 0.64,color: 0x555555, model: 'ikea/saeljan_countertop_dark_gray_stone_effec.glb' },
  { id: 'ct_barkaboda',   name: 'Barkaboda Walnut', cat: 'kitchen', w: 1.86,h: 0.04,d: 0.64,color: 0x654321, model: 'ikea/barkaboda_countertop_walnut_veneer.glb' },
  { id: 'ct_saeljan_lt',  name: 'Light Stone CT',   cat: 'kitchen', w: 1.86,h: 0.04,d: 0.64,color: 0xE0E0E0, model: 'ikea/saeljan_countertop_white_light_gray_ston.glb' },

  // ── Remaining IKEA Bathroom ──
  { id: 'faucet_brushed', name: 'Brushed Faucet',   cat: 'bathroom', w: 0.15,h: 0.25,d: 0.2, color: 0xC0C0C0, model: 'ikea/macksjoen_centerset_sink_faucet_brushed_.glb' },
  { id: 'faucet_black2',  name: 'Black Faucet Ctr', cat: 'bathroom', w: 0.15,h: 0.25,d: 0.2, color: 0x222222, model: 'ikea/macksjoen_centerset_sink_faucet_black.glb' },
  { id: 'faucet_chrome_w',name: 'Chrome Faucet Wide',cat:'bathroom', w: 0.2, h: 0.3, d: 0.2, color: 0xC0C0C0, model: 'ikea/macksjoen_widespread_sink_faucet_chrome_.glb' },

  // ── Remaining Kenney Furniture ──
  { id: 'k_bookcase_cl',  name: 'Closed Bookcase',  cat: 'living', w: 1.0, h: 1.8, d: 0.35,color: 0x5C4033, model: 'kenney/bookcaseClosed.glb' },
  { id: 'k_bookcase_drs', name: 'Bookcase w/ Doors',cat: 'living', w: 1.0, h: 1.8, d: 0.35,color: 0x5C4033, model: 'kenney/bookcaseClosedDoors.glb' },
  { id: 'k_bookcase_wd',  name: 'Wide Bookcase',    cat: 'living', w: 1.5, h: 1.8, d: 0.35,color: 0x5C4033, model: 'kenney/bookcaseClosedWide.glb' },
  { id: 'k_bookcase_op',  name: 'Open Bookcase',    cat: 'living', w: 1.0, h: 1.8, d: 0.35,color: 0x5C4033, model: 'kenney/bookcaseOpen.glb' },
  { id: 'k_bookcase_low', name: 'Low Open Bookcase',cat: 'living', w: 1.0, h: 0.9, d: 0.35,color: 0x5C4033, model: 'kenney/bookcaseOpenLow.glb' },
  { id: 'k_tv_cabinet',   name: 'TV Cabinet',       cat: 'living', w: 1.2, h: 0.5, d: 0.4, color: 0x654321, model: 'kenney/cabinetTelevision.glb' },
  { id: 'k_tv_cab_doors', name: 'TV Cab w/ Doors',  cat: 'living', w: 1.2, h: 0.5, d: 0.4, color: 0x654321, model: 'kenney/cabinetTelevisionDoors.glb' },
  { id: 'k_sofa_corner2', name: 'Design Corner Sofa',cat:'living', w: 2.2, h: 0.8, d: 2.2, color: 0x888888, model: 'kenney/loungeDesignSofaCorner.glb' },
  { id: 'k_sofa_basic',   name: 'Basic Sofa',       cat: 'living', w: 2.0, h: 0.8, d: 0.8, color: 0x6B4423, model: 'kenney/loungeSofa.glb' },
  { id: 'k_tv_antenna',   name: 'Retro TV',         cat: 'living', w: 0.45,h: 0.5, d: 0.35,color: 0x333333, model: 'kenney/televisionAntenna.glb' },
  { id: 'k_pillow_blue',  name: 'Blue Pillow',      cat: 'living', w: 0.4, h: 0.15,d: 0.4, color: 0x4477AA, model: 'kenney/pillowBlue.glb' },
  { id: 'k_pillow_bl_lg', name: 'Blue Long Pillow', cat: 'living', w: 0.6, h: 0.15,d: 0.3, color: 0x4477AA, model: 'kenney/pillowBlueLong.glb' },
  { id: 'k_pillow_long',  name: 'Long Pillow',      cat: 'living', w: 0.6, h: 0.15,d: 0.3, color: 0xE8DDD0, model: 'kenney/pillowLong.glb' },
  { id: 'k_cardbox_cl',   name: 'Closed Box',       cat: 'living', w: 0.4, h: 0.3, d: 0.3, color: 0xC4A872, model: 'kenney/cardboardBoxClosed.glb' },
  { id: 'k_cardbox_op',   name: 'Open Box',         cat: 'living', w: 0.4, h: 0.3, d: 0.3, color: 0xC4A872, model: 'kenney/cardboardBoxOpen.glb' },
  { id: 'k_coat_rack',    name: 'Wall Coat Rack',   cat: 'living', w: 0.6, h: 0.15,d: 0.1, color: 0x654321, model: 'kenney/coatRack.glb' },
  { id: 'k_trashcan',     name: 'Trash Can',        cat: 'living', w: 0.3, h: 0.5, d: 0.3, color: 0x888888, model: 'kenney/trashcan.glb' },
  { id: 'k_chair_basic',  name: 'Basic Chair',      cat: 'kitchen', w: 0.5, h: 0.9, d: 0.5, color: 0x654321, model: 'kenney/chair.glb' },
  { id: 'k_chair_cush',   name: 'Cushion Chair K',  cat: 'kitchen', w: 0.5, h: 0.9, d: 0.5, color: 0x654321, model: 'kenney/chairCushion.glb' },
  { id: 'k_chair_desk',   name: 'Desk Chair K',     cat: 'office', w: 0.5, h: 0.85,d: 0.5, color: 0x654321, model: 'kenney/chairDesk.glb' },
  { id: 'k_chair_mod_c',  name: 'Modern Cushion',   cat: 'kitchen', w: 0.5, h: 0.85,d: 0.5, color: 0x888888, model: 'kenney/chairModernCushion.glb' },
  { id: 'k_chair_mod_f',  name: 'Modern Frame',     cat: 'kitchen', w: 0.5, h: 0.85,d: 0.5, color: 0x888888, model: 'kenney/chairModernFrameCushion.glb' },
  { id: 'k_chair_round',  name: 'Rounded Chair K',  cat: 'kitchen', w: 0.5, h: 0.8, d: 0.5, color: 0x654321, model: 'kenney/chairRounded.glb' },
  { id: 'k_desk_basic',   name: 'Basic Desk',       cat: 'office', w: 1.2, h: 0.75,d: 0.6, color: 0x654321, model: 'kenney/desk.glb' },
  { id: 'k_side_tbl',     name: 'Side Table K',     cat: 'living', w: 0.5, h: 0.55,d: 0.5, color: 0x654321, model: 'kenney/sideTable.glb' },
  { id: 'k_side_tbl_d',   name: 'Side Tbl Drawers', cat: 'living', w: 0.5, h: 0.55,d: 0.5, color: 0x654321, model: 'kenney/sideTableDrawers.glb' },
  { id: 'k_table_basic',  name: 'Basic Table',      cat: 'kitchen', w: 1.2, h: 0.75,d: 0.7, color: 0x654321, model: 'kenney/table.glb' },
  { id: 'k_coffee_tbl',   name: 'Coffee Table K',   cat: 'living', w: 1.0, h: 0.4, d: 0.5, color: 0x654321, model: 'kenney/tableCoffee.glb' },
  { id: 'k_coffee_glass', name: 'Glass Coffee K',   cat: 'living', w: 1.0, h: 0.4, d: 0.5, color: 0xBBDDFF, model: 'kenney/tableCoffeeGlass.glb' },
  { id: 'k_coffee_gl_sq', name: 'Square Glass Tbl', cat: 'living', w: 0.8, h: 0.4, d: 0.8, color: 0xBBDDFF, model: 'kenney/tableCoffeeGlassSquare.glb' },
  { id: 'k_coffee_sq',    name: 'Square Coffee Tbl',cat: 'living', w: 0.8, h: 0.4, d: 0.8, color: 0x654321, model: 'kenney/tableCoffeeSquare.glb' },
  { id: 'k_tbl_cloth2',   name: 'Table w/ Cloth 2', cat: 'kitchen', w: 1.2, h: 0.75,d: 0.7, color: 0xF5F0E8, model: 'kenney/tableCrossCloth.glb' },
  { id: 'k_round_table',  name: 'Round Table K',    cat: 'kitchen', w: 1.0, h: 0.75,d: 1.0, color: 0x654321, model: 'kenney/tableRound.glb' },
  { id: 'k_cab_inner',    name: 'Inner Corner Cab', cat: 'kitchen', w: 0.6, h: 0.9, d: 0.6, color: 0xF5F0E8, model: 'kenney/kitchenCabinetCornerInner.glb' },
  { id: 'k_cab_upper_lo', name: 'Low Upper Cabinet', cat:'kitchen', w: 0.6, h: 0.4, d: 0.35,color: 0xF5F0E8, model: 'kenney/kitchenCabinetUpperLow.glb' },
  { id: 'k_bed_drawer',   name: 'Bed Drawer',       cat: 'bedroom', w: 0.5, h: 0.55,d: 0.4, color: 0x654321, model: 'kenney/cabinetBedDrawer.glb' },
  { id: 'k_lamp_rnd_flr', name: 'Round Floor Lamp', cat: 'living', w: 0.3, h: 1.5, d: 0.3, color: 0xD4A860, model: 'kenney/lampRoundFloor.glb' },
  { id: 'k_lamp_rnd_tbl', name: 'Round Table Lamp', cat: 'living', w: 0.2, h: 0.35,d: 0.2, color: 0xD4A860, model: 'kenney/lampRoundTable.glb' },
  { id: 'k_lamp_sq_flr',  name: 'Square Floor Lamp K',cat:'living',w: 0.3, h: 1.5, d: 0.3, color: 0xD4A860, model: 'kenney/lampSquareFloor.glb' },
  { id: 'k_lamp_sq_tbl',  name: 'Square Table Lamp K',cat:'living',w: 0.2, h: 0.35,d: 0.2, color: 0xD4A860, model: 'kenney/lampSquareTable.glb' },
  { id: 'k_rug_doormat',  name: 'Doormat K',        cat: 'living', w: 0.8, h: 0.02,d: 0.5, color: 0x8B5A2B, model: 'kenney/rugDoormat.glb' },
  { id: 'k_rug_rect',     name: 'Rectangle Rug K',  cat: 'living', w: 2.0, h: 0.02,d: 1.5, color: 0x8B5A2B, model: 'kenney/rugRectangle.glb' },
  { id: 'k_rug_rounded',  name: 'Rounded Rug',      cat: 'living', w: 2.0, h: 0.02,d: 1.5, color: 0xA07850, model: 'kenney/rugRounded.glb' },
  { id: 'k_rug_square',   name: 'Square Rug K',     cat: 'living', w: 2.0, h: 0.02,d: 2.0, color: 0xA07850, model: 'kenney/rugSquare.glb' },

  // -- Poly Haven -- CC0 Realistic PBR --
  { id: 'ph_armchair_01', name: 'Arm Chair 01', cat: 'living', w: 0.85, h: 1.07, d: 0.77, model: 'polyhaven/ArmChair_01.glb' },
  { id: 'ph_barbershopchair_01', name: 'Barber Shop Chair 01', cat: 'living', w: 0.76, h: 1.49, d: 1.33, model: 'polyhaven/BarberShopChair_01.glb' },
  { id: 'ph_classicconsole_01', name: 'Classic Console 01', cat: 'living', w: 1.54, h: 0.95, d: 0.59, model: 'polyhaven/ClassicConsole_01.glb' },
  { id: 'ph_classicnightstand_01', name: 'Classic Nightstand 01', cat: 'bedroom', w: 0.57, h: 0.7, d: 0.42, model: 'polyhaven/ClassicNightstand_01.glb' },
  { id: 'ph_coffeecart_01', name: 'Coffee Cart 01', cat: 'office', w: 2.17, h: 1.72, d: 1.07, model: 'polyhaven/CoffeeCart_01.glb' },
  { id: 'ph_coffeetable_01', name: 'Coffee Table 01', cat: 'living', w: 1.54, h: 0.52, d: 0.97, model: 'polyhaven/CoffeeTable_01.glb' },
  { id: 'ph_gothicbed_01', name: 'Gothic Bed 01', cat: 'bedroom', w: 1.49, h: 1.53, d: 2.04, model: 'polyhaven/GothicBed_01.glb' },
  { id: 'ph_gothiccabinet_01', name: 'Gothic Cabinet 01', cat: 'living', w: 1.72, h: 2.81, d: 1.02, model: 'polyhaven/GothicCabinet_01.glb' },
  { id: 'ph_gothiccommode_01', name: 'Gothic Commode 01', cat: 'living', w: 1.2, h: 1.34, d: 0.84, model: 'polyhaven/GothicCommode_01.glb' },
  { id: 'ph_greenchair_01', name: 'Green Chair 01', cat: 'living', w: 0.67, h: 1.06, d: 0.66, model: 'polyhaven/GreenChair_01.glb' },
  { id: 'ph_ottoman_01', name: 'Ottoman 01', cat: 'living', w: 0.88, h: 0.62, d: 0.62, model: 'polyhaven/Ottoman_01.glb' },
  { id: 'ph_rockingchair_01', name: 'Rocking Chair 01', cat: 'living', w: 0.71, h: 0.99, d: 0.83, model: 'polyhaven/Rockingchair_01.glb' },
  { id: 'ph_schoolchair_01', name: 'School Chair 01', cat: 'office', w: 0.57, h: 1.01, d: 0.68, model: 'polyhaven/SchoolChair_01.glb' },
  { id: 'ph_schooldesk_01', name: 'School Desk 01', cat: 'office', w: 0.71, h: 0.88, d: 0.55, model: 'polyhaven/SchoolDesk_01.glb' },
  { id: 'ph_shelf_01', name: 'Shelf 01', cat: 'living', w: 1, h: 2.08, d: 0.26, model: 'polyhaven/Shelf_01.glb' },
  { id: 'ph_sofa_01', name: 'Sofa 01', cat: 'living', w: 1.57, h: 0.8, d: 0.66, model: 'polyhaven/Sofa_01.glb' },
  { id: 'ph_woodenchair_01', name: 'Wooden Chair 01', cat: 'living', w: 0.69, h: 2.27, d: 0.66, model: 'polyhaven/WoodenChair_01.glb' },
  { id: 'ph_woodentable_01', name: 'Wooden Table 01', cat: 'living', w: 1.8, h: 0.55, d: 0.66, model: 'polyhaven/WoodenTable_01.glb' },
  { id: 'ph_woodentable_02', name: 'Wooden Table 02', cat: 'living', w: 0.3, h: 0.42, d: 0.3, model: 'polyhaven/WoodenTable_02.glb' },
  { id: 'ph_woodentable_03', name: 'Wooden Table 03', cat: 'living', w: 1.33, h: 1.2, d: 0.72, model: 'polyhaven/WoodenTable_03.glb' },
  { id: 'ph_bar_chair_round_01', name: 'Bar Chair Round 01', cat: 'living', w: 0.49, h: 0.75, d: 0.48, model: 'polyhaven/bar_chair_round_01.glb' },
  { id: 'ph_chinese_armchair', name: 'Chinese Armchair', cat: 'living', w: 0.85, h: 1.59, d: 0.79, model: 'polyhaven/chinese_armchair.glb' },
  { id: 'ph_chinese_cabinet', name: 'Chinese Cabinet', cat: 'living', w: 1.26, h: 3.67, d: 0.7, model: 'polyhaven/chinese_cabinet.glb' },
  { id: 'ph_chinese_commode', name: 'Chinese Commode', cat: 'living', w: 4.49, h: 2.02, d: 1.17, model: 'polyhaven/chinese_commode.glb' },
  { id: 'ph_chinese_console_table', name: 'Chinese Console Table', cat: 'living', w: 1.72, h: 0.66, d: 0.34, model: 'polyhaven/chinese_console_table.glb' },
  { id: 'ph_chinese_screen_panels', name: 'Chinese Screen Panels', cat: 'living', w: 1.29, h: 1.6, d: 0.38, model: 'polyhaven/chinese_screen_panels.glb' },
  { id: 'ph_chinese_sofa', name: 'Chinese Sofa', cat: 'living', w: 2.29, h: 0.86, d: 0.97, model: 'polyhaven/chinese_sofa.glb' },
  { id: 'ph_chinese_stool', name: 'Chinese Stool', cat: 'living', w: 0.51, h: 0.63, d: 0.6, model: 'polyhaven/chinese_stool.glb' },
  { id: 'ph_chinese_tea_table', name: 'Chinese Tea Table', cat: 'living', w: 0.84, h: 0.5, d: 0.84, model: 'polyhaven/chinese_tea_table.glb' },
  { id: 'ph_coffee_table_round_01', name: 'Coffee Table Round 01', cat: 'living', w: 1.3, h: 0.49, d: 1.3, model: 'polyhaven/coffee_table_round_01.glb' },
  { id: 'ph_dining_chair_02', name: 'Dining Chair 02', cat: 'living', w: 0.43, h: 0.97, d: 0.58, model: 'polyhaven/dining_chair_02.glb' },
  { id: 'ph_drawer_cabinet', name: 'Drawer Cabinet', cat: 'living', w: 1.14, h: 1.88, d: 0.49, model: 'polyhaven/drawer_cabinet.glb' },
  { id: 'ph_folding_wooden_stool', name: 'Folding Wooden Stool', cat: 'living', w: 0.53, h: 0.44, d: 0.55, model: 'polyhaven/folding_wooden_stool.glb' },
  { id: 'ph_gallinera_chair', name: 'Gallinera Chair', cat: 'living', w: 0.58, h: 1.03, d: 0.6, model: 'polyhaven/gallinera_chair.glb' },
  { id: 'ph_gallinera_table', name: 'Gallinera Table', cat: 'living', w: 0.83, h: 0.49, d: 0.52, model: 'polyhaven/gallinera_table.glb' },
  { id: 'ph_gothic_coffee_table', name: 'Gothic Coffee Table', cat: 'living', w: 1.44, h: 0.56, d: 1.44, model: 'polyhaven/gothic_coffee_table.glb' },
  { id: 'ph_industrial_coffee_table', name: 'Industrial Coffee Table', cat: 'living', w: 0.78, h: 0.76, d: 0.64, model: 'polyhaven/industrial_coffee_table.glb' },
  { id: 'ph_mid_century_lounge_chair', name: 'Mid Century Lounge Chair', cat: 'living', w: 1.01, h: 1.17, d: 1.19, model: 'polyhaven/mid_century_lounge_chair.glb' },
  { id: 'ph_modern_arm_chair_01', name: 'Modern Arm Chair 01', cat: 'office', w: 0.82, h: 1.02, d: 0.99, model: 'polyhaven/modern_arm_chair_01.glb' },
  { id: 'ph_modern_coffee_table_01', name: 'Modern Coffee Table 01', cat: 'living', w: 0.6, h: 0.39, d: 1.2, model: 'polyhaven/modern_coffee_table_01.glb' },
  { id: 'ph_modern_coffee_table_02', name: 'Modern Coffee Table 02', cat: 'living', w: 1.2, h: 0.37, d: 1.2, model: 'polyhaven/modern_coffee_table_02.glb' },
  { id: 'ph_modern_wooden_cabinet', name: 'Modern Wooden Cabinet', cat: 'living', w: 2.44, h: 0.68, d: 0.68, model: 'polyhaven/modern_wooden_cabinet.glb' },
  { id: 'ph_modular_street_seating', name: 'Modular Street Seating', cat: 'outdoor', w: 1.86, h: 0.73, d: 1.17, model: 'polyhaven/modular_street_seating.glb' },
  { id: 'ph_ornate_mirror_01', name: 'Ornate Mirror 01', cat: 'bathroom', w: 0.49, h: 0.74, d: 0.03, model: 'polyhaven/ornate_mirror_01.glb' },
  { id: 'ph_outdoor_table_chair_set_01', name: 'Outdoor Table Chair Set', cat: 'outdoor', w: 0.79, h: 0.86, d: 1.71, model: 'polyhaven/outdoor_table_chair_set_01.glb' },
  { id: 'ph_painted_wooden_bench', name: 'Painted Wooden Bench', cat: 'living', w: 1.16, h: 0.89, d: 0.5, model: 'polyhaven/painted_wooden_bench.glb' },
  { id: 'ph_painted_wooden_cabinet', name: 'Painted Wooden Cabinet', cat: 'living', w: 1.19, h: 1.56, d: 0.64, model: 'polyhaven/painted_wooden_cabinet.glb' },
  { id: 'ph_painted_wooden_cabinet_02', name: 'Painted Cabinet 02', cat: 'living', w: 1.07, h: 3, d: 0.65, model: 'polyhaven/painted_wooden_cabinet_02.glb' },
  { id: 'ph_painted_wooden_chair_01', name: 'Painted Chair 01', cat: 'living', w: 0.43, h: 0.96, d: 0.54, model: 'polyhaven/painted_wooden_chair_01.glb' },
  { id: 'ph_painted_wooden_chair_02', name: 'Painted Chair 02', cat: 'living', w: 0.66, h: 1.26, d: 0.64, model: 'polyhaven/painted_wooden_chair_02.glb' },
  { id: 'ph_painted_wooden_nightstand', name: 'Painted Nightstand', cat: 'bedroom', w: 0.5, h: 0.66, d: 0.63, model: 'polyhaven/painted_wooden_nightstand.glb' },
  { id: 'ph_painted_wooden_shelves', name: 'Painted Shelves', cat: 'living', w: 0.51, h: 1.13, d: 0.37, model: 'polyhaven/painted_wooden_shelves.glb' },
  { id: 'ph_painted_wooden_sofa', name: 'Painted Wooden Sofa', cat: 'living', w: 2.45, h: 1.28, d: 0.79, model: 'polyhaven/painted_wooden_sofa.glb' },
  { id: 'ph_painted_wooden_stool', name: 'Painted Stool', cat: 'living', w: 0.38, h: 0.58, d: 0.41, model: 'polyhaven/painted_wooden_stool.glb' },
  { id: 'ph_painted_wooden_table', name: 'Painted Wooden Table', cat: 'living', w: 2.41, h: 0.96, d: 1.14, model: 'polyhaven/painted_wooden_table.glb' },
  { id: 'ph_plastic_monobloc_chair_01', name: 'Plastic Chair', cat: 'living', w: 0.64, h: 0.88, d: 0.63, model: 'polyhaven/plastic_monobloc_chair_01.glb' },
  { id: 'ph_round_wooden_table_01', name: 'Round Table 01', cat: 'living', w: 1.4, h: 1.01, d: 1.4, model: 'polyhaven/round_wooden_table_01.glb' },
  { id: 'ph_round_wooden_table_02', name: 'Round Table 02', cat: 'living', w: 0.8, h: 0.75, d: 0.8, model: 'polyhaven/round_wooden_table_02.glb' },
  { id: 'ph_side_table_01', name: 'Side Table 01', cat: 'living', w: 0.55, h: 0.55, d: 0.45, model: 'polyhaven/side_table_01.glb' },
  { id: 'ph_side_table_tall_01', name: 'Side Table Tall', cat: 'living', w: 0.38, h: 0.76, d: 0.38, model: 'polyhaven/side_table_tall_01.glb' },
  { id: 'ph_small_wooden_table_01', name: 'Small Table 01', cat: 'living', w: 0.92, h: 0.53, d: 0.44, model: 'polyhaven/small_wooden_table_01.glb' },
  { id: 'ph_sofa_02', name: 'Sofa 02', cat: 'living', w: 1.81, h: 0.71, d: 0.82, model: 'polyhaven/sofa_02.glb' },
  { id: 'ph_sofa_03', name: 'Sofa 03', cat: 'living', w: 2.73, h: 1.12, d: 0.93, model: 'polyhaven/sofa_03.glb' },
  { id: 'ph_steel_frame_shelves_02', name: 'Steel Frame Shelves', cat: 'living', w: 0.59, h: 2.14, d: 0.5, model: 'polyhaven/steel_frame_shelves_02.glb' },
  { id: 'ph_steel_frame_shelves_03', name: 'Steel Shelves Large', cat: 'living', w: 2.35, h: 2.36, d: 0.98, model: 'polyhaven/steel_frame_shelves_03.glb' },
  { id: 'ph_stone_fire_pit', name: 'Stone Fire Pit', cat: 'outdoor', w: 1.45, h: 0.39, d: 1.43, model: 'polyhaven/stone_fire_pit.glb' },
  { id: 'ph_vintage_cabinet_01', name: 'Vintage Cabinet', cat: 'living', w: 2.02, h: 2.58, d: 0.65, model: 'polyhaven/vintage_cabinet_01.glb' },
  { id: 'ph_vintage_wooden_drawer_01', name: 'Vintage Drawer', cat: 'living', w: 0.86, h: 0.65, d: 0.44, model: 'polyhaven/vintage_wooden_drawer_01.glb' },
  { id: 'ph_wooden_bookshelf_worn', name: 'Worn Bookshelf', cat: 'living', w: 1.37, h: 2.06, d: 0.58, model: 'polyhaven/wooden_bookshelf_worn.glb' },
  { id: 'ph_wooden_display_shelves_01', name: 'Display Shelves', cat: 'living', w: 0.37, h: 1.56, d: 1.08, model: 'polyhaven/wooden_display_shelves_01.glb' },
  { id: 'ph_wooden_picnic_table', name: 'Picnic Table', cat: 'outdoor', w: 2.24, h: 0.75, d: 3.02, model: 'polyhaven/wooden_picnic_table.glb' },
  { id: 'ph_wooden_stool_01', name: 'Wooden Stool 01', cat: 'living', w: 0.43, h: 0.44, d: 0.44, model: 'polyhaven/wooden_stool_01.glb' },
  { id: 'ph_wooden_stool_02', name: 'Wooden Stool 02', cat: 'living', w: 0.27, h: 0.18, d: 0.18, model: 'polyhaven/wooden_stool_02.glb' },
  { id: 'ph_wooden_table_02', name: 'Wooden Table 02', cat: 'living', w: 1.13, h: 0.8, d: 0.71, model: 'polyhaven/wooden_table_02.glb' },
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
  const sw = item.w * SCENE_XZ_SCALE;
  const sd = item.d * SCENE_XZ_SCALE;
  const box = new THREE.Mesh(new THREE.BoxGeometry(sw, item.h, sd), mat);
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

  const modelPath = `/models/${item.model}`;
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
    // Apply PBR material overrides (skip for IKEA/Poly Haven models with authored PBR materials)
    if (!item.model.startsWith('ikea/') && !item.model.startsWith('polyhaven/')) {
      applyMaterialOverrides(clone, item);
    }
    group.add(clone);

    // Add contact shadow disc under furniture
    const shadow = createContactShadow(item);
    group.add(shadow);
  }).catch(() => {
    // Keep placeholder on failure — it's already there
  });

  return group;
}

// ── Place furniture in scene ──
export function placeItem(id, x, z, rotY = 0, floor = 0, y = null, scaleXYZ = null) {
  const mesh = createMesh(id);
  if (!mesh) return null;
  const yBase = y != null ? y : floor * FLOOR_HEIGHT;
  mesh.position.set(x, yBase, z);
  mesh.rotation.y = rotY;
  mesh.userData.floor = floor;
  mesh.userData.meshId = crypto.randomUUID();
  if (scaleXYZ) {
    mesh.scale.set(scaleXYZ.x, scaleXYZ.y, scaleXYZ.z);
    mesh.userData.customScale = mesh.scale.clone();
  }
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

/** Preload first 30 models (10 per source) for the initial grid page */
export function preloadModels() {
  const picks = [];
  const counts = { ikea: 0, polyhaven: 0, kenney: 0 };
  const PER_SOURCE = 10;
  const seen = new Set();
  for (const item of CATALOG) {
    if (!item.model || seen.has(item.model)) continue;
    const src = item.model.startsWith('ikea/') ? 'ikea'
      : item.model.startsWith('polyhaven/') ? 'polyhaven' : 'kenney';
    if (counts[src] < PER_SOURCE) {
      counts[src]++;
      seen.add(item.model);
      picks.push(`/models/${item.model}`);
    }
    if (picks.length >= PER_SOURCE * 3) break;
  }
  // Load all 30 concurrently — small enough not to overwhelm
  picks.forEach(p => loadGLTF(p));
}

// ── Thumbnail rendering (lazy, on-demand) ──
const THUMB_SIZE = 128;
export const thumbnails = new Map(); // id -> dataURL
const thumbByModel = new Map(); // model path -> dataURL (dedup)
const thumbPending = new Map(); // id -> Promise<string|null>

let thumbRenderer = null;
let thumbScene = null;
let thumbCamera = null;
let thumbLightCount = 0;

function ensureThumbRenderer() {
  if (thumbRenderer) return;
  thumbRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  thumbRenderer.setSize(THUMB_SIZE, THUMB_SIZE);
  thumbRenderer.setPixelRatio(1);
  thumbRenderer.setClearColor(0x000000, 0);

  thumbScene = new THREE.Scene();
  thumbCamera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);

  thumbScene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(3, 5, 4);
  thumbScene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-2, 3, -1);
  thumbScene.add(fill);
  thumbLightCount = thumbScene.children.length;
}

/** Generate a thumbnail for a single catalog item. Returns dataURL or null. */
export function generateThumbnail(itemId) {
  if (thumbnails.has(itemId)) return Promise.resolve(thumbnails.get(itemId));
  if (thumbPending.has(itemId)) return thumbPending.get(itemId);

  const item = CATALOG.find(c => c.id === itemId);
  if (!item || !item.model) return Promise.resolve(null);

  const modelPath = `/models/${item.model}`;
  if (thumbByModel.has(modelPath)) {
    const url = thumbByModel.get(modelPath);
    thumbnails.set(itemId, url);
    return Promise.resolve(url);
  }

  const p = loadGLTF(modelPath).then(original => {
    ensureThumbRenderer();
    const clone = original.clone();
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

    while (thumbScene.children.length > thumbLightCount) {
      thumbScene.remove(thumbScene.children[thumbScene.children.length - 1]);
    }

    thumbScene.add(clone);
    thumbRenderer.render(thumbScene, thumbCamera);

    const dataURL = thumbRenderer.domElement.toDataURL('image/png');
    thumbnails.set(itemId, dataURL);
    thumbByModel.set(modelPath, dataURL);
    thumbScene.remove(clone);
    thumbPending.delete(itemId);
    return dataURL;
  }).catch(() => {
    thumbPending.delete(itemId);
    return null;
  });

  thumbPending.set(itemId, p);
  return p;
}

/** @deprecated Use generateThumbnail(id) for lazy loading. No-op kept for compat. */
export async function generateThumbnails() {
  // Thumbnails are now generated lazily per-item. No startup cost.
}
