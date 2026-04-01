import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// NOTE: WebXR requires a secure context (HTTPS or localhost).

// ── iOS / Quick Look detection (synchronous) ─────────────────────────────────
// iOS Safari supports <a rel="ar"> (Quick Look) but not WebXR immersive-ar.
// When detected we bypass WebXR entirely and show an interactive 3D viewer
// so users are never stuck on a black screen or an unsupported-AR message.
const supportsQuickLook = ( () => {
	try { return document.createElement( 'a' ).relList.supports( 'ar' ); }
	catch ( e ) { return false; }
} )();

const instructionEl = document.getElementById( 'ar-instruction' );

// On iOS, show the instruction banner immediately as a loading indicator.
if ( supportsQuickLook ) {
	instructionEl.textContent = 'Loading…';
	instructionEl.style.display = 'block';
}

// ── Intro overlay ─────────────────────────────────────────────────────────────
// Shown on top of the AR view once the session starts; fades out after 2 s.
const introOverlay = document.getElementById( 'intro-overlay' );

// ── Renderer ────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true } );
renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = supportsQuickLook ? 3.5 : 1.0;
// Only enable XR on non-iOS devices (WebXR is not supported on iOS Safari).
renderer.xr.enabled = ! supportsQuickLook;
document.body.appendChild( renderer.domElement );

// ── AR entry button ─────────────────────────────────────────────────────────
// On iOS / Apple devices (Quick Look supported): a dedicated <a rel="ar">
// button opens the embryo in Apple Quick Look directly, bypassing WebXR
// entirely.  This avoids the iOS 16+ issue where isSessionSupported returns
// true for immersive-ar but renderer.xr is disabled, causing a silent failure.
// On Android / Chrome (WebXR): ARButton starts an immersive-ar session.
if ( supportsQuickLook ) {

	// Dedicated Quick Look button — the "special button" for Apple devices.
	// Safari requires the first child of <a rel="ar"> to be an <img> to
	// activate Quick Look; the 1×1 transparent pixel satisfies this silently.
	const iosBtn = document.createElement( 'a' );
	iosBtn.setAttribute( 'rel', 'ar' );
	iosBtn.href = 'embryon404_cable_texture-v1.glb';
	iosBtn.style.cssText = [
		'position:fixed',
		'bottom:20px',
		'left:50%',
		'transform:translateX(-50%)',
		'padding:12px 24px',
		'border-radius:4px',
		"font-family:'Courier New',Courier,monospace",
		'font-size:13px',
		'cursor:pointer',
		'z-index:999',
		'letter-spacing:0.08em',
		'text-decoration:none',
		'display:inline-block',
		'text-align:center',
		'border:1px solid #fff',
		'background:rgba(0,0,0,0.55)',
		'color:#fff',
	].join( ';' );

	// Invisible 1×1 image required by Safari as the first child of <a rel="ar">.
	const img = document.createElement( 'img' );
	img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
	img.alt = '';
	img.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
	iosBtn.appendChild( img );

	const label = document.createElement( 'span' );
	label.textContent = 'VOIR EN AR';
	iosBtn.appendChild( label );
	iosBtn.setAttribute( 'aria-label', 'Voir en réalité augmentée' );

	document.body.appendChild( iosBtn );

} else {

	// WebXR AR for Android, Chrome and other non-Apple WebXR-capable browsers.
	document.body.appendChild(
		ARButton.createButton( renderer, {
			optionalFeatures: [ 'hit-test', 'dom-overlay' ],
			domOverlay: { root: document.body },
		} )
	);

}

// ── Scene ───────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
// iOS 3D fallback: dark background so the models are legible.
if ( supportsQuickLook ) scene.background = new THREE.Color( 0x000000 );

// ── Camera ──────────────────────────────────────────────────────────────────
// WebXR replaces camera matrices at runtime; the PerspectiveCamera is still
// required but its projection is overridden by the headset/device.
const camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 200 );

// ── iOS 3D viewer (OrbitControls fallback) ───────────────────────────────────
// iOS Safari does not support WebXR immersive-ar.  Rather than showing a
// black screen while waiting for a session that never starts, we enable
// OrbitControls so the user can explore the full scene in 3D.  The ARButton
// (replaced by a Quick Look link on iOS) still lets them open the embryo in
// Apple Quick Look for a single-model preview.
let orbitControls = null;
if ( supportsQuickLook ) {
	orbitControls = new OrbitControls( camera, renderer.domElement );
	orbitControls.enableDamping = true;
	orbitControls.dampingFactor = 0.04;
	orbitControls.rotateSpeed = 0.5;
	orbitControls.zoomSpeed = 0.8;
	orbitControls.minDistance = 1;
	orbitControls.maxDistance = 30;
	orbitControls.enablePan = true;
	// Position camera to see the full composed scene once models load.
	camera.position.set( 0, 1.5, 9 );
	orbitControls.target.set( 0, 0.5, 0 );
	orbitControls.update();
}

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

// ── Model group ────────────────────────────────────────────────────────────────
// Wrapping the models in a Group lets us set a clean base-position after the
// bounding-box centering offsets are baked into the child models' transforms.
const modelGroup = new THREE.Group();
// On iOS the scene is shown immediately as an interactive 3D viewer;
// on WebXR devices it stays hidden until the user taps to place.
modelGroup.visible = supportsQuickLook;
scene.add( modelGroup );

// On iOS we pre-place the scene at the world origin so OrbitControls can
// frame it right away.  On WebXR devices, placement happens on tap.
let placed = supportsQuickLook;
let modelReady = false;

// Target real-world height for the embryo (metres).  1.8 m makes the
// embryo feel present in real space — roughly human-sized and striking.
const TARGET_HEIGHT = 1.8;

// ── Spatial composition ───────────────────────────────────────────────────────
// modelGroup is anchored 3.5 m in front of the camera on tap, and oriented
// so its +Z faces toward the user.  Its origin is lifted 0.6 m above the
// detected floor so the embryo floats at chest height.
// Ground level in modelGroup local space is therefore y = -0.6.
//
// Coordinate system (local coords, model rotation makes +Z face user):
//   +X = user's right,  -X = user's left
//   +Z = toward user,   -Z = further away from user
//
// Positions and rotations are intentionally asymmetric — nothing is centred
// or mirrored.  The goal is a scene that feels grown into place, not arranged.

// Sub-group for embryo — focal point, offset from exact centre.
const embryoGroup = new THREE.Group();
embryoGroup.position.set( 0.2, 0, - 0.1 );
modelGroup.add( embryoGroup );

// Sub-group for wolf — off-left and slightly forward, angled instinctively.
// AR perspective is closer than the desktop view, so the angle (1.35 rad, ~77°)
// is slightly steeper than in script.js to feel natural at arm's length.
// y = -0.9 sinks the wolf further below the modelGroup origin so it reads as
// grounded on the detected floor plane rather than floating above it.
const wolfGroup = new THREE.Group();
wolfGroup.position.set( - 2.7, - 0.9, 0.4 );
wolfGroup.rotation.y = 1.35;
modelGroup.add( wolfGroup );

// Sub-group for flore — ground anchor shifted left of centre, not centred.
// 3.6 rad (~206°) keeps it turned away from the user; differs slightly from
// script.js (3.7) because the AR overhead view reads the angle differently.
const floreGroup = new THREE.Group();
floreGroup.position.set( - 0.6, - 0.6, 1.1 );
floreGroup.rotation.y = 3.6;
modelGroup.add( floreGroup );

// Sub-group for arch — threshold to the right and slightly in front of the
// scene centre so it is within the camera FOV when the scene is placed.
// At a 3.5 m placement distance, x = 0.8 puts the arch at ~28° off-centre —
// comfortably inside most phone cameras.  z = 0.5 brings it forward of the
// scene origin, towards the user, ensuring it is visible without panning.
const archGroup = new THREE.Group();
archGroup.position.set( 0.8, - 0.6, 0.5 );
// Angle opens toward the left / centre without mirroring the composition exactly.
archGroup.rotation.y = - 0.5;
modelGroup.add( archGroup );

// ── Helper: scale to target height, then center and rest base on y = 0 ───────
function fitAndCenter( model, targetHeight ) {

	const box = new THREE.Box3().setFromObject( model );
	const size = box.getSize( new THREE.Vector3() );
	// Guard against degenerate geometry (|| 1 prevents division by zero).
	model.scale.setScalar( targetHeight / ( Math.max( size.x, size.y, size.z ) || 1 ) );

	// Re-compute after scaling so centering uses the final dimensions.
	box.setFromObject( model );
	const center = box.getCenter( new THREE.Vector3() );
	model.position.set( - center.x, - box.min.y, - center.z );

}

// ── Load GLBs ─────────────────────────────────────────────────────────────────
await MeshoptDecoder.ready;

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath( './libs/three/examples/jsm/libs/draco/gltf/' );

const loader = new GLTFLoader();
loader.setDRACOLoader( dracoLoader );
loader.setMeshoptDecoder( MeshoptDecoder );

// ── Embryo ───────────────────────────────────────────────────────────────────
loader.load(
	'embryon404_cable_texture-v1.glb',
	( gltf ) => {

		const model = gltf.scene;
		fitAndCenter( model, TARGET_HEIGHT );
		embryoGroup.add( model );
		modelReady = true;

		if ( supportsQuickLook ) {
			// iOS: scene is already visible; show navigation hint.
			instructionEl.textContent = 'Drag to explore · pinch to zoom';
			instructionEl.style.display = 'block';
		} else {
			// WebXR: update text so it's ready for when the AR session starts.
			instructionEl.textContent = 'Tap to place the scene';
		}

	},
	undefined,
	( error ) => {
		console.error( 'GLB loading error:', error );
		instructionEl.textContent = 'Chargement échoué';
		instructionEl.style.display = 'block';
	}
);

// ── Wolf — larger than embryo, lying on the ground to the left ───────────────
loader.load(
	'wolf.glb',
	( gltf ) => {

		const model = gltf.scene;
		fitAndCenter( model, 2.5 );
		wolfGroup.add( model );

	},
	undefined,
	( error ) => { console.error( 'Wolf loading error:', error ); }
);

// ── Flore — small ground-layer element between wolf and embryo ───────────────
loader.load(
	'flore.glb',
	( gltf ) => {

		const model = gltf.scene;
		fitAndCenter( model, 0.6 );
		floreGroup.add( model );

	},
	undefined,
	( error ) => { console.error( 'Flore loading error:', error ); }
);

// ── Arch — organic threshold / grotto, far right of the composition ──────────
loader.load(
	'arch.glb',
	( gltf ) => {

		const model = gltf.scene;
		fitAndCenter( model, 2.8 );
		archGroup.add( model );
		console.log( 'Arch loaded successfully' );

	},
	undefined,
	( error ) => { console.error( 'Arch loading error:', error ); }
);

// ── Controller — tap to place ────────────────────────────────────────────────
// In WebXR AR, a screen tap fires a "select" event on the first controller.
const controller = renderer.xr.getController( 0 );

// Latest camera world position, updated every frame so the select handler
// can use it without re-querying the XR camera mid-event.
const cameraWorldPos = new THREE.Vector3();

controller.addEventListener( 'select', () => {

	if ( placed || ! modelReady ) return;

	// When hit-test is active, only place on a detected surface.
	// When hit-test is not available (e.g. older iOS Safari), allow tap-to-place
	// anywhere and estimate the floor from the camera's world height.
	if ( hitTestEnabled && ! reticle.visible ) return;

	const xrCam = renderer.xr.getCamera();
	const forward = new THREE.Vector3( 0, 0, - 1 ).applyQuaternion( xrCam.quaternion );
	forward.y = 0;
	// Guard against a near-zero vector when the camera points almost straight up/down.
	const MIN_FORWARD_SQ = 0.0001;
	if ( forward.lengthSq() > MIN_FORWARD_SQ ) forward.normalize();

	const PLACE_DISTANCE = 3.5; // metres

	// Use the hit-test surface height when available; otherwise estimate the
	// floor as ~1.5 m below the camera (typical phone-in-hand height).
	const floorY = reticle.visible
		? new THREE.Vector3().setFromMatrixPosition( reticle.matrix ).y
		: cameraWorldPos.y - 1.5;

	modelGroup.position.set(
		cameraWorldPos.x + forward.x * PLACE_DISTANCE,
		floorY + 0.6,
		cameraWorldPos.z + forward.z * PLACE_DISTANCE,
	);

	// Negate forward so the scene's +Z axis points back toward the user,
	// making "left" in local space match the user's left.
	modelGroup.rotation.y = Math.atan2( - forward.x, - forward.z );

	modelGroup.visible = true;
	placed = true;
	reticle.visible = false;

	instructionEl.style.display = 'none';

} );

scene.add( controller );

// ── Hit-test state ───────────────────────────────────────────────────────────
let hitTestSource = null;
let hitTestSourceRequested = false;
// Set to true once the hit-test source is successfully acquired for the session.
// Stays false on devices where hit-test is unsupported (e.g. some iOS versions).
let hitTestEnabled = false;

renderer.xr.addEventListener( 'sessionstart', () => {

	placed = false;
	modelGroup.visible = false;
	reticle.visible = false;
	hitTestSource = null;
	hitTestSourceRequested = false;
	hitTestEnabled = false;

	instructionEl.textContent = modelReady
		? 'Tap to place the scene'
		: 'Loading…';
	instructionEl.style.display = 'block';

	// Show the intro text on top of the AR view, then fade it out after 2 s.
	if ( introOverlay ) {

		introOverlay.style.transition = 'none';
		introOverlay.style.opacity = '1';
		setTimeout( () => {

			introOverlay.style.transition = 'opacity 0.9s ease';
			introOverlay.style.opacity = '0';
			introOverlay.addEventListener( 'transitionend', () => introOverlay.remove(), { once: true } );

		}, 2000 );

	}

} );

renderer.xr.addEventListener( 'sessionend', () => {

	instructionEl.style.display = 'none';

} );

// ── Animation / render loop ───────────────────────────────────────────────────
renderer.setAnimationLoop( ( timestamp, frame ) => {

	if ( orbitControls ) {
		// iOS 3D viewer: update OrbitControls damping each frame.
		orbitControls.update();
	}

	if ( frame ) {

		const referenceSpace = renderer.xr.getReferenceSpace();
		const session = renderer.xr.getSession();

		// Keep cameraWorldPos current so the select handler can use it.
		renderer.xr.getCamera().getWorldPosition( cameraWorldPos );

		// Request hit-test source once per session.
		if ( ! hitTestSourceRequested ) {

			session.requestReferenceSpace( 'viewer' )
				.then( ( viewerSpace ) => {

					session.requestHitTestSource( { space: viewerSpace } )
						.then( ( source ) => {

							hitTestSource = source;
							hitTestEnabled = true;

							// Upgrade the instruction to surface-targeting guidance now that
							// hit-test is confirmed to be working.
							if ( ! placed ) {

								instructionEl.textContent = 'Point camera at a flat surface, then tap to place';

							}

						} )
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
