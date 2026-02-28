/**
 * Seed data for the courtyard designer.
 * Plain JS objects — no Three.js imports. Used by:
 *   - scripts/migrate-sqlite-to-pg.js  (migration)
 *   - server/index.js                  (template system)
 */

export const ROOMS = [
  { id: 'closet',       name: 'Closet',       x: 0.83,  z: 1.41,  w: 4.68,  d: 11.65, floorType: 'wood_oak' },
  { id: 'staircase',    name: 'Staircase',    x: 5.93,  z: 1.41,  w: 5.96,  d: 11.56, floorType: 'concrete_smooth' },
  { id: 'bedroom',      name: 'Bedroom',      x: 11.89, z: 2.49,  w: 19.94, d: 10.75, floorType: 'wood_walnut' },
  { id: 'bathroom',     name: 'Bathroom',     x: 25.59, z: 2.49,  w: 6.24,  d: 6.18,  floorType: 'tile_square',     yOffset: 0.015 },
  { id: 'living',       name: 'Living Room',  x: 0.83,  z: 13.24, w: 29.32, d: 7.06,  floorType: 'wood_herringbone' },
  { id: 'living_south', name: 'Living South', x: 11.89, z: 20.30, w: 18.26, d: 4.74,  floorType: 'wood_herringbone' },
  { id: 'storage',      name: 'Storage',      x: 0.83,  z: 20.30, w: 2.20,  d: 4.74,  floorType: 'concrete_rough',  yOffset: 0.015 },
  { id: 'kitchen',      name: 'Kitchen',      x: 3.03,  z: 20.30, w: 8.86,  d: 4.74,  floorType: 'tile_subway',     yOffset: 0.015 },
  { id: 'guestroom',    name: 'Guest Room',   x: 0.83,  z: 25.04, w: 8.17,  d: 6.09,  floorType: 'wood_ash' },
  { id: 'room2',        name: 'Room 2',       x: 9.0,   z: 25.04, w: 9.50,  d: 6.09,  floorType: 'wood_oak' },
  { id: 'room3',        name: 'Room 3',       x: 18.50, z: 25.04, w: 4.30,  d: 6.09,  floorType: 'wood_oak' },
  { id: 'room4',        name: 'Room 4',       x: 22.80, z: 25.04, w: 7.35,  d: 6.09,  floorType: 'wood_walnut' },
];

export const ROOM_WALL_COLORS = {
  closet:       '#EBE0D0',
  staircase:    '#E8DDD0',
  bedroom:      '#EDE5D8',
  bathroom:     '#F0EDE8',
  living:       '#EBE0D0',
  living_south: '#EBE0D0',
  storage:      '#E5DDD0',
  kitchen:      '#F0EBE0',
  guestroom:    '#EDE5D8',
  room2:        '#EBE0D0',
  room3:        '#EBE0D0',
  room4:        '#EDE5D8',
};
