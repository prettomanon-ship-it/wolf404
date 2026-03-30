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
renderer.toneMappingExposure = 2.5;
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
// Ambient toned down so the original texture is no longer drowned in blue
const ambient = new THREE.AmbientLight(0x111828, 1.2);
scene.add(ambient);

// Rim stays blue for the holographic silhouette, just less overpowering
const rimLight = new THREE.DirectionalLight(0x3366ff, 2.5);
rimLight.position.set(-3, 2, -4);
scene.add(rimLight);

// Fill shifted to neutral grey-blue so texture detail is visible
const fillLight = new THREE.DirectionalLight(0x556677, 2.0);
fillLight.position.set(4, -1, 3);
scene.add(fillLight);

// Key light made more neutral to reveal surface texture
const keyLight = new THREE.DirectionalLight(0x7799bb, 2.2);
keyLight.position.set(0, 3, 5);
scene.add(keyLight);

// Extra back rim to silhouette the creature from all distances
const backRim = new THREE.DirectionalLight(0x112255, 1.2);
backRim.position.set(2, -2, -5);
scene.add(backRim);

// ── Breathing / presence state ─────────────────────────────────────────────
// Holds the live model once loaded, for scale animation.
let breathingModel     = null;
let breathingBaseScale = 1;
let breathingBasePos   = null; // base position for glitch jitter

const BREATH_FREQUENCY     = 13;    // time-multiplier → ≈ 10 s cycle at 60 fps
                                    // period = 2π / (13 × 0.0008 × 60) ≈ 10 s
const BREATH_SCALE_AMP     = 0.006; // ±0.6 % scale – subliminal presence cue
const BREATH_EXPOSURE_BASE = 2.5;
const BREATH_EXPOSURE_AMP  = 0.06;  // ±0.06 exposure – subliminal light variation
// 0.61 ≈ inverse golden ratio: keeps exposure and scale out of harmonic sync
const BREATH_EXPOSURE_FREQ = BREATH_FREQUENCY * 0.61;

// ── Glitch / hologram anomaly ──────────────────────────────────────────────
// Simulates a degraded hologram that crackles, flickers, and jolts.
const GLITCH_INTERVAL_MIN      = 1.5;   // min quiet seconds between bursts
const GLITCH_INTERVAL_MAX      = 5.0;   // max quiet seconds between bursts
const GLITCH_BURST_MIN         = 0.10;  // min burst duration  (s)
const GLITCH_BURST_MAX         = 0.40;  // max burst duration  (s)
const GLITCH_INVISIBLE_CHANCE  = 0.65;  // probability of near-invisible frame
const GLITCH_INVISIBLE_MAX     = 0.05;  // max opacity during near-invisible flash
const GLITCH_VISIBLE_MIN       = 0.50;  // min opacity during mostly-visible frame
const GLITCH_VISIBLE_RANGE     = 0.50;  // opacity range above GLITCH_VISIBLE_MIN
const GLITCH_JITTER_X_AMP      = 0.15;  // X positional jolt amplitude (scene units)
const GLITCH_JITTER_Y_AMP      = 0.06;  // Y positional jolt amplitude (scene units)
const GLITCH_EXPOSURE_CHANCE   = 0.50;  // probability of exposure spike per frame
const GLITCH_EXPOSURE_RANGE    = 1.5;   // total range of exposure spike variation
const GLITCH_EXPOSURE_OFFSET   = 0.3;   // negative bias so spikes can go below base
const GLITCH_FILTER_CHANCE     = 0.55;  // probability of hue/brightness anomaly per frame
const GLITCH_HUE_RANGE         = 60;    // ±hue-rotate degrees during anomaly
const GLITCH_BRIGHTNESS_MIN    = 0.10;  // min brightness multiplier during anomaly
const GLITCH_BRIGHTNESS_RANGE  = 2.0;   // brightness range above GLITCH_BRIGHTNESS_MIN
const GLITCH_VANISH_CHANCE     = 0.30;  // probability of full model disappear per frame
const GLITCH_TRANSLATE_X_AMP   = 14;    // max CSS translateX offset (px) during burst
const DEFAULT_FRAME_TIME       = 0.016; // assumed dt (s) for the very first frame

let glitchClock     = 0;           // accumulated real-time seconds
let glitchNextBurst = 3.0;         // first glitch fires ~3 s after load
let glitchBurstEnd  = 0;
let glitchBurstOn   = false;
let glitchJitterX   = 0;
let glitchJitterY   = 0;
const glitchMats    = [];          // cached transparent materials on the model

function collectGlitchMaterials(root) {
  root.traverse(child => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach(m => {
      m.transparent = true;
      m.depthWrite  = false;
      m.needsUpdate = true;
      if (!glitchMats.includes(m)) glitchMats.push(m);
    });
  });
}

function setGlitchOpacity(v) {
  glitchMats.forEach(m => { m.opacity = v; });
}

function scheduleGlitch() {
  glitchNextBurst = glitchClock
    + GLITCH_INTERVAL_MIN
    + Math.random() * (GLITCH_INTERVAL_MAX - GLITCH_INTERVAL_MIN);
}

function tickGlitch(dt) {
  glitchClock += dt;

  if (!glitchBurstOn) {
    if (glitchClock >= glitchNextBurst) {
      // Start a new burst
      glitchBurstOn = true;
      glitchBurstEnd = glitchClock
        + GLITCH_BURST_MIN
        + Math.random() * (GLITCH_BURST_MAX - GLITCH_BURST_MIN);
    } else {
      // Idle – restore clean state
      setGlitchOpacity(1.0);
      if (breathingModel) breathingModel.visible = true;
      glitchJitterX = 0;
      glitchJitterY = 0;
      container.style.filter    = '';
      container.style.transform = '';
      return;
    }
  }

  if (glitchClock >= glitchBurstEnd) {
    // End burst
    glitchBurstOn = false;
    setGlitchOpacity(1.0);
    if (breathingModel) breathingModel.visible = true;
    glitchJitterX = 0;
    glitchJitterY = 0;
    container.style.filter    = '';
    container.style.transform = '';
    scheduleGlitch();
    return;
  }

  // ── Active burst: rapid stutter flickering ─────────────────────────────
  // Full vanish – model disappears entirely like a corrupted file
  if (Math.random() < GLITCH_VANISH_CHANCE) {
    if (breathingModel) breathingModel.visible = false;
    setGlitchOpacity(0);
  } else {
    if (breathingModel) breathingModel.visible = true;
    // Opacity: mostly near-invisible or flickering, rarely mid-range
    const opv = Math.random() < GLITCH_INVISIBLE_CHANCE
      ? Math.random() * GLITCH_INVISIBLE_MAX                         // near-invisible flash
      : GLITCH_VISIBLE_MIN + Math.random() * GLITCH_VISIBLE_RANGE;   // flickering frame
    setGlitchOpacity(opv);
  }

  // Small positional jolt
  glitchJitterX = (Math.random() - 0.5) * GLITCH_JITTER_X_AMP;
  glitchJitterY = (Math.random() - 0.5) * GLITCH_JITTER_Y_AMP;

  // CSS scan-line displacement (horizontal shift of the whole canvas)
  if (Math.random() < 0.4) {
    const tx = ((Math.random() - 0.5) * GLITCH_TRANSLATE_X_AMP * 2).toFixed(1);
    container.style.transform = `translateX(${tx}px)`;
  } else {
    container.style.transform = '';
  }

  // Occasional exposure spike + hue/brightness/saturation anomaly
  if (Math.random() < GLITCH_EXPOSURE_CHANCE) {
    renderer.toneMappingExposure =
      BREATH_EXPOSURE_BASE + (Math.random() * GLITCH_EXPOSURE_RANGE - GLITCH_EXPOSURE_OFFSET);
  }
  if (Math.random() < GLITCH_FILTER_CHANCE) {
    const hue = ((Math.random() - 0.5) * GLITCH_HUE_RANGE).toFixed(1);
    const bri = (GLITCH_BRIGHTNESS_MIN + Math.random() * GLITCH_BRIGHTNESS_RANGE).toFixed(2);
    const sat = (Math.random() * 2.5).toFixed(2);
    container.style.filter = `hue-rotate(${hue}deg) brightness(${bri}) saturate(${sat})`;
  } else {
    container.style.filter = '';
  }
}

// ── Slow organic drift ─────────────────────────────────────────────────────
const SWAY_AMPLITUDE_Y  = 0.18;  // vertical displacement
const SWAY_AMPLITUDE_X  = 0.08;  // lateral displacement
const SWAY_FREQUENCY_Y  = 0.7;   // Y oscillation (rad / time-unit)
const SWAY_FREQUENCY_X  = 0.4;   // X oscillation – different rate for organic feel
const SWAY_DAMPING      = 0.01;  // lerp factor toward target sway position

let time = 0;
let lastTimestamp = 0;

// ── Animate (start immediately so background renders while model loads) ────
function animate(timestamp) {
  requestAnimationFrame(animate);
  const dt = lastTimestamp === 0 ? DEFAULT_FRAME_TIME : Math.min((timestamp - lastTimestamp) / 1000, 0.1);
  lastTimestamp = timestamp;
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

  // Subtle exposure drift – almost invisible light variation (overridden during glitches)
  if (!glitchBurstOn) {
    renderer.toneMappingExposure =
      BREATH_EXPOSURE_BASE + Math.sin(time * BREATH_EXPOSURE_FREQ) * BREATH_EXPOSURE_AMP;
  }

  // Glitch / hologram anomaly tick
  tickGlitch(dt);

  // Apply glitch jitter to model position
  if (breathingModel && breathingBasePos) {
    breathingModel.position.x = breathingBasePos.x + glitchJitterX;
    breathingModel.position.y = breathingBasePos.y + glitchJitterY;
  }

  controls.update();
  renderer.render(scene, camera);
}
animate(0);

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
    breathingBasePos   = model.position.clone();
    collectGlitchMaterials(model);

    fadeIn();
  },
  undefined,
  (error) => {
    console.error('GLB loading error:', error);
    loadingEl.textContent = 'Erreur de chargement';
  }
);
