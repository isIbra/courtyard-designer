# CLAUDE.md — Project Context for Claude Code

## Project: Courtyard Designer
Interactive 3D courtyard and apartment designer. Two outputs:
1. **Blender Python script** for high-quality 3D modeling/rendering
2. **Three.js browser app** for interactive walkable design with furniture placement

## Key Files
- `src/designer.html` — Main Three.js app (single HTML file, self-contained)
- `scripts/courtyard_skylight_v6.py` — Blender script (run in Blender Scripting tab)
- `docs/memory/courtyard-spec.md` — **READ THIS FIRST** for all courtyard dimensions
- `docs/memory/design-decisions.md` — History of design iterations and learnings
- `docs/memory/apartment-floorplan.md` — Full apartment notes (WIP)

## Architecture
- Three.js r128 via CDN (no build step needed)
- Single HTML file with inline JS and CSS
- Blender script uses bmesh for wall construction (no booleans)

## Important Context
- Courtyard is L-shaped (NOT a simple rectangle)
- East wall = 7m tall (skylight starts here)
- West wall = 2.4m + glass to 3m (skylight ends here)
- Skylight slopes linearly: Z(x) = 7.0 + (x/6.91) × (3.0 - 7.0)
- Wall thickness = 0.25m everywhere
- See `docs/memory/courtyard-spec.md` for exact coordinates

## Common Pitfalls
- Blender 4.x removed `shadow_method` from materials — don't use it
- Boolean cuts in Blender cause wall separation — use wall segments instead
- Three.js Y-axis is UP (Blender Z is up) — coordinate swap needed
- Glass needs `transparent: true` and low opacity + `DoubleSide`
