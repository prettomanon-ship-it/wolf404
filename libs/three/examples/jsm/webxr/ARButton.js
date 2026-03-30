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
		const sharedStyle = [
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

		button.style.cssText = sharedStyle;

		// Detect Quick Look AR support directly (feature detection rather than
		// user-agent sniffing).  Safari on iOS reports true; other browsers false.
		const supportsQuickLook = ( () => {

			try {

				return document.createElement( 'a' ).relList.supports( 'ar' );

			} catch ( e ) {

				return false;

			}

		} )();

		// Style for the Quick Look link, extending the shared button style.
		const quickLookStyle = [
			...sharedStyle.split( ';' ),
			'text-decoration:none',
			'display:inline-block',
			'text-align:center',
			'border:1px solid #fff',
			'background:rgba(0,0,0,0.55)',
			'color:#fff',
		].join( ';' );

		// Creates an <a rel="ar"> link styled to look like a button.
		// Safari uses this anchor to trigger Apple Quick Look AR.
		// Apple requires the <img> to be the FIRST child of the anchor element.
		function createQuickLookButton( src ) {

			const link = document.createElement( 'a' );
			link.setAttribute( 'rel', 'ar' );
			link.href = src;
			link.style.cssText = quickLookStyle;

			// Safari requires an <img> as the first child to activate Quick Look.
			// A 1×1 transparent GIF (base64) satisfies the requirement invisibly.
			// It must be appended before any text content to be the first child.
			const img = document.createElement( 'img' );
			img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
			img.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;overflow:hidden;';
			link.appendChild( img );

			// Label text goes in a <span> after the <img>.
			const label = document.createElement( 'span' );
			label.textContent = 'VIEW IN AR';
			link.appendChild( label );

			return link;

		}

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

					} else if ( supportsQuickLook && sessionInit.iosQuickLookSrc ) {

						// iOS Safari recognises the XR API but does not support
						// immersive-ar.  Fall back to Apple Quick Look AR.
						const link = createQuickLookButton( sessionInit.iosQuickLookSrc );
						button.replaceWith( link );

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

		} else if ( supportsQuickLook && sessionInit.iosQuickLookSrc ) {

			// No WebXR API at all (older iOS Safari).  Replace the placeholder
			// button with a Quick Look link once it has been added to the DOM.
			Promise.resolve().then( () => {

				const link = createQuickLookButton( sessionInit.iosQuickLookSrc );
				if ( button.parentNode ) button.replaceWith( link );

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
