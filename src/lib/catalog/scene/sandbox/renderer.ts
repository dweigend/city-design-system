import * as THREE from 'three/webgpu';

/** How the stage learns about the renderer: once when it can draw, once if no backend starts. */
export type RendererHooks = { ready: () => void; failed: () => void };

/**
 * Starts a renderer for the sandbox: shared studio output and cached shadow maps. The canvas reports its
 * backend as `data-backend`. `isLive` turns false after `dispose`.
 */
export function startRenderer(
	renderer: THREE.WebGPURenderer,
	canvas: HTMLCanvasElement,
	hooks: RendererHooks
) {
	renderer.shadowMap.enabled = true;
	let state: 'starting' | 'live' | 'disposed' = 'starting';

	const started = renderer.init().then(
		() => {
			const backend = renderer.backend as { isWebGPUBackend?: boolean };
			canvas.dataset.backend = backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
			if (state === 'disposed') return renderer.dispose();
			state = 'live';
			hooks.ready();
		},
		(cause) => {
			if (state !== 'disposed') hooks.failed();
			throw cause;
		}
	);

	return {
		/** Resolves when the backend runs; rejects if none starts. */
		started,
		isLive: () => state === 'live',
		dispose() {
			if (state === 'live') renderer.dispose();
			state = 'disposed';
		}
	};
}
