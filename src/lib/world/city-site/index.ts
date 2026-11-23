import type { Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { defineParams, resolveParams } from '../../core/params';
import { Random } from '../../core/random';
import { createCityDistricts, type CityPlanVariant } from '../../domain/city-volume';
import { crossingLimits, TerrainGrid, type TerrainGrid as Grid } from '../../domain/terrain-grid';
import { Valley, type ValleySettings } from '../../domain/valley';
import { preparePlanSelection } from './plan-selection';
import { prepareCarrier } from './carrier';
import type { CityTerrainSampler } from './sampling';
import type { CityCrossing } from './crossings';

/** Maximum sampled height range, in meters, in a buildable city cell. */
export { maximumCellRiseM } from './carrier';
/** Minimum dry clearance required for occupied cells, in meters. */
export { cityBankSetbackM } from './carrier';
export type { CityTerrainSampler } from './sampling';
export type { CityCrossing } from './crossings';

/** City size sets the target area in the fixed valley. The seed varies access and plan jitter. */
export const citySiteParams = defineParams({
	citySize: { label: 'City size', unit: 'm', default: 1800, min: 600, max: 7000, step: 200 },
	seed: { label: 'Seed', unit: '', default: 1201, min: 0, max: 2 ** 32 - 1, step: 1 }
});

/** Equivalent square side of a typical coarse plan cell, in meters. */
export const coarseCellSize = 60;

function siteParams(citySize?: number, seed?: number) {
	return resolveParams(citySiteParams, {
		...(citySize === undefined ? {} : { citySize }),
		...(seed === undefined ? {} : { seed })
	});
}

/** Creates the chapter's fixed grid frame on a valley with optional relief and runoff settings.
 * The optional seed varies the valley. A pure alternate sampler can supply its own ground readings. */
export function createCitySite(
	terrain?: CityTerrainSampler,
	settings?: Partial<ValleySettings> & Readonly<{ seed?: number }>
) {
	const { seed = citySiteParams.seed.default, ...parameters } = settings ?? {};
	const valley = Valley.create({ seed, parameters });
	const bearing = -Math.PI / 2;
	const origin = Object.freeze([0, 0] as const);
	const sampleGround: CityTerrainSampler =
		terrain ??
		((x, y) => {
			const reading = valley.readGround(x, y);
			return {
				height: reading.height,
				dry: reading.waterKind === null,
				waterClearance: reading.bank,
				waterKind: reading.waterKind
			};
		});
	return Object.freeze({
		valley,
		origin,
		frame: Object.freeze({ bearing }),
		sampleGround,
		customGround: terrain !== undefined
	});
}

/** A city site with its valley and grid frame. */
export type CitySite = ReturnType<typeof createCitySite>;

type Carrier = ReturnType<typeof prepareCarrier> & {
	planSelection: ReturnType<typeof preparePlanSelection>;
};
const carriers = new WeakMap<CitySite, Map<string, Carrier>>();
const growth = new WeakMap<Grid, Parameters<typeof createCityDistricts>[4]>();

function carrier(city: CitySite, variant: CityPlanVariant, seed: number) {
	let cache = carriers.get(city);
	if (!cache) {
		cache = new Map();
		carriers.set(city, cache);
	}
	const key = `${variant}/${seed}`;
	const cached = cache.get(key);
	if (cached) return cached;
	const station = Random.create({ seed })
		.derive('crossing-station')
		.number({ min: -860, max: 860 });
	const {
		frame: { bearing },
		sampleGround,
		origin
	} = city;
	const prepared = prepareCarrier(
		{
			origin,
			sampleGround,
			bearing,
			bankSide: city.customGround ? undefined : (point) => readCitySide(city, point),
			center: [origin[0] + station * Math.cos(bearing), origin[1] + station * Math.sin(bearing)]
		},
		coarseCellSize,
		variant,
		seed
	);
	if (cache.size === 8) cache.delete(required(cache.keys().next().value, 'oldest carrier'));
	const result = { ...prepared, planSelection: preparePlanSelection(prepared.plan) };
	cache.set(key, result);
	return result;
}

type TrunkSegment = readonly [x: number, y: number, dx: number, dy: number, length2: number];
const trunkSections = new WeakMap<CitySite, Map<number, TrunkSegment[]>>();
const sectionSize = 250;

function sections(city: CitySite) {
	let index = trunkSections.get(city);
	if (index) return index;
	index = new Map();
	const { xy } = city.valley.course;
	for (let i = 2; i < xy.length; i += 2) {
		const x = xy[i - 2];
		const y = xy[i - 1];
		const dx = xy[i] - x;
		const dy = xy[i + 1] - y;
		const length2 = dx * dx + dy * dy;
		if (!length2) continue;
		const segment: TrunkSegment = [x, y, dx, dy, length2];
		for (
			let section = Math.floor((Math.min(y, y + dy) - 3500) / sectionSize);
			section <= Math.floor((Math.max(y, y + dy) + 3500) / sectionSize);
			section++
		) {
			const list = index.get(section) ?? [];
			list.push(segment);
			index.set(section, list);
		}
	}
	trunkSections.set(city, index);
	return index;
}

/** Reads the side of the nearest trunk segment. Positive is left looking downstream. */
export function readCitySide(city: CitySite, [x, y]: Vec2) {
	let nearest = Infinity;
	let side = 0;
	for (const [a, b, dx, dy, length2] of sections(city).get(Math.floor(y / sectionSize)) ?? []) {
		const u = x - a;
		const v = y - b;
		const t = Math.max(0, Math.min(1, (u * dx + v * dy) / length2));
		const distance2 = (u - t * dx) ** 2 + (v - t * dy) ** 2;
		if (distance2 >= nearest) continue;
		nearest = distance2;
		side = Math.sign(dx * v - dy * u);
	}
	return side;
}

/** Frames the selected blocks on the surrounding terrain, in world XY meters and radians. */
export function cityWindow(city: CitySite, grid: Grid) {
	const { bearing } = city.frame;
	if (!grid.vertices.length) return { origin: city.origin, bearing, length: 1200, width: 900 };
	const u = Math.cos(bearing);
	const v = Math.sin(bearing);
	const [x, y] = city.origin;
	let left = Infinity,
		right = -Infinity,
		bottom = Infinity,
		top = -Infinity;
	for (const {
		position: [wx, wy]
	} of grid.vertices) {
		const a = (wx - x) * u + (wy - y) * v;
		const b = (wy - y) * u - (wx - x) * v;
		left = Math.min(left, a);
		right = Math.max(right, a);
		bottom = Math.min(bottom, b);
		top = Math.max(top, b);
	}
	const along = (left + right) / 2;
	const across = (bottom + top) / 2;
	return {
		origin: [x + along * u - across * v, y + along * v + across * u] as const,
		bearing,
		length: (right - left) * 1.12 + 320,
		width: (top - bottom) * 1.2 + 370
	};
}

/** Takes the shortest prefix of nested growth that reaches the desired area. The datum anchors
 * the common 7 m planes at or below the lowest candidate ground. It stays fixed as a city grows.
 * The grid holds setback-clipped buildable cells, the plan holds the uncut cells including
 * water inside and along the edge of the footprint. Crossings list channel candidates
 * with both heads in the built footprint. The default selection takes up to one candidate
 * plus one per started 1.25 km² of built area, in candidate order. */
export function readCityGrid(
	city: CitySite,
	citySize: number,
	variant: CityPlanVariant = 'organic',
	seed?: number
) {
	const params = siteParams(citySize, seed);
	const { candidates, plan, planSelection, crossings, order, ranks, datumZ } = carrier(
		city,
		variant,
		params.seed
	);
	const lengthKm = params.citySize / 1000;
	const target = 1e6 * lengthKm * (0.554 + 0.105 * lengthKm);
	const cutoff = order.findIndex(({ builtArea, complete }) => complete && builtArea >= target);
	const selected = cutoff < 0 ? order : order.slice(0, cutoff + 1);
	const ids = selected.map(({ id }) => id);
	const grid = TerrainGrid.select(candidates, ids);
	const built = new Set(ids);
	const activeCrossings: CityCrossing[] = [];
	const planIds = planSelection(grid);
	for (const {
		path,
		span,
		heads: [first, second],
		waterCellIds
	} of crossings) {
		const from = first.cellIds.filter((id) => built.has(id));
		const to = second.cellIds.filter((id) => built.has(id));
		if (!from.length || !to.length) continue;
		activeCrossings.push(
			Object.freeze({
				path,
				...(span ? { span } : {}),
				heads: Object.freeze([
					Object.freeze({ nodeId: first.nodeId, cellIds: Object.freeze(from) }),
					Object.freeze({ nodeId: second.nodeId, cellIds: Object.freeze(to) })
				] as const)
			})
		);
		for (const id of waterCellIds) planIds.add(id);
	}
	const needsFringe = new Set(
		candidates.cells
			.filter(
				({ id, neighbors }) =>
					(ranks.get(id) ?? Infinity) < selected.length &&
					neighbors.some(
						(neighbor) => neighbor !== null && (ranks.get(neighbor) ?? -1) >= selected.length
					)
			)
			.map(({ id }) => id)
	);
	growth.set(grid, {
		rank: (id) => required(ranks.get(id), 'growth rank'),
		hasFutureNeighbor: (id) => needsFringe.has(id)
	});
	const areas = selected
		.map(({ builtArea }, i) => builtArea - (selected[i - 1]?.builtArea ?? 0))
		.sort((a, b) => a - b);
	const middle = Math.floor(areas.length / 2);
	const areaKm2 = (selected.at(-1)?.builtArea ?? 0) / 1e6;
	return Object.freeze({
		grid,
		plan: TerrainGrid.select(plan, [...planIds]),
		crossings: Object.freeze(activeCrossings),
		selectedCrossings: Object.freeze(
			activeCrossings.slice(
				0,
				crossingLimits.selectionBaseCount +
					Math.ceil(areaKm2 / crossingLimits.selectionIncrementKm2)
			)
		),
		datumZ,
		areaKm2,
		medianCellSize: areas.length
			? Math.sqrt((areas[middle] + areas[Math.floor((areas.length - 1) / 2)]) / 2)
			: 0
	});
}

/** Derives districts from the same fixed accessibility order as the footprint. */
export function readCityDistricts(
	city: CitySite,
	grid: Grid,
	seed?: number,
	parameters?: Parameters<typeof createCityDistricts>[3]
) {
	const params = siteParams(undefined, seed);
	const core = { origin: city.origin, bearing: city.frame.bearing, aspect: 1 };
	return createCityDistricts(grid, core, params.seed, parameters, growth.get(grid));
}
