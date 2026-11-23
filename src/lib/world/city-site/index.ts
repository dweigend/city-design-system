import type { Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { defineParams, resolveParams } from '../../core/params';
import { Random } from '../../core/random';
import { createCityDistricts, levelHeight, type CityPlanVariant } from '../../domain/city-volume';
import { planCellSide, TerrainGrid, type TerrainGrid as Grid } from '../../domain/terrain-grid';
import { Valley } from '../../domain/valley';
import { terraceGrid } from './connected';

/** City size is the nominal outline length along the valley in meters. The seed is a uint32
 * that draws the outline, the plan jitter and the districts; the valley stays fixed. */
export const citySiteParams = defineParams({
	citySize: { label: 'City size', unit: 'm', default: 5000, min: 600, max: 7000, step: 200 },
	seed: { label: 'Seed', unit: '', default: 1201, min: 0, max: 2 ** 32 - 1, step: 1 }
});

/** Coarse carrier cell in meters: the equivalent square side of a typical plan cell. Building
 * groups between two cuts of a European city are 60–120 m across; 60 m keeps a village of
 * 0.3 km² at about 80 cells and the largest valley city near 2,000. */
export const coarseCellSize = 60;

/** The city sits on the broad upper terrace: its datum lies 750 m inland of the lower terrace
 * frame and 500 m downstream, where the terrace is about 1.3 km wide and 6 km long. */
const terraceOffset = Object.freeze({ along: 500, across: 750 });

/** Buildable ground lies within one storey of the datum, so every first bay is 3.5–10.5 m. */
const reliefBand = levelHeight / 2;

const outlinePointCount = 24;

function siteParams(citySize?: number, seed?: number) {
	return resolveParams(citySiteParams, {
		...(citySize === undefined ? {} : { citySize }),
		...(seed === undefined ? {} : { seed })
	});
}

/** Short-to-long axis ratio of the nominal outline. */
export const outlineAspect = 0.5;

/** Creates the chapter's fixed valley, the terrace datum in world meters and its frame. */
export function createCitySite() {
	const valley = Valley.create({ seed: 1201 });
	const frame = valley.lowerTerraceFrame(0);
	const [du, dv] = frame.downstream;
	const [au, av] = frame.across;
	const { along, across } = terraceOffset;
	const x = frame.position[0] + du * along + au * across;
	const y = frame.position[1] + dv * along + av * across;
	return Object.freeze({
		valley,
		origin: Object.freeze<Vec2>([x, y]),
		frame,
		heightScale: 1,
		/** Whole-meter ground height at the datum; the first common plane lies 7 m above it. */
		datumZ: Math.round(valley.sampleGround(x, y).height)
	});
}

/** A city site with its valley, datum and frame. */
export type CitySite = ReturnType<typeof createCitySite>;

/** Window in meters with bearing in radians, centered on the city and a little wider, so the
 * valley shows only as context. The window has no effect on grid identity. */
export function cityWindow(city: CitySite, citySize: number) {
	const { citySize: length } = siteParams(citySize);
	return {
		origin: city.origin,
		bearing: city.frame.bearing,
		length: length * 1.2,
		width: Math.max(480, length * 0.62)
	};
}

function unitOutline(seed: number) {
	const random = Random.create({ seed }).derive('city-outline');
	const lobe = random.derive('lobe').number() * Math.PI * 2;
	return Array.from({ length: outlinePointCount }, (_, index): Vec2 => {
		const angle = (index / outlinePointCount) * Math.PI * 2;
		const radius =
			0.93 +
			0.12 * Math.cos(3 * angle + lobe) +
			random.derive(String(index)).number({ min: -0.07, max: 0.07 });
		return [(Math.cos(angle) * radius) / 2, (Math.sin(angle) * radius * outlineAspect) / 2];
	});
}

/** Scales the seeded, star-shaped city outline about the datum. Returns world XY meters. */
export function cityOutline(city: CitySite, citySize: number, seed?: number) {
	const params = siteParams(citySize, seed);
	const { origin, frame } = city;
	const [u, v] = frame.downstream;
	return unitOutline(params.seed).map(([x, y]): Vec2 => [
		origin[0] + params.citySize * (x * u - y * v),
		origin[1] + params.citySize * (x * v + y * u)
	]);
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

/** Generates the terrace grid inside the nested city outline at the coarse cell size. Ground
 * counts as buildable on dry land within one storey of the datum height. Area sums the
 * accepted cells in km². Median size is the equivalent square side of the median cell. */
export function readCityGrid(
	city: CitySite,
	citySize: number,
	variant: CityPlanVariant = 'organic',
	seed?: number
) {
	const params = siteParams(citySize, seed);
	const { valley, origin, frame, datumZ } = city;
	const candidates = TerrainGrid.create({
		seed: params.seed,
		site: { origin, bearing: frame.bearing, outline: cityOutline(city, citySize, params.seed) },
		variant,
		parameters: { cellSize: coarseCellSize / planCellSide[variant] },
		heightAt(x, y) {
			const { height, bank } = valley.sampleGround(x, y);
			return bank > 0 && Math.abs(height - datumZ) < reliefBand ? height : undefined;
		}
	});
	const grid = terraceGrid(candidates, origin);
	const areas = cellAreas(grid).sort((a, b) => a - b);
	return Object.freeze({
		grid,
		areaKm2: areas.reduce((sum, area) => sum + area, 0) / 1e6,
		medianCellSize: Math.sqrt(median(areas))
	});
}

/** Derives the districts of one plan from its area, around the datum along the valley. */
export function readCityDistricts(
	city: CitySite,
	grid: Grid,
	seed?: number,
	parameters?: Parameters<typeof createCityDistricts>[3]
) {
	const params = siteParams(undefined, seed);
	const core = { origin: city.origin, bearing: city.frame.bearing, aspect: outlineAspect };
	return createCityDistricts(grid, core, params.seed, parameters);
}
