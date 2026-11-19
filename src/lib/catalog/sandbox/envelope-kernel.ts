import { createRoofBuilder, type RoofBuilder } from '../logic/building-envelope';
import wasmUrl from 'manifold-3d/manifold.wasm?url';

let pending: Promise<RoofBuilder> | undefined;

/** Starts one shared client kernel on demand. Failed starts can be retried on the next visit. */
export function loadEnvelopeKernel() {
	return (pending ??= import('manifold-3d')
		.then(async ({ default: init }) => {
			const kernel = await init({ locateFile: () => wasmUrl });
			kernel.setup();
			return createRoofBuilder(kernel, (id, error) =>
				console.warn('Using fallback roof for ' + id, error)
			);
		})
		.catch((error) => {
			pending = undefined;
			throw error;
		}));
}
