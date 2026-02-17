# Courtyard Designer

Interactive 3D courtyard & apartment designer built with Three.js and Blender.

## Project Overview

Designing an enclosed courtyard with a sloped skylight glass roof. The courtyard has an L-shaped footprint with:
- **East wall**: 7m tall (primary building wall, where skylight starts)
- **West wall**: 2.4m + 0.6m glass strip to 3.0m (where skylight slope ends)
- **Upper-left indent**: 0.63m
- **Bottom-right bump-out**: 1.73m × 3.20m
- **Sloped glass skylight** from east (7m) down to west (3m) with steel frame grid
- **Single door** on the lower east wall (1.8m wide)

## Files

```
├── src/
│   └── designer.html          # Three.js interactive 3D designer (walkable)
├── scripts/
│   └── courtyard_skylight_v6.py  # Blender Python script for 3D model
├── docs/
│   └── memory/
│       ├── courtyard-spec.md     # Courtyard dimensions & specifications
│       ├── design-decisions.md   # Design decisions & rationale
│       └── apartment-floorplan.md # Full apartment floor plan notes
└── README.md
```

## Three.js Designer Features

- **Orbit view** — click + drag to rotate, scroll to zoom
- **First-person walk** — WASD + mouse look
- **Top-down view** — bird's eye
- **Furniture placement** — click to add (sofa, chair, table, plants, lamp, rug, shelf, bed, desk, ottoman)
- **Material picker** — change floor, wall, and glass tint colors
- **Sun slider** — dawn to dusk lighting
- **Keyboard shortcuts**: R = rotate, Delete = remove, Tab = toggle panel, Esc = cancel

## Blender Script

Open Blender → Scripting tab → New → Paste `scripts/courtyard_skylight_v6.py` → Run (Alt+P)

Requires: Blender 3.x or 4.x

## How to Use

1. Open `src/designer.html` in any browser
2. Or run the Blender script for high-quality renders

## Next Steps

- [ ] Add full apartment floor plan to 3D model
- [ ] Load GLTF furniture models from free libraries
- [ ] Add room labels and measurements overlay
- [ ] Interior wall textures and materials
- [ ] Export layout as JSON for saving/loading
