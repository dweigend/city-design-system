import init from 'manifold-3d';
import { envelopePlate } from '../logic/envelope-plate';

/** Supplies the roof comparison page with its twelve precomputed meshes. */
export async function loadEnvelopePlate() {
	const kernel = await init();
	kernel.setup();
	return { meshes: envelopePlate(kernel) };
}
