import { courtStudy } from '#lib/catalog/raster/court-study.server.ts';

export const prerender = true;

/** Loads the same fixed city survey as the Grid chapter. */
export function load() {
	return { study: courtStudy() };
}
