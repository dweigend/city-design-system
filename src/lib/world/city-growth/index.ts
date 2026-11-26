/** Module: Founds a settlement and replays dated growth on a fixed city carrier. */
import { Random, uint32Limit } from '../../core/random';
import type { CitySite } from '../city-site';
import { createStock, readPublicStock } from './history';
import { prepareGrowth, type GrowthCarrier } from './carrier';
import { captureRecipe, defaultRecipe } from './recipe';
import { createSettlement } from './settlement';
import { createHandover } from './handover';
import type {
	CityGrowthCursor,
	CityGrowthEvent,
	CityGrowthRecipe,
	CityGrowthSnapshot
} from './types';

export type {
	/** Fixed inputs for one settlement history, with distances in meters and dates in calendar years. */
	CityGrowthRecipe,
	/** Enables G3 with optional earliest crossing and rail budget years. */
	CityGrowthDevelopment,
	/** One bridge, track or station part with its physical address and build year. */
	CityInfrastructurePart,
	/** A dated registry object anchored to a holding, network edge or station approach. */
	CityGrowthAsset,
	/** Starts a construction style in a calendar year and supplies optional upper massing edits. */
	CityConstructionEra,
	/** Schedules a targeted or seeded change to existing stock. */
	CityStockChange,
	/** Side-connected open cells from a frontage portal to a reserved rear court. */
	CityGrowthCourtAccess,
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

const carriers = new WeakMap<CityGrowthRun, GrowthCarrier>();

/** Immutable growth history and its fixed carrier. Pass to advance or replay. */
export type CityGrowthRun = Readonly<{
	recipe: CityGrowthRecipe;
	seed: number;
	planScope: string;
	datumZ: number;
	version: typeof growthVersion;
	throughYear: number;
	events: readonly CityGrowthEvent[];
}>;

const growthVersion = /* Exact arithmetic: infrastructure and stock continuity ruleset version. */ 3;

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
	const run: CityGrowthRun = Object.freeze({
		recipe,
		seed,
		planScope: carrier.planScope,
		datumZ: carrier.datumZ,
		version: growthVersion,
		throughYear: recipe.startYear,
		events: Object.freeze(events)
	});
	carriers.set(run, carrier);
	return run;
}

/** Advances a frozen run through the given integer calendar year, capped at the recipe end.
 * Scheduled years stay anchored to startYear across calls. Backward calls return the input.
 * Returns a new run sharing the original carrier and committed events. Invalid years throw RangeError. */
export function advanceCityGrowth(run: CityGrowthRun, throughYear: number): CityGrowthRun {
	if (!Number.isSafeInteger(throughYear)) throw new RangeError('Expected an integer growth year');
	const carrier = carriers.get(run);
	if (!carrier) throw new RangeError('City growth run is missing its internal carrier');
	const { recipe } = run;
	const target = Math.min(throughYear, recipe.endYear);
	if (target <= run.throughYear) return run;
	const events = [...run.events];
	if (events.length) {
		const settlement = createSettlement(carrier, recipe, Random.create({ seed: run.seed }), events);
		advanceSettlement(run, target, settlement);
	}
	const next: CityGrowthRun = Object.freeze({
		...run,
		throughYear: target,
		events: events.length === run.events.length ? run.events : Object.freeze(events)
	});
	carriers.set(next, carrier);
	return next;
}

function advanceSettlement(
	run: CityGrowthRun,
	target: number,
	settlement: ReturnType<typeof createSettlement>
) {
	const { startYear, stepYears, stockChanges = [] } = run.recipe;
	const firstStep = Math.floor((run.throughYear - startYear) / stepYears) + 1;
	let nextExpansion = startYear + firstStep * stepYears;
	let changeIndex = stockChanges.findIndex(({ year }) => year > run.throughYear);
	if (changeIndex === -1) changeIndex = stockChanges.length;
	while (true) {
		const year = Math.min(nextExpansion, stockChanges[changeIndex]?.year ?? Infinity);
		if (year > target) return;
		let sequence = 0;
		if (year === nextExpansion) {
			sequence = settlement.expand(year);
			nextExpansion = year + stepYears;
		}
		while (stockChanges[changeIndex]?.year === year) {
			if (settlement.change(stockChanges[changeIndex], sequence, changeIndex)) sequence++;
			changeIndex++;
		}
	}
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
	const stock = createStock();
	const lanes: CityGrowthSnapshot['lanes'][number][] = [];
	const added = new Set<string>();
	for (let index = 0; index < count; index++) {
		const event = run.events[index];
		stock.add(event);
		if ('lanes' in event) lanes.push(...event.lanes);
		const selected = cursor.kind === 'event' ? index === cursor.index : event.year === year;
		if (!selected) continue;
		const parts = eventParts(event);
		for (const { id } of parts) added.add(id);
	}
	const buildings = [...stock.buildings.values()].map((building) =>
		Object.freeze({
			...building,
			parts: Object.freeze(
				building.parts.map((part) => {
					const phase = added.has(part.id) ? 'addition' : 'retained';
					return Object.freeze({ ...part, phase });
				})
			)
		})
	);
	const prefix =
		count === run.events.length ? run.events : Object.freeze(run.events.slice(0, count));
	return Object.freeze({
		year,
		datumZ: run.datumZ,
		holdings: Object.freeze([...stock.holdings.values()]),
		lanes: Object.freeze(lanes),
		buildings: Object.freeze(buildings),
		retiredBuildings: Object.freeze(stock.retiredBuildings),
		...readPublicStock(prefix),
		events: prefix,
		eventCount: count,
		lastEvent: prefix[count - 1] ?? null
	});
}

function eventParts(event: CityGrowthEvent) {
	if (event.kind === 'holding-settled') return event.building.parts;
	if (event.kind === 'building-infill' || event.kind === 'building-extended') return event.parts;
	return [];
}

/** Editable sandbox world and document with a serializable dated stock baseline. */
export type CitySandboxHandover = ReturnType<typeof createHandover>;

/** Opens the inclusive 2030 prefix as an editable, same-carrier sandbox baseline.
 * Exact committed occupancy and dates are available through the paired stock reader and save.
 * Requires an advanced run and, for custom terrain, its original stable sampler revision. */
export function createSandboxHandover(run: CityGrowthRun): CitySandboxHandover {
	const year = defaultCityGrowthRecipe.endYear;
	const carrier = carriers.get(run);
	if (!carrier || run.throughYear < year || run.recipe.startYear > year)
		throw new RangeError('Sandbox handover requires a recorded 2030 snapshot');
	return createHandover(carrier, readCitySnapshot(run, { kind: 'year', year }), run.seed);
}
