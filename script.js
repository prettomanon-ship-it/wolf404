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
renderer.toneMappingExposure = 0.6;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  1000
);
camera.position.set(0, 0, 4);

// ── Controls ───────────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.04;
controls.rotateSpeed = 0.5;
controls.zoomSpeed = 0.7;
controls.minDistance = 0.5;
controls.maxDistance = 20;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.enablePan = false;

// ── Lighting ───────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xffffff, 0.15);
scene.add(ambient);

const rimLight = new THREE.DirectionalLight(0x88aacc, 0.9);
rimLight.position.set(-3, 2, -4);
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0x332211, 0.5);
fillLight.position.set(4, -1, 3);
scene.add(fillLight);

// ── Load model ─────────────────────────────────────────────────────────────
const loader = new GLTFLoader();
loader.load(
  'embryon404_cable_texture-v1.glb',
  (gltf) => {
    const model = gltf.scene;

    // Center and normalize scale
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim;

    model.position.sub(center);
    model.scale.setScalar(scale);
    scene.add(model);

    // Fit camera
    controls.target.set(0, 0, 0);
    camera.position.set(0, 0, 3);
    controls.update();

    fadeIn();
  },
  undefined,
  () => {
    // Model not found – still show the empty scene with a soft sphere stand-in
    const geo = new THREE.SphereGeometry(0.8, 48, 48);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.9,
      metalness: 0.1,
      wireframe: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    fadeIn();
  }
);

// ── Fade-in ────────────────────────────────────────────────────────────────
function fadeIn() {
  container.classList.add('visible');
  document.getElementById('hint').classList.add('visible');
}

// ── Slow organic drift ─────────────────────────────────────────────────────
const SWAY_FREQUENCY = 0.4;   // oscillation speed (rad/s equivalent)
const SWAY_AMPLITUDE = 0.12;  // vertical displacement in world units

let time = 0;
function animate() {
  requestAnimationFrame(animate);
  time += 0.003;

  // Gentle camera sway when auto-rotating
  camera.position.y = Math.sin(time * SWAY_FREQUENCY) * SWAY_AMPLITUDE;

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
