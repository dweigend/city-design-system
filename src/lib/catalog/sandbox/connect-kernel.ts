import type { RoofBuilder } from '../logic/building-envelope';

/** Delivers synchronous or asynchronous startup failures while the owning canvas is live. */
export async function connectKernel(
	load: () => RoofBuilder | Promise<RoofBuilder>,
	isLive: () => boolean,
	install: (roof: RoofBuilder) => void,
	reject: (error: unknown) => void
) {
	try {
		const roof = await load();
		if (isLive()) install(roof);
	} catch (error) {
		if (isLive()) reject(error);
	}
}
