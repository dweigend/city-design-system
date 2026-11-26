/** Module: Founds a settlement and replays dated growth on a fixed city carrier. */
import { Random, uint32Limit } from '../../core/random';
import type { CitySite } from '../city-site';
import { prepareGrowth, type GrowthCarrier } from './carrier';
import { captureRecipe, defaultRecipe } from './recipe';
import { createSettlement } from './settlement';
import type {
	CityGrowthCursor,
	CityGrowthEvent,
	CityGrowthRecipe,
	CityGrowthSnapshot
} from './types';

export type {
	/** Fixed inputs for one settlement history, with distances in meters and dates in calendar years. */
	CityGrowthRecipe,
	/** The entire addressed parcel, its frontage portal and its original source cells. */
	CityGrowthHolding,
	/** A public lane interval dated at its first use by the settlement. */
	CityGrowthLane,
	/** Dated geometry with a floor address relative to the common vertical datum. */
	CityGrowthPart,
	/** A dated building anchored to its holding. */
	CityGrowthBuilding,
	/** A discriminated growth admission ordered by year and sequence. */
	CityGrowthEvent,
	/** Inclusive end-of-year or exact event cursor. */
	CityGrowthCursor,
	/** Frozen replay prefix in activation order with cursor-specific part phases. */
	CityGrowthSnapshot
} from './types';

/** The default river settlement recipe. Spread it to supply any overrides. */
export const defaultCityGrowthRecipe = defaultRecipe;

const runCarrier = Symbol('city growth carrier');

/** Immutable growth history and its fixed carrier. Pass to advance or replay. */
export type CityGrowthRun = Readonly<{
	recipe: CityGrowthRecipe;
	seed: number;
	planScope: string;
	datumZ: number;
	version: typeof growthVersion;
	throughYear: number;
	events: readonly CityGrowthEvent[];
	[runCarrier]: GrowthCarrier;
}>;

const growthVersion = /* Exact arithmetic: initial growth ruleset version. */ 1;

/** Reads one terrain revision, captures the recipe and founds a connected cluster at startYear.
 * Seed is an unsigned 32-bit integer. Invalid recipe values or seed throw RangeError.
 * Returns a frozen run with an empty history if no cluster meets the founding minimum. */
export function createCityGrowth(
	site: CitySite,
	input: CityGrowthRecipe,
	seed: number
): CityGrowthRun {
	if (!Number.isInteger(seed) || seed < 0 || seed >= uint32Limit)
		throw new RangeError('City growth requires an unsigned 32-bit seed');
	const recipe = captureRecipe(input);
	const carrier = prepareGrowth(site, recipe, seed);
	const events: CityGrowthEvent[] = [];
	createSettlement(carrier, recipe, Random.create({ seed }), events).found();
	return Object.freeze({
		recipe,
		seed,
		planScope: carrier.planScope,
		datumZ: carrier.datumZ,
		version: growthVersion,
		throughYear: recipe.startYear,
		events: Object.freeze(events),
		[runCarrier]: carrier
	});
}

/** Advances a frozen run through the given integer calendar year, capped at the recipe end.
 * Scheduled years stay anchored to startYear across calls. Backward calls return the input.
 * Returns a new run sharing the original carrier and committed events. Invalid years throw RangeError. */
export function advanceCityGrowth(run: CityGrowthRun, throughYear: number): CityGrowthRun {
	if (!Number.isSafeInteger(throughYear)) throw new RangeError('Expected an integer growth year');
	const { recipe } = run;
	const target = Math.min(throughYear, recipe.endYear);
	if (target <= run.throughYear) return run;
	const events = [...run.events];
	if (events.length) {
		const settlement = createSettlement(
			run[runCarrier],
			recipe,
			Random.create({ seed: run.seed }),
			events
		);
		const { startYear, stepYears } = recipe;
		const firstStep = Math.floor((run.throughYear - startYear) / stepYears) + 1;
		for (let year = startYear + firstStep * stepYears; year <= target; year += stepYears) {
			if (!settlement.expand(year)) break;
		}
	}
	return Object.freeze({
		...run,
		throughYear: target,
		events: events.length === run.events.length ? run.events : Object.freeze(events)
	});
}

function selectPrefix(run: CityGrowthRun, cursor: CityGrowthCursor) {
	if (cursor.kind === 'event') {
		const { index } = cursor;
		if (!Number.isSafeInteger(index) || index < -1 || index >= run.events.length)
			throw new RangeError('City growth event cursor is outside the recorded history');
		return { count: index + 1, year: run.events[index]?.year ?? run.recipe.startYear };
	}
	if (!Number.isSafeInteger(cursor.year)) throw new RangeError('Expected an integer snapshot year');
	const year = Math.min(cursor.year, run.throughYear);
	const index = run.events.findIndex((event) => event.year > year);
	return { count: index === -1 ? run.events.length : index, year };
}

/** Replays an inclusive event or year prefix without changing the run. Defaults to throughYear.
 * Future year cursors read throughYear. Invalid indices or fractional years throw RangeError.
 * Arrays and phase records are frozen. Committed geometry is shared with the run. */
export function readCitySnapshot(
	run: CityGrowthRun,
	cursor: CityGrowthCursor = { kind: 'year', year: run.throughYear }
): CityGrowthSnapshot {
	const { count, year } = selectPrefix(run, cursor);
	const holdings: CityGrowthSnapshot['holdings'][number][] = [];
	const lanes: CityGrowthSnapshot['lanes'][number][] = [];
	const buildings: CityGrowthSnapshot['buildings'][number][] = [];
	for (let index = 0; index < count; index++) {
		const event = run.events[index];
		switch (event.kind) {
			case 'holding-settled': {
				const { holding, building } = event;
				const isAddition = cursor.kind === 'event' ? index === cursor.index : event.year === year;
				holdings.push(holding);
				lanes.push(...event.lanes);
				buildings.push(
					Object.freeze({
						...building,
						parts: Object.freeze(
							building.parts.map((part) =>
								Object.freeze({
									...part,
									phase: isAddition ? 'addition' : 'retained'
								})
							)
						)
					})
				);
				break;
			}
		}
	}
	return Object.freeze({
		year,
		datumZ: run.datumZ,
		holdings: Object.freeze(holdings),
		lanes: Object.freeze(lanes),
		buildings: Object.freeze(buildings),
		eventCount: count,
		lastEvent: run.events[count - 1] ?? null
	});
}
