import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Scene ──────────────────────────────────────────────────────────────────
const container = document.getElementById('canvas-container');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  1000
);
camera.position.set(0, 0, 5);

// ── Controls ───────────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.04;
controls.rotateSpeed = 0.5;
controls.zoomSpeed = 0.7;
controls.minDistance = 0.5;
controls.maxDistance = 20;
controls.enablePan = false;

// ── Simple debug lighting ──────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
keyLight.position.set(5, 5, 5);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
fillLight.position.set(-5, -2, -5);
scene.add(fillLight);

// ── Load model ─────────────────────────────────────────────────────────────
const loader = new GLTFLoader();
console.log('starting GLB load');
loader.load(
  'embryon404_cable_texture-v1.glb',
  (gltf) => {
    console.log('GLB loaded successfully', gltf);
    const model = gltf.scene;

    // Center and normalize scale
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? 2 / maxDim : 1;

    model.scale.setScalar(scale);
    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = scaledBox.getCenter(new THREE.Vector3());
    model.position.sub(center);
    scene.add(model);
    console.log('GLB added to scene. Scale:', scale, 'Position:', model.position);

    controls.target.set(0, 0, 0);
    camera.position.set(0, 0, 5);
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
