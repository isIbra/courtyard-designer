import * as THREE from 'three';
import { scene } from './scene.js';

// Place schematic image on the ground as a reference overlay.
// The schematic shows apartment (9.10m) + courtyard (~6.91m) ≈ 16m wide × 11.20m deep.
// The image has margins — we'll adjust scale/position to align.

export function buildReference() {
  const loader = new THREE.TextureLoader();
  loader.load('/schematic.png', (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;

    // Full building = apartment + courtyard. Overlay at original scale.
    const planeW = 54.0;
    const planeD = 37.5;

    const geo = new THREE.PlaneGeometry(planeW, planeD);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(planeW / 2 - 3.0, 0.03, planeD / 2 - 1.5);
    mesh.name = 'schematic_overlay';
    scene.add(mesh);
  });
}
