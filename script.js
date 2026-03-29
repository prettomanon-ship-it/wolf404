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
camera.position.set(0, 0, 2);

// ── Controls ───────────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.04;
controls.rotateSpeed = 0.5;
controls.zoomSpeed = 0.7;
controls.minDistance = 0.5;
controls.maxDistance = 20;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.06;
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

// ── Breathing / presence state ─────────────────────────────────────────────
// Holds the live model (or fallback mesh) once loaded, for scale animation.
let breathingModel     = null;
let breathingBaseScale = 1;

const BREATH_FREQUENCY     = 13;    // time-multiplier → ≈ 10 s cycle at 60 fps
                                    // period = 2π / (13 × 0.0008 × 60) ≈ 10 s
const BREATH_SCALE_AMP     = 0.006; // ±0.6 % scale – subliminal presence cue
const BREATH_EXPOSURE_BASE = 0.6;
const BREATH_EXPOSURE_AMP  = 0.04;  // ±0.04 exposure – subliminal light variation
// 0.61 ≈ inverse golden ratio: keeps exposure and scale out of harmonic sync
const BREATH_EXPOSURE_FREQ = BREATH_FREQUENCY * 0.61;

// ── Load model ─────────────────────────────────────────────────────────────
const loader = new GLTFLoader();
loader.load(
  'model.glb',
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

    breathingModel     = model;
    breathingBaseScale = scale;

    // Fit camera – pull in closer for a more intimate view
    controls.target.set(0, 0, 0);
    camera.position.set(0, 0, 2);
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

    breathingModel     = mesh;
    breathingBaseScale = 0.8; // matches SphereGeometry radius
    fadeIn();
  }
);

// ── Fade-in ────────────────────────────────────────────────────────────────
function fadeIn() {
  container.classList.add('visible');
}

// ── Slow organic drift ─────────────────────────────────────────────────────
const SWAY_AMPLITUDE_Y  = 0.18;  // vertical displacement
const SWAY_AMPLITUDE_X  = 0.08;  // lateral displacement
const SWAY_FREQUENCY_Y  = 0.7;   // Y oscillation (rad / time-unit)
const SWAY_FREQUENCY_X  = 0.4;   // X oscillation – different rate for organic feel

let time = 0;
function animate() {
  requestAnimationFrame(animate);
  time += 0.0008;

  // Gentle multi-axis camera drift – gives a "floating in the void" feel
  camera.position.y = Math.sin(time * SWAY_FREQUENCY_Y) * SWAY_AMPLITUDE_Y;
  camera.position.x = Math.sin(time * SWAY_FREQUENCY_X) * SWAY_AMPLITUDE_X;

  // Micro "breathing" – imperceptible scale pulse
  if (breathingModel) {
    breathingModel.scale.setScalar(
      breathingBaseScale * (1 + Math.sin(time * BREATH_FREQUENCY) * BREATH_SCALE_AMP)
    );
  }

  // Subtle exposure drift – almost invisible light variation
  renderer.toneMappingExposure =
    BREATH_EXPOSURE_BASE + Math.sin(time * BREATH_EXPOSURE_FREQ) * BREATH_EXPOSURE_AMP;

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
