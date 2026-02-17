# Handoff Prompt — Courtyard Designer Room Layout Fix

## Context
You're continuing work on a 3D apartment + courtyard designer (Three.js + Vite). The app is modular under `app/modules/`. Run `npm run dev` to start.

## Task: Fix Room Layout to Match Floor Plan

The room dimensions and layout in `app/modules/apartment.js` do NOT match the architectural floor plan. You need to rewrite the ROOMS array, wall definitions, doors, windows, and staircase to match.

## Floor Plan Reference (from architect drawings)

### Current Code Layout (WRONG):
```
Staircase(2.75x4.50) | Bedroom(4.35x4.50) | WC(1.50x2.00) / Foyer(1.50x2.25)
========================= Corridor (9.10 x 0.96) =========================
Living(4.00x5.24) | Kitchen(3.43x2.40) / Bathroom(3.43x2.59) | Utility(1.17x5.24)
```

### Correct Layout (from floor plan images):
```
Walk-in Closet(1.78xTBD) | Staircase(4.33x5.21) | Bedroom(~5.31 wide) | Bathroom(~2.5 deep)
================================ Corridor (0.96 wide) ================================
Storage(4.55 wide) | Living Room (large central) | Kitchen (bottom)
```

### Key Dimensions from Floor Plan:
- **Overall building left wall**: 7.59m tall
- **Walk-in closet**: ~1.78m wide, far left, top of building
- **Staircase**: ~4.33m wide x 5.21m deep (currently 2.75x4.50 — too small)
- **Bedroom**: upper center, ~6.62m total zone width, 5.31m depth section
- **Bathroom**: upper right area, ~2.5m deep, dimensions 1.12m + 2.29m
- **Corridor**: 0.96m wide (this is correct), also 0.63m secondary passage
- **Living room**: large central space, 7.11m dimension, 10.27m total width reference
- **Storage**: replaces "Utility", ~4.55m wide, below staircase area on left
- **Kitchen**: bottom area, 3.43m height reference
- **Courtyard connection**: 0.96m + 0.63m passage widths

### Missing Rooms to Add:
1. **Walk-in closet** — far left column, above storage area
2. **Storage** — rename "Utility" and reposition below staircase/walk-in closet

### Rooms to Remove/Rename:
- **WC** and **Foyer** — not in the floor plan as separate rooms; merge or remove
- **Utility** → rename to **Storage** and move to correct position

### Courtyard (RIGHT side, L-shaped — already correct):
- Top width: 4.55m
- Right height: 8.35m upper + 1.12m step + 3.1m bump
- Bottom width: 6.3m
- Courtyard offset OX=9.10 from apartment — this should stay

## What to Modify in `app/modules/apartment.js`:
1. **ROOMS array** (line 15-25) — update dimensions, positions, add walk-in closet + storage
2. **FLOOR_PRESETS** (line 28-38) — add presets for new rooms
3. **buildWalls()** (line 615-664) — rewrite wall positions to match new layout
4. **buildWindows()** (line 457-467) — adjust window positions for new wall locations
5. **buildStaircase()** (line 542-612) — update for larger staircase dimensions

## Also Update:
- `app/modules/courtyard.js` — if apartment boundary changes, adjust OX/OZ offsets
- `app/modules/minimap.js` — room rectangles need to match new layout
- `app/modules/ui.js` — room list in Rooms tab

## Important Constraints:
- Wall thickness T=0.25m everywhere
- Ceiling height H=3.0m
- Door height DOOR_H=2.1m
- Coordinate system: X = left-right, Z = top-bottom (in top view), Y = up
- Origin (0,0) = top-left corner of apartment interior
- Courtyard is at X=9.10 offset (east side of apartment)

## How to Verify:
1. `npm run dev` → open http://localhost:5173/
2. Click "Top" view to see layout from above
3. Compare with floor plan images in project root or Downloads
4. Check that all walls connect properly (no gaps)
5. Check console for errors
