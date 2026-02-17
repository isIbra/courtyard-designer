"""
Blender Script - Courtyard with Sloped Skylight v6
Correct shape: upper-left indent, bottom-right bump-out
East wall 7m tall | West wall 2.4m | Sloped glass roof
"""
import bpy, bmesh, math

# ============ CLEANUP ============
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for m in bpy.data.meshes: bpy.data.meshes.remove(m)
for m in bpy.data.materials: bpy.data.materials.remove(m)

# ============ PARAMS ============
WT = 0.25
EAST_H = 7.0
WEST_H = 2.4
GLASS_RISE = 3.0
DOOR_W = 1.8
DOOR_H = 2.1

# ============ FOOTPRINT ============
P = [
    (0, 0),
    (0, 7.11),
    (0.63, 7.11),
    (0.63, 11.20),
    (0.63 + 4.55, 11.20),
    (5.18, 3.20),
    (5.18 + 1.73, 3.20),
    (6.91, 0),
]

DOOR_Y_CENTER = 3.2
DOOR_Y_BOT = DOOR_Y_CENTER - DOOR_W/2
DOOR_Y_TOP = DOOR_Y_CENTER + DOOR_W/2

# ============ MATERIALS ============
def make_mat(name, color, alpha=1.0, rough=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get("Principled BSDF")
    if bs:
        bs.inputs['Base Color'].default_value = (*color, 1)
        bs.inputs['Roughness'].default_value = rough
        if alpha < 1:
            bs.inputs['Alpha'].default_value = alpha
            mat.blend_method = 'BLEND'
    return mat

wall_m = make_mat("Walls", (0.92, 0.88, 0.78), rough=0.85)
floor_m = make_mat("Floor", (0.65, 0.62, 0.55), rough=0.7)
glass_m = make_mat("Glass", (0.75, 0.9, 1.0), alpha=0.15, rough=0.02)
frame_m = make_mat("Steel", (0.2, 0.2, 0.2), rough=0.3)
glass_wall_m = make_mat("Glass_Wall", (0.7, 0.85, 0.95), alpha=0.2, rough=0.02)

# ============ HELPERS ============
def make_mesh_obj(name, verts_list, faces_list, material):
    mesh = bpy.data.meshes.new(name + "_mesh")
    bm = bmesh.new()
    verts = [bm.verts.new(v) for v in verts_list]
    for f in faces_list:
        bm.faces.new([verts[i] for i in f])
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj

def wall_segment(name, x1, y1, x2, y2, z_bot, z_top, tdx, tdy, mat):
    make_mesh_obj(name, [
        (x1, y1, z_bot), (x2, y2, z_bot), (x2+tdx, y2+tdy, z_bot), (x1+tdx, y1+tdy, z_bot),
        (x1, y1, z_top), (x2, y2, z_top), (x2+tdx, y2+tdy, z_top), (x1+tdx, y1+tdy, z_top),
    ], [
        [0,1,2,3], [7,6,5,4],
        [0,4,5,1], [2,6,7,3],
        [0,3,7,4], [1,5,6,2],
    ], mat)

# ============ FLOOR ============
make_mesh_obj("Floor", [
    (P[0][0], P[0][1], 0),
    (P[1][0], P[1][1], 0),
    (P[2][0], P[2][1], 0),
    (P[3][0], P[3][1], 0),
    (P[4][0], P[4][1], 0),
    (P[5][0], P[5][1], 0),
    (P[6][0], P[6][1], 0),
    (P[7][0], P[7][1], 0),
], [[0,1,2,3,4,5,6,7]], floor_m)

# ============ WALLS ============
wall_segment("East_Low_A", 0, 0, 0, DOOR_Y_BOT, 0, EAST_H, WT, 0, wall_m)
wall_segment("East_Low_B", 0, DOOR_Y_TOP, 0, 7.11, 0, EAST_H, WT, 0, wall_m)
wall_segment("East_Lintel", 0, DOOR_Y_BOT, 0, DOOR_Y_TOP, DOOR_H, EAST_H, WT, 0, wall_m)
wall_segment("Step_H", 0, 7.11, 0.63, 7.11, 0, EAST_H, 0, -WT, wall_m)
wall_segment("East_Upper", 0.63, 7.11, 0.63, 11.20, 0, EAST_H, -WT, 0, wall_m)
wall_segment("South_Solid", 0.63, 11.20, 5.18, 11.20, 0, WEST_H, 0, -WT, wall_m)
wall_segment("South_Glass", 0.63, 11.20, 5.18, 11.20, WEST_H, GLASS_RISE, 0, -WT, glass_wall_m)
wall_segment("West_Upper_Solid", 5.18, 3.20, 5.18, 11.20, 0, WEST_H, -WT, 0, wall_m)
wall_segment("West_Upper_Glass", 5.18, 3.20, 5.18, 11.20, WEST_H, GLASS_RISE, -WT, 0, glass_wall_m)
wall_segment("Bump_Top_Solid", 5.18, 3.20, 6.91, 3.20, 0, WEST_H, 0, -WT, wall_m)
wall_segment("Bump_Top_Glass", 5.18, 3.20, 6.91, 3.20, WEST_H, GLASS_RISE, 0, -WT, glass_wall_m)
wall_segment("Bump_Right_Solid", 6.91, 0, 6.91, 3.20, 0, WEST_H, -WT, 0, wall_m)
wall_segment("Bump_Right_Glass", 6.91, 0, 6.91, 3.20, WEST_H, GLASS_RISE, -WT, 0, glass_wall_m)
wall_segment("North_Solid", 0, 0, 6.91, 0, 0, WEST_H, 0, WT, wall_m)
wall_segment("North_Glass", 0, 0, 6.91, 0, WEST_H, GLASS_RISE, 0, WT, glass_wall_m)

# ============ SLOPED SKYLIGHT ============
def slope_z(x):
    max_x = 6.91
    t = x / max_x
    return EAST_H + t * (GLASS_RISE - EAST_H)

make_mesh_obj("Sky_Upper", [
    (0.63-WT, 7.11, slope_z(0.63-WT)),
    (5.18-WT, 7.11, slope_z(5.18-WT)),
    (5.18-WT, 11.20-WT, slope_z(5.18-WT)),
    (0.63-WT, 11.20-WT, slope_z(0.63-WT)),
], [[0,1,2,3]], glass_m)

make_mesh_obj("Sky_Low_Top", [
    (WT, 3.20, slope_z(WT)),
    (5.18-WT, 3.20, slope_z(5.18-WT)),
    (5.18-WT, 7.11, slope_z(5.18-WT)),
    (WT, 7.11, slope_z(WT)),
], [[0,1,2,3]], glass_m)

make_mesh_obj("Sky_Low_Bot", [
    (WT, WT, slope_z(WT)),
    (6.91-WT, WT, slope_z(6.91-WT)),
    (6.91-WT, 3.20, slope_z(6.91-WT)),
    (WT, 3.20, slope_z(WT)),
], [[0,1,2,3]], glass_m)

# ============ TRIANGULAR GLASS FILLS ============
make_mesh_obj("South_Tri", [
    (0.63, 11.20, GLASS_RISE),
    (5.18, 11.20, GLASS_RISE),
    (0.63, 11.20, slope_z(0.63)),
    (0.63, 11.20-WT, GLASS_RISE),
    (5.18, 11.20-WT, GLASS_RISE),
    (0.63, 11.20-WT, slope_z(0.63)),
], [
    [0,1,2], [4,3,5],
    [0,3,4,1], [1,4,5,2], [0,2,5,3],
], glass_wall_m)

make_mesh_obj("North_Tri", [
    (0, 0, GLASS_RISE),
    (6.91, 0, GLASS_RISE),
    (0, 0, slope_z(0)),
    (0, WT, GLASS_RISE),
    (6.91, WT, GLASS_RISE),
    (0, WT, slope_z(0)),
], [
    [0,1,2], [4,3,5],
    [0,3,4,1], [1,4,5,2], [0,2,5,3],
], glass_wall_m)

# ============ STEEL FRAME ============
bw = 0.04
bh = 0.06

beam_ys = [y * 11.20/12 for y in range(1, 12)]
for i, y in enumerate(beam_ys):
    if y < 3.20:
        x_e = WT
        x_w = 6.91 - WT
    elif y < 7.11:
        x_e = WT
        x_w = 5.18 - WT
    else:
        x_e = 0.63 - WT
        x_w = 5.18 - WT
    z_e = slope_z(x_e)
    z_w = slope_z(x_w)
    make_mesh_obj(f"FX_{i}", [
        (x_e, y-bw/2, z_e), (x_w, y-bw/2, z_w),
        (x_w, y+bw/2, z_w), (x_e, y+bw/2, z_e),
        (x_e, y-bw/2, z_e+bh), (x_w, y-bw/2, z_w+bh),
        (x_w, y+bw/2, z_w+bh), (x_e, y+bw/2, z_e+bh),
    ], [
        [0,1,2,3], [7,6,5,4],
        [0,4,5,1], [2,6,7,3],
        [0,3,7,4], [1,5,6,2],
    ], frame_m)

beam_xs = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]
for i, x in enumerate(beam_xs):
    z = slope_z(x)
    if x < 0.63:
        y_start = WT
        y_end = 11.20 - WT
    elif x < 5.18:
        y_start = WT
        y_end = 11.20 - WT
    elif x < 6.91:
        y_start = WT
        y_end = 3.20
    else:
        continue
    make_mesh_obj(f"FY_{i}", [
        (x-bw/2, y_start, z), (x+bw/2, y_start, z),
        (x+bw/2, y_end, z), (x-bw/2, y_end, z),
        (x-bw/2, y_start, z+bh), (x+bw/2, y_start, z+bh),
        (x+bw/2, y_end, z+bh), (x-bw/2, y_end, z+bh),
    ], [
        [0,1,2,3], [7,6,5,4],
        [0,4,5,1], [2,6,7,3],
        [0,3,7,4], [1,5,6,2],
    ], frame_m)

# ============ LIGHTING ============
bpy.ops.object.light_add(type='SUN', location=(3, 6, 14))
s = bpy.context.active_object
s.name = "Sun"
s.data.energy = 4.0
s.rotation_euler = (math.radians(40), math.radians(-15), 0)

bpy.ops.object.light_add(type='AREA', location=(3, 6, 4))
a = bpy.context.active_object
a.name = "Fill"
a.data.energy = 120
a.data.size = 6.0

# ============ CAMERAS ============
bpy.ops.object.camera_add(
    location=(-6, -4, 12),
    rotation=(math.radians(55), 0, math.radians(-25))
)
bpy.context.active_object.name = "Cam_Exterior"
bpy.context.scene.camera = bpy.context.active_object

bpy.ops.object.camera_add(
    location=(3, 2, 1.6),
    rotation=(math.radians(72), 0, 0)
)
bpy.context.active_object.name = "Cam_Interior"

bpy.ops.object.camera_add(
    location=(3, 6, 1.2),
    rotation=(math.radians(20), 0, math.radians(-90))
)
bpy.context.active_object.name = "Cam_LookUp"

# ============ RENDER ============
bpy.context.scene.render.engine = 'CYCLES'
bpy.context.scene.cycles.samples = 128
bpy.context.scene.render.resolution_x = 1920
bpy.context.scene.render.resolution_y = 1080

for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        for space in area.spaces:
            if space.type == 'VIEW_3D':
                space.shading.type = 'MATERIAL'

print("=" * 50)
print("COURTYARD v6 - CORRECT SHAPE")
print("=" * 50)
print("Upper-left indent (0.63m), bottom-right bump (1.73x3.20)")
print("East wall 7m, West wall 2.4m+glass, Sloped skylight")
print("Door on lower east wall")
print("Numpad 0 = exterior cam")
