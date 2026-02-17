# Courtyard Specifications

## Footprint (L-shaped, top-down)

```
              4.55m
          _______________
    _____|               |      SOUTH wall
   |                     |
   |    4.09m   upper    |
   |                     |___
   |                         |  1.73m bump-out
   |    7.11m   lower        |  3.20m tall bump
   |                         |
   |_________________________|
              NORTH wall
```

## Orientation (schematic → real world)
- Left of schematic = **EAST** (7m tall, primary wall, skylight starts)
- Right of schematic = **WEST** (2.4m short, skylight ends)
- Top of schematic = **SOUTH** (4.55m wide)
- Bottom of schematic = **NORTH**

## Wall Heights
- **East wall**: 7.0m (tallest, building wall)
- **West, North, South walls**: 2.4m solid + 0.6m glass strip = 3.0m total
- **Wall thickness**: 0.25m throughout

## Footprint Coordinates (origin = bottom-left, X right, Y up)
```
P0 = (0, 0)         — bottom-left (east lower, north end)
P1 = (0, 7.11)      — east wall step bottom
P2 = (0.63, 7.11)   — step corner (indent goes right)
P3 = (0.63, 11.20)  — upper-left (south-east, indented)
P4 = (5.18, 11.20)  — upper-right (south-west) [0.63 + 4.55]
P5 = (5.18, 3.20)   — west wall where bump starts
P6 = (6.91, 3.20)   — bump outer corner [5.18 + 1.73]
P7 = (6.91, 0)      — bottom-right (north-west with bump)
```

## Key Dimensions
- **Total east wall length**: 11.20m (4.09m upper + 7.11m lower)
- **Upper indent**: 0.63m (upper east wall is 0.63m to the right of lower)
- **South wall width**: 4.55m
- **West wall main section**: 8.00m (from south to bump)
- **Bump-out**: 1.73m wide × 3.20m tall
- **North wall total width**: 6.91m

## Door
- **Location**: Lower east wall (X=0), 7.11m section
- **Width**: 1.8m
- **Height**: 2.1m
- **Center position**: Y = 3.2m (middle-ish, closer to north/bottom)

## Skylight
- **Type**: Sloped glass roof
- **High end**: East wall top at 7.0m
- **Low end**: West walls at 3.0m (glass strip top)
- **Slope formula**: Z(x) = 7.0 + (x / 6.91) × (3.0 - 7.0)
- **Steel frame**: ~11 lateral beams × 6 longitudinal beams
- **Triangular glass fills**: North and south sides (fill gap between wall top and slope)

## Glass Walls
- West, North, South walls: solid 0–2.4m, glass strip 2.4m–3.0m
- Bump-out walls: same glass strip treatment
