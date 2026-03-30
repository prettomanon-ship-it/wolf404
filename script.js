import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Scene ──────────────────────────────────────────────────────────────────
const container = document.getElementById('canvas-container');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.LinearToneMapping;
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x333333);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  1000
);

// ── Controls ───────────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.04;

// ── Lighting ───────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

// ── Load model ─────────────────────────────────────────────────────────────
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
console.log('starting GLB load');
loader.load(
  'embryon404_cable_texture-v1.glb',
  (gltf) => {
    console.log('GLB loaded successfully', gltf);
    const model = gltf.scene;
    scene.add(model);
    console.log('GLB added to scene');

    // Compute bounding box and frame camera to show entire model
    const FRAME_PADDING = 1.5; // extra multiplier so model isn't clipped at edges
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1; // guard against degenerate/empty models
    const fov = camera.fov * (Math.PI / 180);
    const cameraDistance = (maxDim / 2) / Math.tan(fov / 2) * FRAME_PADDING;

    camera.position.set(center.x, center.y, center.z + cameraDistance);
    camera.near = Math.max(cameraDistance / 100, 0.001);
    camera.far = cameraDistance * 100;
    camera.updateProjectionMatrix();

    controls.target.copy(center);
    controls.update();
  },
  undefined,
  (error) => {
    console.error('GLB loading error:', error);
  }
);

// ── Animate ────────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// ── Resize ─────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
