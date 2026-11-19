import type { ManifoldToplevel } from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';

let pending: Promise<ManifoldToplevel> | undefined;

/** Starts one shared client kernel on demand. Failed starts can be retried on the next visit. */
export function loadEnvelopeKernel() {
	return (pending ??= import('manifold-3d')
		.then(async ({ default: init }) => {
			const kernel = await init({ locateFile: () => wasmUrl });
			kernel.setup();
			return kernel;
		})
		.catch((error) => {
			pending = undefined;
			throw error;
		}));
}
