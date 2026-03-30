import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Scene ──────────────────────────────────────────────────────────────────
const container = document.getElementById('canvas-container');
const loadingEl = document.getElementById('loading');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 3.2;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

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
controls.rotateSpeed = 0.5;
controls.zoomSpeed = 0.7;
controls.minDistance = 0.5;
controls.maxDistance = 20;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.06;
controls.enablePan = false;

// ── Lighting ───────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xffffff, 2.8);
scene.add(ambient);

const rimLight = new THREE.DirectionalLight(0x88aacc, 9.0);
rimLight.position.set(-3, 2, -4);
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0x445566, 4.5);
fillLight.position.set(4, -1, 3);
scene.add(fillLight);

const keyLight = new THREE.DirectionalLight(0xaabbdd, 6.5);
keyLight.position.set(0, 3, 5);
scene.add(keyLight);

// Extra back rim to silhouette the creature from all distances
const backRim = new THREE.DirectionalLight(0x6677aa, 5.0);
backRim.position.set(2, -2, -5);
scene.add(backRim);

// ── Breathing / presence state ─────────────────────────────────────────────
// Holds the live model once loaded, for scale animation.
let breathingModel     = null;
let breathingBaseScale = 1;

const BREATH_FREQUENCY     = 13;    // time-multiplier → ≈ 10 s cycle at 60 fps
                                    // period = 2π / (13 × 0.0008 × 60) ≈ 10 s
const BREATH_SCALE_AMP     = 0.006; // ±0.6 % scale – subliminal presence cue
const BREATH_EXPOSURE_BASE = 3.2;
const BREATH_EXPOSURE_AMP  = 0.04;  // ±0.04 exposure – subliminal light variation
// 0.61 ≈ inverse golden ratio: keeps exposure and scale out of harmonic sync
const BREATH_EXPOSURE_FREQ = BREATH_FREQUENCY * 0.61;

// ── Slow organic drift ─────────────────────────────────────────────────────
const SWAY_AMPLITUDE_Y  = 0.18;  // vertical displacement
const SWAY_AMPLITUDE_X  = 0.08;  // lateral displacement
const SWAY_FREQUENCY_Y  = 0.7;   // Y oscillation (rad / time-unit)
const SWAY_FREQUENCY_X  = 0.4;   // X oscillation – different rate for organic feel
const SWAY_DAMPING      = 0.01;  // lerp factor toward target sway position

let time = 0;

// ── Animate (start immediately so background renders while model loads) ────
function animate() {
  requestAnimationFrame(animate);
  time += 0.0008;

  // Gentle camera sway
  camera.position.y += (Math.sin(time * SWAY_FREQUENCY_Y) * SWAY_AMPLITUDE_Y - camera.position.y) * SWAY_DAMPING;
  camera.position.x += (Math.sin(time * SWAY_FREQUENCY_X) * SWAY_AMPLITUDE_X - camera.position.x) * SWAY_DAMPING;

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

// ── Fade-in ────────────────────────────────────────────────────────────────
function fadeIn() {
  loadingEl.classList.add('hidden');
  container.classList.add('visible');
}

// ── Wait for MeshoptDecoder WASM, then load model ──────────────────────────
await MeshoptDecoder.ready;

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

    breathingModel     = model;
    breathingBaseScale = model.scale.x;

    fadeIn();
  },
  undefined,
  (error) => {
    console.error('GLB loading error:', error);
    loadingEl.textContent = 'Erreur de chargement';
  }
);
