/**
 * Measure bounding boxes of all Poly Haven GLB models to get w/h/d for catalog.
 * Usage: node scripts/measure-polyhaven.js
 * Output: scripts/polyhaven-dimensions.json
 */

const fs = require('fs');
const path = require('path');

// We'll use gltf-transform to read the GLBs
async function main() {
  const { NodeIO } = await import('@gltf-transform/core');
  const { KHRONOS_EXTENSIONS } = await import('@gltf-transform/extensions');

  const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);

  const dir = path.join(__dirname, '..', 'public', 'models', 'polyhaven');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

  const results = {};

  for (const [id, info] of Object.entries(manifest)) {
    const glbPath = path.join(dir, info.file);
    try {
      const doc = await io.read(glbPath);
      const root = doc.getRoot();
      const meshes = root.listMeshes();

      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

      for (const mesh of meshes) {
        for (const prim of mesh.listPrimitives()) {
          const posAccessor = prim.getAttribute('POSITION');
          if (!posAccessor) continue;
          const pos = posAccessor.getArray();
          for (let i = 0; i < pos.length; i += 3) {
            minX = Math.min(minX, pos[i]);
            maxX = Math.max(maxX, pos[i]);
            minY = Math.min(minY, pos[i + 1]);
            maxY = Math.max(maxY, pos[i + 1]);
            minZ = Math.min(minZ, pos[i + 2]);
            maxZ = Math.max(maxZ, pos[i + 2]);
          }
        }
      }

      // Also account for node transforms
      const scene = root.listScenes()[0];
      if (scene) {
        // For now, use raw mesh bounds — most Poly Haven models are at origin with unit scale
      }

      const w = Math.round((maxX - minX) * 100) / 100;
      const h = Math.round((maxY - minY) * 100) / 100;
      const d = Math.round((maxZ - minZ) * 100) / 100;

      results[id] = { w, h, d, name: info.name, categories: info.categories };
      console.log(`${id}: ${w}x${h}x${d}m  (${info.name})`);
    } catch (e) {
      console.error(`ERROR ${id}: ${e.message}`);
      results[id] = { w: 1, h: 1, d: 1, name: info.name, categories: info.categories, error: true };
    }
  }

  const outPath = path.join(__dirname, 'polyhaven-dimensions.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${Object.keys(results).length} entries to ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
