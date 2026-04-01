import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';

// NOTE: WebXR requires a secure context (HTTPS or localhost).

const instructionEl = document.getElementById( 'ar-instruction' );

// ── Renderer ────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true } );
renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.xr.enabled = true;
document.body.appendChild( renderer.domElement );

// ── AR entry button ─────────────────────────────────────────────────────────
// dom-overlay keeps the instruction banner and back-link visible in AR mode.
document.body.appendChild(
	ARButton.createButton( renderer, {
		requiredFeatures: [ 'hit-test' ],
		optionalFeatures: [ 'dom-overlay' ],
		domOverlay: { root: document.body },
	} )
);

// ── Scene ───────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();

// ── Camera ──────────────────────────────────────────────────────────────────
// WebXR replaces camera matrices at runtime; the PerspectiveCamera is still
// required but its projection is overridden by the headset/device.
const camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 100 );

// ── Lighting ─────────────────────────────────────────────────────────────────
// Neutral lights so the models look natural against the real-world background.
const ambient = new THREE.AmbientLight( 0xffffff, 2.5 );
scene.add( ambient );

const keyLight = new THREE.DirectionalLight( 0xffffff, 2.0 );
keyLight.position.set( 1, 2, 1 );
scene.add( keyLight );

const fillLight = new THREE.DirectionalLight( 0xcccccc, 1.0 );
fillLight.position.set( - 1, 0, - 1 );
scene.add( fillLight );

// ── Surface-detection reticle ────────────────────────────────────────────────
// Thin ring that tracks the hit-test result and shows where the scene will land.
const reticleGeometry = new THREE.RingGeometry( 0.1, 0.12, 32 );
reticleGeometry.rotateX( - Math.PI / 2 );
const reticle = new THREE.Mesh(
	reticleGeometry,
	new THREE.MeshBasicMaterial( { color: 0xffffff, opacity: 0.8, transparent: true } )
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add( reticle );

// ── Composition group ────────────────────────────────────────────────────────
// Mirrors the spatial layout used in the 3D view (script.js).
// A global scale factor shrinks the whole composition to a real-world size
// that fits comfortably in an indoor space (~2 m wide).
const SCENE_SCALE = 0.22;

const compositionGroup = new THREE.Group();
compositionGroup.visible = false;
compositionGroup.scale.setScalar( SCENE_SCALE );
scene.add( compositionGroup );

// Sub-groups — same positions / rotations as script.js.
const wolfGroup = new THREE.Group();
wolfGroup.position.set( - 2.3, - 0.7, 1.9 );
wolfGroup.rotation.y = 0.93;
compositionGroup.add( wolfGroup );

const floreGroup = new THREE.Group();
floreGroup.position.set( 1.3, - 0.4, 1.1 );
floreGroup.rotation.y = 4.9;
compositionGroup.add( floreGroup );

const archGroup = new THREE.Group();
archGroup.position.set( 3.4, 0, - 1.0 );
archGroup.rotation.y = - 0.55;
compositionGroup.add( archGroup );

const embryoGroup = new THREE.Group();
embryoGroup.position.set( 0.4, 0.6, - 0.3 );
compositionGroup.add( embryoGroup );

// Track how many models have finished loading so we can mark the scene ready.
let modelsLoaded = 0;
const TOTAL_MODELS = 4;
let placed = false;

function onModelLoaded() {
	modelsLoaded += 1;
	if ( modelsLoaded === TOTAL_MODELS ) {
		instructionEl.textContent = 'Point camera at a flat surface, then tap to place';
	}
}

// ── Helper: scale to target height, rest base on y = 0 (local space) ────────
function fitAndCenter( model, targetHeight ) {
	const box = new THREE.Box3().setFromObject( model );
	const size = box.getSize( new THREE.Vector3() );
	model.scale.setScalar( targetHeight / ( Math.max( size.x, size.y, size.z ) || 1 ) );
	box.setFromObject( model );
	const center = box.getCenter( new THREE.Vector3() );
	model.position.set( - center.x, - box.min.y, - center.z );
}

// ── Load all GLBs ─────────────────────────────────────────────────────────────
await MeshoptDecoder.ready;

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath( './libs/three/examples/jsm/libs/draco/gltf/' );

const loader = new GLTFLoader();
loader.setDRACOLoader( dracoLoader );
loader.setMeshoptDecoder( MeshoptDecoder );

function onModelError( name, error ) {
	console.error( name + ' loading error:', error );
	instructionEl.textContent = 'Failed to load model: ' + name;
	instructionEl.style.display = 'block';
}

loader.load(
	'embryon404_cable_texture-v1.glb',
	( gltf ) => {
		const model = gltf.scene;
		fitAndCenter( model, 1.8 );
		embryoGroup.add( model );
		onModelLoaded();
	},
	undefined,
	( error ) => { onModelError( 'embryo', error ); }
);

loader.load(
	'wolf.glb',
	( gltf ) => {
		const model = gltf.scene;
		fitAndCenter( model, 2.5 );
		wolfGroup.add( model );
		onModelLoaded();
	},
	undefined,
	( error ) => { onModelError( 'wolf', error ); }
);

loader.load(
	'flore.glb',
	( gltf ) => {
		const model = gltf.scene;
		fitAndCenter( model, 0.6 );
		floreGroup.add( model );
		onModelLoaded();
	},
	undefined,
	( error ) => { onModelError( 'flore', error ); }
);

loader.load(
	'arch.glb',
	( gltf ) => {
		const model = gltf.scene;
		fitAndCenter( model, 2.8 );
		archGroup.add( model );
		onModelLoaded();
	},
	undefined,
	( error ) => { onModelError( 'arch', error ); }
);

// ── Controller — tap to place ────────────────────────────────────────────────
// In WebXR AR, a screen tap fires a "select" event on the first controller.
const controller = renderer.xr.getController( 0 );

controller.addEventListener( 'select', () => {

	if ( placed || modelsLoaded !== TOTAL_MODELS || ! reticle.visible ) return;

	// Snap the composition to the hit-test surface position.
	compositionGroup.position.setFromMatrixPosition( reticle.matrix );
	compositionGroup.visible = true;
	placed = true;
	reticle.visible = false;

	instructionEl.style.display = 'none';

} );

scene.add( controller );

// ── Hit-test state ───────────────────────────────────────────────────────────
let hitTestSource = null;
let hitTestSourceRequested = false;

renderer.xr.addEventListener( 'sessionstart', () => {

	placed = false;
	compositionGroup.visible = false;
	reticle.visible = false;
	hitTestSource = null;
	hitTestSourceRequested = false;

	instructionEl.textContent = modelsLoaded === TOTAL_MODELS
		? 'Point camera at a flat surface, then tap to place'
		: 'Loading…';
	instructionEl.style.display = 'block';

} );

renderer.xr.addEventListener( 'sessionend', () => {

	instructionEl.style.display = 'none';

} );

// ── Animation / render loop ───────────────────────────────────────────────────
renderer.setAnimationLoop( ( timestamp, frame ) => {

	if ( frame ) {

		const referenceSpace = renderer.xr.getReferenceSpace();
		const session = renderer.xr.getSession();

		// Request hit-test source once per session.
		if ( ! hitTestSourceRequested ) {

			session.requestReferenceSpace( 'viewer' )
				.then( ( viewerSpace ) => {

					session.requestHitTestSource( { space: viewerSpace } )
						.then( ( source ) => { hitTestSource = source; } )
						.catch( console.error );

				} )
				.catch( console.error );

			session.addEventListener( 'end', () => {

				hitTestSourceRequested = false;
				hitTestSource = null;

			} );

			hitTestSourceRequested = true;

		}

		// Drive the reticle with the latest hit-test result.
		if ( hitTestSource && ! placed ) {

			const results = frame.getHitTestResults( hitTestSource );

			if ( results.length ) {

				reticle.visible = true;
				reticle.matrix.fromArray( results[ 0 ].getPose( referenceSpace ).transform.matrix );

			} else {

				reticle.visible = false;

			}

		}

	}

	renderer.render( scene, camera );

} );

// ── Resize ───────────────────────────────────────────────────────────────────
window.addEventListener( 'resize', () => {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );

} );
