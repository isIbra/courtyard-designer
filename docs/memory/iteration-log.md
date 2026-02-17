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

## Remaining Ideas
- [ ] Walk mode collision detection with walls
- [ ] Improve minimap — show door openings, courtyard L-shape accurately
- [ ] Add wall textures/bump maps for realism
- [ ] Day/night cycle slider in UI
- [ ] Export to Blender script sync
