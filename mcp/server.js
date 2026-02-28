/**
 * Courtyard Designer MCP Server
 * Stdio transport — connects to the Express relay via HTTP to execute commands
 * in the live browser session.
 */

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

const API_BASE = "http://localhost:3051";

// ── Helper: call the Express relay ──

async function callDesigner(method, params) {
  const res = await fetch(`${API_BASE}/api/designer/exec`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.error || "Unknown error from designer");
  }
  return data.result;
}

function textResult(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

// ── MCP Server setup ──

const server = new McpServer({
  name: "courtyard-designer",
  version: "1.0.0",
});

// ── Query tools ──

server.tool(
  "query_at_point",
  "Get all objects (walls, furniture, floors, stairs, rooms) at a specific (x, floor, z) coordinate in the 3D scene",
  {
    x: z.number().describe("X coordinate (left-right)"),
    floor: z.number().default(0).describe("Floor level (0 = ground)"),
    z: z.number().describe("Z coordinate (top-bottom in plan view)"),
  },
  async (params) => {
    const result = await callDesigner("scene.query_point", params);
    return textResult(result);
  }
);

server.tool(
  "query_box",
  "Get all objects within a bounding box region in the 3D scene",
  {
    x1: z.number().describe("Start X coordinate"),
    floor: z.number().default(0).describe("Floor level"),
    z1: z.number().describe("Start Z coordinate"),
    x2: z.number().describe("End X coordinate"),
    z2: z.number().describe("End Z coordinate"),
  },
  async (params) => {
    const result = await callDesigner("scene.query_box", params);
    return textResult(result);
  }
);

server.tool(
  "list_rooms",
  "List all rooms in the apartment with their bounds (id, name, x, z, w, d)",
  {},
  async () => {
    const result = await callDesigner("scene.list_rooms", {});
    return textResult(result);
  }
);

server.tool(
  "list_furniture",
  "List all placed furniture with meshId, catalogId, position, rotation, and dimensions",
  {
    floor: z.number().optional().describe("Filter by floor level"),
    category: z.string().optional().describe("Filter by category (bedroom, living, kitchen, bathroom, office, outdoor)"),
  },
  async (params) => {
    const result = await callDesigner("scene.list_furniture", params);
    return textResult(result);
  }
);

server.tool(
  "get_catalog",
  "Get the furniture catalog — all items available for placement (id, name, category, dimensions)",
  {
    category: z.string().optional().describe("Filter by category (bedroom, living, kitchen, bathroom, office, outdoor)"),
  },
  async (params) => {
    const result = await callDesigner("scene.get_catalog", params);
    return textResult(result);
  }
);

// ── Mutation tools ──

server.tool(
  "place_furniture",
  "Place a furniture item from the catalog at a specific position in the scene. Returns the meshId of the placed item.",
  {
    catalogId: z.string().describe("ID from the catalog (e.g. 'sofa', 'bed_double', 'dining_tbl')"),
    x: z.number().describe("X position"),
    z: z.number().describe("Z position"),
    rotY: z.number().default(0).describe("Y rotation in radians (0 = default facing)"),
    floor: z.number().default(0).describe("Floor level"),
  },
  async (params) => {
    const result = await callDesigner("furniture.place", params);
    return textResult(result);
  }
);

server.tool(
  "move_furniture",
  "Move an existing placed furniture item to a new position",
  {
    meshId: z.string().describe("The meshId of the placed furniture (from list_furniture)"),
    x: z.number().describe("New X position"),
    z: z.number().describe("New Z position"),
  },
  async (params) => {
    const result = await callDesigner("furniture.move", params);
    return textResult(result);
  }
);

server.tool(
  "remove_furniture",
  "Remove a placed furniture item from the scene",
  {
    meshId: z.string().describe("The meshId of the placed furniture (from list_furniture)"),
  },
  async (params) => {
    const result = await callDesigner("furniture.remove", params);
    return textResult(result);
  }
);

server.tool(
  "add_wall",
  "Add a wall segment. For horizontal walls: provide type='h', z, x1, x2. For vertical walls: type='v', x, z1, z2.",
  {
    type: z.enum(["h", "v"]).describe("Wall type: 'h' for horizontal, 'v' for vertical"),
    z: z.number().optional().describe("Z position (for horizontal walls)"),
    x1: z.number().optional().describe("Start X (for horizontal walls)"),
    x2: z.number().optional().describe("End X (for horizontal walls)"),
    x: z.number().optional().describe("X position (for vertical walls)"),
    z1: z.number().optional().describe("Start Z (for vertical walls)"),
    z2: z.number().optional().describe("End Z (for vertical walls)"),
    floor: z.number().default(0).describe("Floor level"),
  },
  async (params) => {
    const result = await callDesigner("wall.add", params);
    return textResult(result);
  }
);

server.tool(
  "remove_wall",
  "Remove a wall segment by its ID",
  {
    wallId: z.string().describe("The wall ID (from list_walls or add_wall response)"),
  },
  async (params) => {
    const result = await callDesigner("wall.remove", params);
    return textResult(result);
  }
);

server.tool(
  "set_wall_color",
  "Change the wall color for a specific room. Accepts hex color string.",
  {
    roomId: z.string().describe("Room ID (e.g. 'living', 'bedroom', 'kitchen')"),
    hex: z.string().describe("Hex color (e.g. '#484848' for charcoal)"),
  },
  async (params) => {
    const result = await callDesigner("wall.set_color", params);
    return textResult(result);
  }
);

server.tool(
  "set_floor_texture",
  "Change the floor texture for a specific floor tile",
  {
    tileId: z.string().describe("Floor tile ID (e.g. 'ft_seed_living', 'ft_seed_kitchen')"),
    texType: z.string().describe("Texture type (e.g. 'wood_oak', 'wood_walnut', 'tile_square', 'concrete_smooth')"),
  },
  async (params) => {
    const result = await callDesigner("floor.set_texture", params);
    return textResult(result);
  }
);

server.tool(
  "scene_info",
  "Get high-level scene info: room count, wall count, furniture count, and scene bounds",
  {},
  async () => {
    const result = await callDesigner("scene.info", {});
    return textResult(result);
  }
);

server.tool(
  "get_room_at",
  "Get which room contains a specific (x, z) point. Returns room id, name, and bounds or null.",
  {
    x: z.number().describe("X coordinate"),
    z: z.number().describe("Z coordinate"),
  },
  async (params) => {
    const result = await callDesigner("scene.get_room_at", params);
    return textResult(result);
  }
);

server.tool(
  "list_walls",
  "List all wall segments with their geometry (type, position, height, thickness, floor)",
  {
    floor: z.number().optional().describe("Filter by floor level"),
  },
  async (params) => {
    const result = await callDesigner("scene.list_walls", params);
    return textResult(result);
  }
);

server.tool(
  "set_sun",
  "Set the sun/time-of-day lighting. t=0 is sunrise, t=0.5 is noon, t=1 is sunset.",
  {
    t: z.number().min(0).max(1).describe("Time of day (0=sunrise, 0.5=noon, 1=sunset)"),
  },
  async (params) => {
    const result = await callDesigner("scene.set_sun", params);
    return textResult(result);
  }
);

server.tool(
  "camera_look_at",
  "Move the camera to a position and/or point it at a target",
  {
    x: z.number().optional().describe("Camera X position"),
    y: z.number().optional().describe("Camera Y position (height)"),
    z: z.number().optional().describe("Camera Z position"),
    tx: z.number().optional().describe("Look-at target X"),
    ty: z.number().optional().describe("Look-at target Y"),
    tz: z.number().optional().describe("Look-at target Z"),
  },
  async (params) => {
    const result = await callDesigner("camera.look_at", params);
    return textResult(result);
  }
);

server.tool(
  "rotate_furniture",
  "Rotate an existing placed furniture item to a new Y rotation",
  {
    meshId: z.string().describe("The meshId of the placed furniture (from list_furniture)"),
    rotY: z.number().describe("New Y rotation in radians"),
  },
  async (params) => {
    const result = await callDesigner("furniture.rotate", params);
    return textResult(result);
  }
);

// ── Start ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP] Courtyard Designer MCP server running on stdio");
}

main().catch((err) => {
  console.error("[MCP] Fatal error:", err);
  process.exit(1);
});
