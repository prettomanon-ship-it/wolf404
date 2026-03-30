import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
// Neutral lights so the model looks natural against the real-world background.
const ambient = new THREE.AmbientLight( 0xffffff, 2.5 );
scene.add( ambient );

const keyLight = new THREE.DirectionalLight( 0xffffff, 2.0 );
keyLight.position.set( 1, 2, 1 );
scene.add( keyLight );

const fillLight = new THREE.DirectionalLight( 0xcccccc, 1.0 );
fillLight.position.set( - 1, 0, - 1 );
scene.add( fillLight );

// ── Surface-detection reticle ────────────────────────────────────────────────
// Thin ring that tracks the hit-test result and shows where the model will land.
const reticleGeometry = new THREE.RingGeometry( 0.1, 0.12, 32 );
reticleGeometry.rotateX( - Math.PI / 2 );
const reticle = new THREE.Mesh(
	reticleGeometry,
	new THREE.MeshBasicMaterial( { color: 0xffffff, opacity: 0.8, transparent: true } )
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add( reticle );

// ── Model group ──────────────────────────────────────────────────────────────
// Wrapping the model in a Group lets us set a clean base-position after the
// bounding-box centering offsets are baked into the child model's transform.
const modelGroup = new THREE.Group();
modelGroup.visible = false;
scene.add( modelGroup );

let placed = false;
let modelReady = false;

// Target real-world height for the creature (metres).  1.8 m makes the
// embryo feel present in real space — roughly human-sized and striking.
const TARGET_HEIGHT = 1.8;

// ── Load GLB ─────────────────────────────────────────────────────────────────
await MeshoptDecoder.ready;

const loader = new GLTFLoader();
loader.setMeshoptDecoder( MeshoptDecoder );

loader.load(
	'embryon404_cable_texture-v1.glb',
	( gltf ) => {

		const model = gltf.scene;

		// Scale so the tallest dimension equals TARGET_HEIGHT metres.
		const box = new THREE.Box3().setFromObject( model );
		const size = box.getSize( new THREE.Vector3() );
		const maxDim = Math.max( size.x, size.y, size.z ) || 1;
		model.scale.setScalar( TARGET_HEIGHT / maxDim );

		// Re-compute the box after scaling, then center horizontally and
		// push the model upward so its base sits exactly at y = 0 (ground plane).
		box.setFromObject( model );
		const center = box.getCenter( new THREE.Vector3() );
		model.position.set( - center.x, - box.min.y, - center.z );

		modelGroup.add( model );
		modelReady = true;

		// Update text so it's ready for when the AR session starts.
		instructionEl.textContent = 'Point camera at a flat surface, then tap to place';

	},
	undefined,
	( error ) => {

		console.error( 'GLB loading error:', error );
		instructionEl.textContent = 'Failed to load model';
		instructionEl.style.display = 'block';

	}
);

// ── Controller — tap to place ────────────────────────────────────────────────
// In WebXR AR, a screen tap fires a "select" event on the first controller.
const controller = renderer.xr.getController( 0 );

controller.addEventListener( 'select', () => {

	if ( placed || ! modelReady || ! reticle.visible ) return;

	// Snap model group to the hit-test surface position, then lift it
	// so the embryo is suspended at roughly chest / head height (~0.6 m
	// above the detected floor) rather than resting on the ground.
	modelGroup.position.setFromMatrixPosition( reticle.matrix );
	modelGroup.position.y += 0.6;
	modelGroup.visible = true;
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
	modelGroup.visible = false;
	reticle.visible = false;
	hitTestSource = null;
	hitTestSourceRequested = false;

	instructionEl.textContent = modelReady
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
