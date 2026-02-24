# Iteration Log — 3D Apartment Designer

## Iteration 1 — Initial Build
- [x] Project scaffolded with Vite + Three.js
- [x] 9 rooms built: Staircase, Bedroom, WC, Foyer, Corridor, Living, Kitchen, Bathroom, Utility
- [x] L-shaped courtyard with skylight + steel frame
- [x] Furniture catalog (20+ items, 5 categories)
- [x] Orbit / Walk / Top camera modes
- [x] localStorage persistence
- [x] Minimap
- **Issues found:**
  - [x] Courtyard walls misaligned — extend beyond apartment boundary
  - [x] Room proportions don't match floor plan exactly
  - [x] No ceilings on rooms (can see through from above)
  - [x] Lighting too flat, needs warmth
  - [x] No baseboards, door frames, or staircase steps
  - [x] Steel frame beams look off-angle
  - [x] UI needs more polish

## Iteration 2 — Fixes (completed)
- [x] Fix courtyard offset OX=9.10 (was 9.35)
- [x] Fix room dimensions to match floor plan
- [x] Add room ceilings with visibility toggle (hidden in orbit/top, shown in walk)
- [x] Warm Riyadh desert lighting — sky gradient, hemisphere light, 4096 shadow maps
- [x] Add baseboards (0.08m, warm stone color)
- [x] Add door frames (wood-brown 0x6B4423)
- [x] Build staircase — 15 steps with side stringers
- [x] Fix steel frame beam slope angle rotation
- [x] Improve glass materials with envMapIntensity
- [x] Add courtyard ambient details — 10 planters, 9 string lights
- [x] UI polish with frontend-design skill — gold accents, animations, premium feel
- [x] Fix favicon 404
- [x] Verify with DevTools MCP — zero console errors

## Iteration 3 — Visual Refinement (completed)
- [x] Add window openings in exterior walls (5 windows: bedroom, staircase, living x2, bathroom)
- [x] Add interior door panels with pivot/hinge — all doors appear 15° ajar with knobs
- [x] Mashrabiya-inspired lattice on east wall (diamond grid, y=3.0 to 6.5)
- [x] Reflecting pool with stone border and central fountain + warm light
- [x] Built-in bench seating with cushions (2 benches along courtyard walls)
- [x] Post-processing: SSAO + UnrealBloom + FXAA via EffectComposer
- [x] Fix Three.js deprecations (sRGBEncoding → SRGBColorSpace, remove useLegacyLights)
- [x] Clean Vite build — zero errors

## Iteration 4 — Floor Plan Layout Fix (completed)
- [x] Complete vertical re-proportioning to match schematic
  - Top section depth: 4.50m → 2.63m (was way too deep)
  - Corridor moved: z=4.75 → z=2.88 (with walls at z=2.63 and z=3.84)
  - Living room depth: 5.24m → 7.11m (matches courtyard L-shape dimension)
- [x] Bottom section horizontal fix
  - Storage+Kitchen left column: 3.43m wide (matches schematic "3.43" dimension)
  - Living room: 5.42m wide × 7.11m deep = dominant room (38+ sq.m)
  - Storage: 3.43×2.0m (small, upper-left)
  - Kitchen: 3.43×4.86m (below storage)
- [x] Wall layout corrected
  - vWall at x=3.43 separates left column from living room
  - hWall at z=6.09 separates storage from kitchen
  - East wall split at z=4.09 (courtyard L-shape corner)
  - Front door on west wall at corridor level (z=3.36)
- [x] Staircase made adaptive (step count fits room depth)
- [x] Window positions updated for new room positions
- [x] Bathroom depth: 1.35m (matches schematic dimension)
- [x] Minimap auto-updated (reads from ROOMS array)
- [x] Zero console errors verified via DevTools

## Iteration 5 — Corridor Removal & Guest Rooms (completed)
- [x] **Removed corridor entirely** — user confirmed "there is no corridor in this house"
  - Staircase opens directly into living room via wide arch (2.2m opening at z=2.63)
  - Bedroom door opens directly to living room (0.9m door at z=2.63)
  - Removed corridor and passage from ROOMS array
  - Removed both corridor walls (z=2.63 and z=3.84), replaced with single wall at z=2.63
- [x] Living room expanded: x=0, z=2.88, w=9.10, d=8.32 (75+ sq.m, fills entire bottom section)
- [x] Added Guest Room (x=0, z=9.09, w=2.00, d=2.11) and Guest Bath (x=2.25, z=9.09, w=1.18, d=2.11)
  - User described: "kitchen → divider → room → its bathroom" in left column
  - Kitchen | Guest area divider wall at z=8.84
  - Guest room | Guest bath divider wall at x=2.00
- [x] Kitchen depth reduced to 2.50m (z=6.34 to z=8.84) to accommodate guest rooms
- [x] Updated FLOOR_PRESETS, minimap ROOM_COLORS for new rooms
- [x] Z-fighting fix: overlapping rooms (storage, kitchen, guestroom, guestbath) use y=0.015
- [x] Front door moved to west wall at z=3.50 (opens into living room, no corridor)
- [x] Zero console errors verified via DevTools

### Iteration 5.1 — Layout Flow Fixes
- [x] Left column wall at x=3.43 now starts at z=4.09 (was z=2.63)
  - Previously created a dead-end between z=2.63 and z=4.09 trapping the front door entry
  - Now z=2.88 to z=4.09 is full-width open living room
- [x] Added hWall at z=4.09 (x=0 to 3.43) as north wall of left column with door
- [x] Bedroom extended to w=4.52 (was 3.12) to include passage area below bathroom
  - Bathroom added to z-fighting overlapping list (y=0.015)
- [x] Fixed window positions:
  - South wall: guest room window repositioned to x=1.00, w=0.9 (was crossing divider wall)
  - West wall: kitchen window moved to z=7.59, w=1.2 (was extending past kitchen boundary)
- [x] Zero console errors verified

## Remaining Ideas
- [ ] Walk mode collision detection with walls
- [ ] Improve minimap — show door openings, courtyard L-shape accurately
- [ ] Add wall textures/bump maps for realism
- [ ] Day/night cycle slider in UI
- [ ] Export to Blender script sync
