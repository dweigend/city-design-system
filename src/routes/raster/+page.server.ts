import { courtStudy } from '#lib/catalog/raster/court-study.server.ts';

export const prerender = true;

/** Loads the fixed city comparison once per server instance. */
export function load() {
	return { study: courtStudy() };
}
