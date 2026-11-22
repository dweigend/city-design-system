import type { Vec2 } from '../../core/geometry';
import { defineParams, resolveParams } from '../../core/params';
import { TerrainGrid, type TerrainGridSite } from '../../domain/terrain-grid';
import { Valley } from '../../domain/valley';

/** Site size is the length along the valley, in meters. */
export const citySiteParams = defineParams({
	siteSize: { label: 'Site size', unit: 'm', default: 310, min: 180, max: 440, step: 10 }
});

const siteAspect = 0.85;

/** Creates the chapter's fixed valley and crop datum. The window remains fixed as the site
 * grows. Length and width are in meters and bearing is in radians. The stage height scale
 * applies equally to terrain, water, and grid projection. */
export function createCitySite() {
	const valley = Valley.create({ seed: 1201 });
	const frame = valley.lowerTerraceFrame(0);
	const [x, y] = frame.position;
	const origin: Vec2 = Object.freeze([x, y]);
	const [u, v] = frame.across;
	const window = Object.freeze({
		origin: Object.freeze([x - u * 240, y - v * 240] as const),
		bearing: frame.bearing,
		length: 1130,
		width: 1070
	});
	return Object.freeze({ valley, origin, window, heightScale: 8 });
}

/** The seeded plot grid at a resolved length (meters), with wet ground omitted. Site and
 * grid are frozen snapshots. Site area measures the clipped outline before ground exclusions. */
export function readCityGrid(
	city: ReturnType<typeof createCitySite>,
	siteSize: number,
	cellSize: number
) {
	const { valley, origin, window } = city;
	const { siteSize: length } = resolveParams(citySiteParams, { siteSize });
	const site: TerrainGridSite = Object.freeze({
		origin,
		bearing: window.bearing,
		length,
		width: length * siteAspect,
		cornerCut: 0.28
	});
	const grid = TerrainGrid.create({
		seed: valley.seed,
		site,
		parameters: { cellSize },
		heightAt(x, y) {
			const { height, bank } = valley.sampleGround(x, y);
			return bank > 0 ? height : undefined;
		}
	});
	return Object.freeze({
		site,
		grid,
		areaHectares: (site.length * site.width * (1 - 2 * (site.cornerCut ?? 0) ** 2)) / 10_000
	});
}
