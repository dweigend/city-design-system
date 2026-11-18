import init from 'manifold-3d';
import { envelopePlate } from '#lib/catalog/logic/envelope-plate.ts';
export const prerender = true;
/** Precomputes the comparison plate so visitors download only the resulting meshes. */
export async function load() {
	const kernel = await init();
	kernel.setup();
	return { meshes: envelopePlate(kernel) };
}
