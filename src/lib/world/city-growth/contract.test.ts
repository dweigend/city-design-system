import { describe, expect, test } from 'bun:test';
import { isSimplePolygon } from '../../core/geometry';
import { required } from '../../core/invariant';
import { createCitySite, readCityGrid, readCityParcels, type CitySite } from '../city-site';
import {
	advanceCityGrowth,
	createCityGrowth,
	defaultCityGrowthRecipe,
	readCitySnapshot,
	type CityGrowthRecipe
} from './index';

const seed = 1201;
const site = createCitySite(undefined, { seed });
const recipe: CityGrowthRecipe = { ...defaultCityGrowthRecipe, endYear: 2030 };
const runs = new Map<CityGrowthRecipe['planFamily'], ReturnType<typeof createCityGrowth>>();

function founded(planFamily: CityGrowthRecipe['planFamily'] = 'organic') {
	const cached = runs.get(planFamily);
	if (cached) return cached;
	const run = createCityGrowth(site, { ...recipe, planFamily }, seed);
	runs.set(planFamily, run);
	return run;
}

describe('dated city growth', () => {
	test('different seeds found on different ground in the same valley', () => {
		const first = founded();
		const other = createCityGrowth(site, recipe, 4294967295);
		expect(first.events).toHaveLength(recipe.minimumFoundingHoldings);
		expect(other.events).toHaveLength(recipe.minimumFoundingHoldings);
		expect(other.events[0].holding.portal.points).not.toEqual(
			first.events[0].holding.portal.points
		);
	});

	test('milestone batches, single-year batches and a fresh valley replay byte-for-byte', () => {
		const initial = founded();
		const whole = advanceCityGrowth(initial, 2030);
		let milestones = initial;
		for (const year of [1960, 1970, 1980, 1990, 2000, 2010, 2020, 2030])
			milestones = advanceCityGrowth(milestones, year);
		let annual = initial;
		for (let year = recipe.startYear + 1; year <= 2030; year++)
			annual = advanceCityGrowth(annual, year);
		const fresh = advanceCityGrowth(
			createCityGrowth(createCitySite(undefined, { seed }), recipe, seed),
			2030
		);

		const bytes = JSON.stringify(whole.events);
		const snapshot = JSON.stringify(readCitySnapshot(whole));
		for (const result of [milestones, annual, fresh]) {
			expect(JSON.stringify(result.events)).toBe(bytes);
			expect(JSON.stringify(readCitySnapshot(result))).toBe(snapshot);
		}
		expect(whole.events.length).toBeGreaterThan(initial.events.length);
		expect(whole.events).toHaveLength(recipe.maximumActiveHoldings);
		expect(initial.events).toHaveLength(recipe.minimumFoundingHoldings);
		expect(advanceCityGrowth(whole, 1970)).toBe(whole);
		expect(advanceCityGrowth(whole, 2100)).toBe(whole);
	});

	for (const planFamily of ['organic', 'square'] as const) {
		test(`${planFamily}: settles complete dry parcels through connected frontage lanes`, () => {
			const initial = founded(planFamily);
			const run = advanceCityGrowth(initial, 1980);
			const layout = readCityGrid(site, recipe.carrierSizeM, planFamily, seed);
			const program = readCityParcels(site, layout);
			const byId = new Map(program.parcels.map((parcel) => [parcel.id, parcel]));
			const blocks = new Map(program.blocks.map((block) => [block.id, block]));
			const portals = new Map(program.portals.map((portal) => [portal.id, portal]));
			const nodes = new Set<string>();
			const lanes = new Set<string>();
			const holdings = new Set<string>();
			const growthCounts = new Map<number, number>();
			expect(initial.events).toHaveLength(recipe.minimumFoundingHoldings);
			expect(run.events.length).toBeGreaterThan(initial.events.length);

			for (const { holding, lanes: introduced, building, year, sequence, reason } of run.events) {
				const { portal, memberCellIds, builtYear, ...parcel } = holding;
				expect(parcel).toEqual(required(byId.get(holding.id), 'planned parcel'));
				expect(portal).toEqual(required(portals.get(holding.portalId), 'planned portal'));
				expect(memberCellIds).toEqual(
					required(blocks.get(holding.blockId), 'planned block').memberCellIds
				);
				expect(
					parcel.outline.every((point) => site.sampleGround(...point).waterKind === null)
				).toBe(true);
				expect(builtYear).toBe(year);
				expect(sequence).toBe(growthCounts.get(year) ?? 0);
				expect(reason).toBe(year === recipe.startYear ? 'founding' : 'expansion');
				growthCounts.set(year, sequence + 1);
				expect(holdings.has(holding.id)).toBe(false);
				holdings.add(holding.id);

				expect(introduced.length).toBeLessThanOrEqual(recipe.maximumLaneHops);
				for (const lane of introduced) {
					expect(lanes.has(lane.id)).toBe(false);
					expect(!nodes.size || lane.nodeIds.some((id) => nodes.has(id))).toBe(true);
					expect(lane.builtYear).toBe(year);
					lanes.add(lane.id);
					for (const node of lane.nodeIds) nodes.add(node);
				}
				expect(lanes.has(portal.laneId)).toBe(true);
				expect(building.holdingId).toBe(holding.id);
				expect(building.parts.filter(({ kind }) => kind === 'storey')).toHaveLength(
					recipe.initialStoreys
				);
				for (const part of building.parts) {
					if (part.shape.kind !== 'prism') throw Error('Expected a datum-indexed prism');
					expect(part.shape.top).toBeGreaterThan(part.shape.base);
					expect(isSimplePolygon(holding.outline, [part.shape.polygon])).toBe(true);
				}
			}
			expect([...growthCounts.keys()]).toEqual([1950, 1960, 1970, 1980]);
			expect(growthCounts.get(1960)).toBe(recipe.holdingsPerStep);
			expect(growthCounts.get(1970)).toBe(recipe.holdingsPerStep);
			expect(growthCounts.get(1980)).toBe(recipe.holdingsPerStep);
		});
	}

	test('both cursors keep dated identity and mark only their selected additions', () => {
		const initial = founded();
		const run = advanceCityGrowth(initial, 1970);
		const saved = JSON.stringify(run);
		const empty = readCitySnapshot(run, { kind: 'event', index: -1 });
		expect(empty.eventCount).toBe(0);
		expect(empty.lastEvent).toBeNull();
		expect(readCitySnapshot(run, { kind: 'year', year: 1949 }).buildings).toEqual([]);

		const founding = readCitySnapshot(run, { kind: 'year', year: 1950 });
		const later = readCitySnapshot(run, { kind: 'year', year: 1951 });
		expect(founding.holdings).toEqual(later.holdings);
		expect(founding.lanes).toEqual(later.lanes);
		for (const [index, original] of founding.buildings.entries()) {
			const kept = later.buildings[index];
			expect(kept.id).toBe(original.id);
			expect(kept.builtYear).toBe(1950);
			for (const [partIndex, part] of original.parts.entries()) {
				expect(part.phase).toBe('addition');
				expect(kept.parts[partIndex]).toEqual({ ...part, phase: 'retained' });
			}
		}

		for (const [index, event] of run.events.entries()) {
			const step = readCitySnapshot(run, { kind: 'event', index });
			expect(step.eventCount).toBe(index + 1);
			expect(step.lastEvent).toBe(event);
			expect(step.holdings.at(-1)).toBe(event.holding);
			const previous = readCitySnapshot(run, { kind: 'event', index: index - 1 });
			expect(step.holdings.slice(0, -1)).toEqual([...previous.holdings]);
			expect(step.lanes).toEqual([...previous.lanes, ...event.lanes]);
			expect(step.buildings.at(-1)?.parts.every(({ phase }) => phase === 'addition')).toBe(true);
			expect(
				step.buildings
					.slice(0, -1)
					.every(({ parts }) => parts.every(({ phase }) => phase === 'retained'))
			).toBe(true);
		}

		expect(readCitySnapshot(run, { kind: 'year', year: 2100 })).toEqual(readCitySnapshot(run));
		expect(readCitySnapshot(run, { kind: 'year', year: 1950 })).toEqual(founding);
		expect(founding.events).toEqual(run.events.slice(0, founding.eventCount));
		expect(readCitySnapshot(run, { kind: 'event', index: 0 }).events).toEqual(
			run.events.slice(0, 1)
		);
		expect(Object.getOwnPropertySymbols(run)).toEqual([]);
		expect(JSON.stringify(run)).toBe(saved);
	});

	test('enforces flood freeboard near a narrow river missed by plan cell centers', () => {
		const narrowRiver = createCitySite((x) => {
			const channelDistance = Math.abs(x) - 10;
			if (channelDistance <= 0)
				return { height: 0, waterClearance: channelDistance, waterHeight: 2, waterKind: 'river' };
			return {
				height: channelDistance < 60 ? 2.5 : 5,
				waterClearance: channelDistance,
				waterKind: null
			};
		});
		const lowBank = createCityGrowth(
			narrowRiver,
			{ ...recipe, carrierSizeM: 600, minimumFloodFreeboardM: 1.5, waterSearchRadiusM: 60 },
			seed
		);
		expect(lowBank.events.length).toBeGreaterThanOrEqual(recipe.minimumFoundingHoldings);
		for (const { holding } of lowBank.events) {
			const centerX = holding.outline.reduce((sum, [x]) => sum + x, 0) / holding.outline.length;
			expect(Math.abs(centerX)).toBeGreaterThanOrEqual(70);
		}
	});

	test('terrain and recipe are captured before advancing and can be regenerated on revision', () => {
		let revision = 'first';
		let height = 2;
		let samples = 0;
		const mutableSite = createCitySite(
			() => {
				samples++;
				return { height, waterKind: null, waterClearance: Infinity };
			},
			{ terrainRevision: () => revision, recipe: { storeyHeightsM: [2, 5] } }
		);
		const input = { ...recipe, carrierSizeM: 600 };
		const old = createCityGrowth(mutableSite, input, seed);
		const sampled = samples;
		input.holdingsPerStep = 0;
		height = 30;
		revision = 'second';

		const advanced = advanceCityGrowth(old, 1960);
		expect(samples).toBe(sampled);
		expect(advanced.events.length).toBeGreaterThan(old.events.length);
		expect(advanced.recipe.holdingsPerStep).toBe(recipe.holdingsPerStep);
		const part = advanced.events[0].building.parts.find(({ kind }) => kind === 'storey');
		expect(part?.datumIndex).toBe(1);
		if (part?.shape.kind !== 'prism') throw Error('Expected a storey prism');
		expect([part.shape.base, part.shape.top]).toEqual([2, 7]);

		const revised = createCityGrowth(mutableSite, input, seed);
		expect(samples).toBeGreaterThan(sampled);
		expect(revised.datumZ).toBe(28);
		expect(advanceCityGrowth(revised, 2030).events).toEqual(revised.events);
	});

	test('invalid bounds are rejected and a site with no eligible cluster stays empty', () => {
		expect(() => createCityGrowth(site, { ...recipe, stepYears: 0 }, seed)).toThrow(RangeError);
		expect(() => createCityGrowth(site, recipe, -1)).toThrow(RangeError);
		expect(() => advanceCityGrowth(founded(), 1960.5)).toThrow(RangeError);
		expect(() => readCitySnapshot(founded(), { kind: 'event', index: 4 })).toThrow(RangeError);
		const wet: CitySite = createCitySite(() => ({
			height: 0,
			waterClearance: -1,
			waterHeight: 1,
			waterKind: 'lake' as const
		}));
		const empty = advanceCityGrowth(createCityGrowth(wet, recipe, seed), 2030);
		expect(empty.throughYear).toBe(2030);
		expect(readCitySnapshot(empty).eventCount).toBe(0);
	});
});
