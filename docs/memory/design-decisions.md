# Design Decisions & History

## Project Timeline

### Phase 1: Initial Schematic Analysis
- User provided a floor plan schematic with dimensions
- Identified the courtyard as an enclosed space to be covered with skylight glass
- Key challenge: understanding the exact L-shaped footprint from 2D schematic

### Phase 2: Blender 3D Model
- Started with SketchUp approach — abandoned (requires paid license)
- Switched to **Blender** with Python scripting
- v1-v3: Simple rectangle, walls disconnected, wrong boolean cuts
- v4: Walls built with bmesh, proper connections, but wrong footprint shape
- v5: Attempted L-shape but got the indent direction wrong
- **v6 (FINAL)**: Correct L-shape with upper-left indent and bottom-right bump-out

### Phase 3: Three.js Interactive Designer
- Built browser-based 3D walkable environment
- Features: orbit/walk/top views, furniture placement, material picker, sun control

## Key Learnings
- Blender `shadow_method` removed in newer versions — don't use
- Blender `blend_method = 'BLEND'` needed for transparency in EEVEE
- Boolean cuts in Blender cause wall separation — better to build wall segments directly
- The schematic orientation was non-obvious: left=east, right=west, top=south, bottom=north

## Architecture Decisions
- **Wall construction**: Individual segments with bmesh, not boolean cuts
- **Glass transparency**: alpha=0.15 for skylight, 0.2 for glass walls
- **Steel frame**: 0.04m wide × 0.06m deep beams
- **Slope calculation**: Linear interpolation from east (7m) to west (3m)

## Real-World Context (from photos)
- Walls are cream/beige plaster with some wood-panel cladding sections
- Currently has checkered grass+stone tile flooring (lower section) and full artificial grass (upper)
- String lights across the space
- Existing steel frame partially installed over upper section
- Surrounding building walls step up at different levels
- Located in Riyadh, Saudi Arabia (hot climate — skylight needs UV/heat consideration)
