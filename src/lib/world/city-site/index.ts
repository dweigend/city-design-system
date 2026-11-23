import type { Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { defineParams, resolveParams } from '../../core/params';
import { Random } from '../../core/random';
import { createCityDistricts, levelHeight, type CityPlanVariant } from '../../domain/city-volume';
import { TerrainGrid, type TerrainGrid as Grid } from '../../domain/terrain-grid';
import { Valley } from '../../domain/valley';
import { terraceGrid } from './connected';

/** City size is the nominal outline length along the valley, in meters. */
export const citySiteParams = defineParams({
	citySize: { label: 'City size', unit: 'm', default: 600, min: 400, max: 1160, step: 20 }
});

const outlinePointCount = 24;
const outlineAspect = 0.5;

/** Creates the chapter's fixed valley, terrace datum and seeded, unitless growth outline. */
export function createCitySite() {
	const valley = Valley.create({ seed: 1201 });
	const frame = valley.lowerTerraceFrame(0);
	const [x, y] = frame.position;
	const origin: Vec2 = Object.freeze([x, y]);
	const random = Random.create({ seed: valley.seed }).derive('city-outline');
	const lobe = random.derive('lobe').number() * Math.PI * 2;
	const outline = Array.from({ length: outlinePointCount }, (_, index): Vec2 => {
		const angle = (index / outlinePointCount) * Math.PI * 2;
		const radius =
			0.93 +
			0.12 * Math.cos(3 * angle + lobe) +
			random.derive(String(index)).number({ min: -0.07, max: 0.07 });
		return Object.freeze([
			(Math.cos(angle) * radius) / 2,
			(Math.sin(angle) * radius * outlineAspect) / 2
		]);
	});
	return Object.freeze({
		valley,
		origin,
		frame,
		outline: Object.freeze(outline),
		heightScale: 1,
		// Round the terrace datum up to a coarse unit so the first plane clears the growing site.
		datumZ: Math.ceil(frame.position[2] / levelHeight) * levelHeight
	});
}

/** Window in meters with bearing in radians. Centers the terrace and keeps the riverbank
 * and slope in view as the city grows. The window has no effect on grid identity. */
export function cityWindow(city: ReturnType<typeof createCitySite>, citySize: number) {
	const { citySize: length } = resolveParams(citySiteParams, { citySize });
	const {
		frame,
		origin: [x, y]
	} = city;
	const [u, v] = frame.across;
	return {
		origin: [x - u * 55, y - v * 55] as const,
		bearing: frame.bearing,
		length: length * 1.34,
		width: Math.max(420, length * 0.66)
	};
}

function cellAreas(grid: Grid) {
	const vertices = new Map(grid.vertices.map(({ id, position }) => [id, position]));
	return grid.cells.map(({ vertexIds }) => {
		const points = vertexIds.map((id) => required(vertices.get(id), 'city vertex'));
		const [x, y] = points[0];
		return (
			points.reduce((area, [ax, ay], index) => {
				const [bx, by] = points[(index + 1) % points.length];
				return area + (ax - x) * (by - y) - (ay - y) * (bx - x);
			}, 0) / 2
		);
	});
}

function median(sorted: readonly number[]) {
	const midpoint = Math.floor(sorted.length / 2);
	if (!sorted.length) return 0;
	return (sorted[midpoint] + sorted[Math.floor((sorted.length - 1) / 2)]) / 2;
}

/** Scales the fixed, star-shaped city outline about its terrace datum. Returns world XY meters. */
export function cityOutline(city: ReturnType<typeof createCitySite>, citySize: number) {
	const { citySize: length } = resolveParams(citySiteParams, { citySize });
	const { origin, frame } = city;
	const [u, v] = frame.downstream;
	return city.outline.map(([x, y]): Vec2 => [
		origin[0] + length * (x * u - y * v),
		origin[1] + length * (x * v + y * u)
	]);
}

/** Generates the dry terrace grid inside the nested city outline. Area sums the accepted
 * cells in hectares. Median size is the equivalent square side of the median cell area. */
export function readCityGrid(
	city: ReturnType<typeof createCitySite>,
	citySize: number,
	variant?: CityPlanVariant
) {
	const { valley, origin, frame } = city;
	const candidates = TerrainGrid.create({
		seed: valley.seed,
		site: { origin, bearing: frame.bearing, outline: cityOutline(city, citySize) },
		variant,
		heightAt(x, y) {
			const { height, bank } = valley.sampleGround(x, y);
			return bank > 0 ? height : undefined;
		}
	});
	const grid = terraceGrid(candidates, origin);
	const areas = cellAreas(grid).sort((a, b) => a - b);
	return Object.freeze({
		grid,
		areaHectares: areas.reduce((sum, area) => sum + area, 0) / 10_000,
		medianCellSize: Math.sqrt(median(areas))
	});
}

/** Seeds districts on the smallest chapter crop so larger crops retain their addresses and levels.
 * The initial plan can be reused when changing the height or complexity. */
export function readCityDistricts(
	city: ReturnType<typeof createCitySite>,
	initial: Grid,
	parameters?: Parameters<typeof createCityDistricts>[3]
) {
	return createCityDistricts(initial, city.origin, city.valley.seed, parameters);
}
