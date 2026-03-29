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
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  1000
);
camera.position.set(0, 0, 3.5);

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
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
keyLight.position.set(2, 3, 5);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x88aacc, 1.2);
rimLight.position.set(-3, 2, -4);
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0x99aabb, 0.6);
fillLight.position.set(4, -1, 3);
scene.add(fillLight);

// ── Breathing / presence state ─────────────────────────────────────────────
// Holds the live model (or fallback mesh) once loaded, for scale animation.
let breathingModel     = null;
let breathingBaseScale = 1;

const BREATH_FREQUENCY     = 13;    // time-multiplier → ≈ 10 s cycle at 60 fps
                                    // period = 2π / (13 × 0.0008 × 60) ≈ 10 s
const BREATH_SCALE_AMP     = 0.006; // ±0.6 % scale – subliminal presence cue
const BREATH_EXPOSURE_BASE = 1.2;
const BREATH_EXPOSURE_AMP  = 0.04;  // ±0.04 exposure – subliminal light variation
// 0.61 ≈ inverse golden ratio: keeps exposure and scale out of harmonic sync
const BREATH_EXPOSURE_FREQ = BREATH_FREQUENCY * 0.61;

// ── Load model ─────────────────────────────────────────────────────────────
const loader = new GLTFLoader();
loader.load(
  'embryon404_cable_texture-v1.glb',
  (gltf) => {
    const model = gltf.scene;

    // Center and normalize scale
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim;

    // Apply scale first, then recompute center so the offset is correct
    model.scale.setScalar(scale);
    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = scaledBox.getCenter(new THREE.Vector3());
    model.position.sub(center);
    scene.add(model);

    breathingModel     = model;
    breathingBaseScale = scale;

    // Fit camera – pull back for a clear view of the full model
    controls.target.set(0, 0, 0);
    camera.position.set(0, 0, 3.5);
    controls.update();

    fadeIn();
  },
  undefined,
  () => {
    // Model failed to load – fade in the empty dark scene rather than
    // showing a placeholder that could be mistaken for the real content.
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
