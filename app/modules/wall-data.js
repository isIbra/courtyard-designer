// ── Seed wall data — all original apartment walls as data records ──
// Converted from the hw(z, x1, x2) / vw(x, z1, z2) calls in buildApartment()

const T = 0.35;
const H = 3.0;

export const SEED_WALLS = [
  // ── EXTERIOR PERIMETER ──
  { id: 's1',  type: 'h', z: 1.41,  x1: 0.83,  x2: 12.29, H, T, isOriginal: true, floor: 0 },  // North wall — closet/staircase
  { id: 's2',  type: 'v', x: 12.29, z1: 1.41,  z2: 2.49,  H, T, isOriginal: true, floor: 0 },  // North step jog
  { id: 's3',  type: 'h', z: 2.49,  x1: 12.29, x2: 44.13, H, T, isOriginal: true, floor: 0 },  // North wall — bedroom to courtyard east
  { id: 's4',  type: 'v', x: 0.83,  z1: 1.41,  z2: 31.13, H, T, isOriginal: true, floor: 0 },  // West wall
  { id: 's5',  type: 'h', z: 31.13, x1: 0.83,  x2: 47.12, H, T, isOriginal: true, floor: 0 },  // South wall

  // ── APARTMENT EAST WALL (apartment <-> courtyard) ──
  { id: 's6',  type: 'v', x: 31.83, z1: 2.49,  z2: 13.28, H, T, isOriginal: true, floor: 0 },  // Upper section
  { id: 's7',  type: 'h', z: 13.28, x1: 30.15, x2: 31.83, H, T, isOriginal: true, floor: 0 },  // Horizontal step
  { id: 's8',  type: 'v', x: 30.15, z1: 13.28, z2: 19.60, H, T, isOriginal: true, floor: 0 },  // Above courtyard door
  { id: 's9',  type: 'v', x: 30.15, z1: 22.49, z2: 31.13, H, T, isOriginal: true, floor: 0 },  // Below courtyard door

  // ── COURTYARD EAST WALL (L-shaped) ──
  { id: 's10', type: 'v', x: 44.13, z1: 2.49,  z2: 23.17, H, T, isOriginal: true, floor: 0 },  // Upper section
  { id: 's11', type: 'h', z: 23.17, x1: 44.13, x2: 47.12, H, T, isOriginal: true, floor: 0 },  // Step — courtyard widens
  { id: 's12', type: 'v', x: 47.12, z1: 23.17, z2: 31.13, H, T, isOriginal: true, floor: 0 },  // Lower section

  // ── TOP ROW INTERIOR WALLS ──
  { id: 's13', type: 'v', x: 5.51,  z1: 1.41,  z2: 13.24, H, T, isOriginal: true, floor: 0 },  // Staircase left shaft
  { id: 's14', type: 'v', x: 5.93,  z1: 1.41,  z2: 12.97, H, T, isOriginal: true, floor: 0 },  // Staircase right shaft
  { id: 's15', type: 'v', x: 11.89, z1: 1.41,  z2: 13.24, H, T, isOriginal: true, floor: 0 },  // Staircase | Bedroom
  { id: 's16', type: 'v', x: 25.59, z1: 2.49,  z2: 8.67,  H, T, isOriginal: true, floor: 0 },  // Bedroom | Bathroom
  { id: 's17', type: 'h', z: 8.67,  x1: 25.59, x2: 31.83, H, T, isOriginal: true, floor: 0 },  // Bathroom south wall

  // ── TOP ROW -> LIVING ROOM WALL (with openings) ──
  { id: 's18', type: 'h', z: 13.06, x1: 2.94,  x2: 3.59,  H, T, isOriginal: true, floor: 0 },  // Closet entrance partition
  { id: 's19', type: 'h', z: 13.24, x1: 12.38, x2: 14.02, H, T, isOriginal: true, floor: 0 },  // Between staircase & bedroom door
  { id: 's20', type: 'h', z: 13.24, x1: 15.94, x2: 30.15, H, T, isOriginal: true, floor: 0 },  // Bedroom door to east wall

  // ── LEFT COLUMN ──
  { id: 's21', type: 'h', z: 20.30, x1: 0.83,  x2: 11.89, H, T, isOriginal: true, floor: 0 },  // Column north wall
  { id: 's22', type: 'v', x: 11.89, z1: 20.30, z2: 21.53, H, T, isOriginal: true, floor: 0 },  // Column east — upper
  { id: 's23', type: 'v', x: 11.89, z1: 23.28, z2: 25.25, H, T, isOriginal: true, floor: 0 },  // Column east — lower
  { id: 's24', type: 'v', x: 3.03,  z1: 20.30, z2: 25.04, H, T, isOriginal: true, floor: 0 },  // Interior vertical wall

  // ── BOTTOM ROOMS WALL (z=25.04, with door gaps) ──
  { id: 's25', type: 'h', z: 25.04, x1: 2.94,  x2: 15.10, H, T, isOriginal: true, floor: 0 },  // Left segment
  { id: 's26', type: 'h', z: 25.04, x1: 17.00, x2: 19.50, H, T, isOriginal: true, floor: 0 },  // Middle segment
  { id: 's27', type: 'h', z: 25.04, x1: 22.20, x2: 30.15, H, T, isOriginal: true, floor: 0 },  // Right segment

  // ── BOTTOM ROOMS VERTICAL DIVIDERS ──
  { id: 's28', type: 'v', x: 9.0,   z1: 25.04, z2: 31.13, H, T, isOriginal: true, floor: 0 },  // Guest room | kitchen
  { id: 's29', type: 'v', x: 18.50, z1: 25.04, z2: 31.13, H, T, isOriginal: true, floor: 0 },  // Room divider 2
  { id: 's30', type: 'v', x: 22.80, z1: 25.04, z2: 31.13, H, T, isOriginal: true, floor: 0 },  // Room divider 3
];

export function createWallRecord(type, params, floor = 0) {
  const id = `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return { id, type, ...params, H, T, isOriginal: false, floor };
}
