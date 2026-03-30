/**
 * Minimal ARButton helper for Three.js WebXR AR sessions.
 * Based on the official Three.js ARButton from three/examples/jsm/webxr/ARButton.js.
 */
export class ARButton {

	static createButton( renderer, sessionInit = {} ) {

		const button = document.createElement( 'button' );

		let currentSession = null;

		async function onSessionStarted( session ) {

			session.addEventListener( 'end', onSessionEnded );

			renderer.xr.setReferenceSpaceType( 'local' );
			await renderer.xr.setSession( session );

			button.textContent = 'EXIT AR';
			currentSession = session;

		}

		function onSessionEnded() {

			currentSession.removeEventListener( 'end', onSessionEnded );
			button.textContent = 'ENTER AR';
			currentSession = null;

		}

		// Style shared between all states
		button.style.cssText = [
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
		].join( ';' );

		if ( 'xr' in navigator ) {

			navigator.xr.isSessionSupported( 'immersive-ar' )
				.then( ( supported ) => {

					if ( supported ) {

						button.textContent = 'ENTER AR';
						button.style.border = '1px solid #fff';
						button.style.background = 'rgba(0,0,0,0.55)';
						button.style.color = '#fff';

						button.addEventListener( 'click', () => {

							if ( ! currentSession ) {

								navigator.xr
									.requestSession( 'immersive-ar', sessionInit )
									.then( onSessionStarted )
									.catch( ( e ) => console.error( 'Failed to start AR session:', e ) );

							} else {

								currentSession.end();

							}

						} );

					} else {

						button.textContent = 'AR NOT SUPPORTED';
						button.style.border = '1px solid #555';
						button.style.background = 'rgba(0,0,0,0.55)';
						button.style.color = '#555';
						button.style.cursor = 'default';
						button.disabled = true;

					}

				} )
				.catch( ( e ) => {

					console.warn( 'isSessionSupported error:', e );
					button.textContent = 'AR UNAVAILABLE';
					button.style.border = '1px solid #555';
					button.style.background = 'rgba(0,0,0,0.55)';
					button.style.color = '#555';
					button.disabled = true;

				} );

		} else {

			button.textContent = 'WEBXR NOT AVAILABLE';
			button.style.border = '1px solid #555';
			button.style.background = 'rgba(0,0,0,0.55)';
			button.style.color = '#555';
			button.disabled = true;

		}

		return button;

	}

}
