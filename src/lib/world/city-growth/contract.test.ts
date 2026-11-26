import { describe, expect, test } from 'bun:test';
import {
	distance,
	isSimplePolygon,
	isSimpleRing,
	measurePointSegmentDistance,
	readVertexMean,
	type Vec2
} from '../../core/geometry';
import { defaults } from '../../../config/city-growth';
import { required } from '../../core/invariant';
import { createCitySite, readCityGrid, readCityParcels, type CitySite } from '../city-site';
import {
	advanceCityGrowth,
	createCityGrowth,
	createSandboxHandover,
	defaultCityGrowthRecipe,
	readCitySnapshot,
	type CityGrowthRecipe,
	type CityGrowthSnapshot
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

function settlementEvents(run: ReturnType<typeof createCityGrowth>) {
	return run.events.map((event) => {
		if (event.kind !== 'holding-settled') throw Error('Expected settlement-only history');
		return event;
	});
}

describe('dated city growth', () => {
	test('different seeds found on different ground in the same valley', () => {
		const first = founded();
		const other = createCityGrowth(site, recipe, 4294967295);
		expect(first.events).toHaveLength(recipe.minimumFoundingHoldings);
		expect(other.events).toHaveLength(recipe.minimumFoundingHoldings);
		expect(settlementEvents(other)[0].holding.portal.points).not.toEqual(
			settlementEvents(first)[0].holding.portal.points
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

			for (const {
				holding,
				lanes: introduced,
				building,
				year,
				sequence,
				reason
			} of settlementEvents(run)) {
				const {
					portal,
					memberCellIds,
					builtYear,
					protected: isProtected,
					courtAccess,
					...parcel
				} = holding;
				expect(isProtected).toBe(false);
				if (courtAccess) expect(courtAccess.cellIds.length).toBeGreaterThan(1);
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
					expect(isSimpleRing(part.shape.polygon)).toBe(true);
					const [cx, cy] = readVertexMean(part.shape.polygon);
					const inset = part.shape.polygon.map(([x, y]): Vec2 => [
						cx + (x - cx) * 0.99,
						cy + (y - cy) * 0.99
					]);
					expect(isSimplePolygon(holding.outline, [inset])).toBe(true);
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

		for (const [index, event] of settlementEvents(run).entries()) {
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
		for (const { holding } of settlementEvents(lowBank)) {
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
		const part = settlementEvents(advanced)[0].building.parts.find(({ kind }) => kind === 'storey');
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

const continuityRecipe: CityGrowthRecipe = {
	...recipe,
	planFamily: 'square',
	holdingsPerStep: 0,
	stockChanges: [{ kind: 'infill', year: 1971, storeys: 2, use: 'workshop' }]
};

function burgageHolding(snapshot: CityGrowthSnapshot) {
	return required(
		snapshot.holdings.find(({ courtAccess }) => courtAccess),
		'founding burgage'
	);
}

function activeBuilding(snapshot: CityGrowthSnapshot, holdingId: string) {
	return required(
		snapshot.buildings.find((building) => building.holdingId === holdingId),
		'active building'
	);
}

function phases(run: ReturnType<typeof createCityGrowth>, ...years: number[]) {
	return years.map((year) => readCitySnapshot(run, { kind: 'year', year }));
}

describe('stock continuity', () => {
	test('rear infill, upper storeys and conversion keep the holding and underlying part addresses', () => {
		const holdingId = burgageHolding(
			readCitySnapshot(createCityGrowth(site, continuityRecipe, seed))
		).id;
		const input: CityGrowthRecipe = {
			...continuityRecipe,
			stockChanges: [
				{ kind: 'infill', holdingId, year: 1971, storeys: 2, use: 'workshop' },
				{ kind: 'extend', holdingId, year: 1991, storeys: 3, use: 'housing' },
				{ kind: 'convert', holdingId, year: 2011, fromUse: 'workshop', use: 'office' }
			]
		};
		const run = advanceCityGrowth(createCityGrowth(site, input, seed), 2011);
		const [initial, withWing, taller, converted] = phases(run, 1951, 1971, 1991, 2011);
		const holding = burgageHolding(initial);
		const access = required(holding.courtAccess, 'reserved route');
		const original = activeBuilding(initial, holdingId);
		const wing = activeBuilding(withWing, holdingId);
		const extended = activeBuilding(taller, holdingId);
		const reused = activeBuilding(converted, holdingId);
		for (const snapshot of [withWing, taller, converted]) {
			const retained = burgageHolding(snapshot);
			expect(retained).toBe(holding);
			expect(retained.portal).toBe(holding.portal);
			expect(retained.courtAccess).toBe(access);
			expect(activeBuilding(snapshot, holdingId).id).toBe(original.id);
		}
		expect(access.cellIds.length).toBeGreaterThan(1);
		expect(Object.isFrozen(access.polygons)).toBe(true);
		const entrance = readVertexMean(holding.portal.points);
		const [entry] = access.polygons;
		expect(
			Math.min(
				...entry.map((a, i) =>
					measurePointSegmentDistance(entrance, a, entry[(i + 1) % entry.length])
				)
			)
		).toBeLessThan(0.001);
		for (let i = 1; i < access.polygons.length; i++) {
			const previous = new Set(access.polygons[i - 1].map((point) => JSON.stringify(point)));
			const shared = access.polygons[i].filter((point) => previous.has(JSON.stringify(point)));
			expect(shared).toHaveLength(2);
		}
		expect(reused.parts.slice(0, original.parts.length)).toEqual([...original.parts]);
		const added = wing.parts.filter(({ phase }) => phase === 'addition');
		expect(added.filter(({ kind }) => kind === 'storey')).toHaveLength(2);
		for (const part of added) {
			expect(part.styleId).toBe('memphis');
			expect(part.use).toBe('workshop');
			expect(part.builtYear).toBe(1971);
			expect(access.cellIds).not.toContain(required(part.cellId, 'wing cell'));
		}
		const upper = extended.parts.filter(({ phase }) => phase === 'addition');
		expect(upper).toHaveLength(6);
		const roof = Math.max(...wing.parts.map(({ datumIndex }) => datumIndex));
		expect(Math.min(...upper.map(({ datumIndex }) => datumIndex))).toBe(roof + 1);
		for (const part of upper) {
			expect(part.styleId).toBe('archigram');
			expect(part.builtYear).toBe(1991);
			expect(part.use).toBe('housing');
		}
		expect(new Set(reused.parts.map(({ id }) => id)).size).toBe(reused.parts.length);
		const prior = new Map(extended.parts.map((part) => [part.id, part]));
		for (const part of reused.parts) {
			const earlier = required(prior.get(part.id), 'earlier dated part');
			expect(part.shape).toBe(earlier.shape);
			expect(part.builtYear).toBe(earlier.builtYear);
			if (earlier.kind === 'storey' && earlier.use === 'workshop') {
				expect(part.use).toBe('office');
				expect(part.convertedYear).toBe(2011);
			} else expect(part.convertedYear).toBeUndefined();
			expect(part.phase).toBe('retained');
		}
	});

	test('explicit retirement preserves history while a later split keeps lane access and lineage', () => {
		const base = readCitySnapshot(founded('square'));
		const [protectedHolding, ...otherHoldings] = base.holdings;
		const input: CityGrowthRecipe = {
			...continuityRecipe,
			protectedHoldingIds: [protectedHolding.id],
			stockChanges: [
				{ kind: 'retire', holdingId: protectedHolding.id, year: 1961 },
				{ kind: 'split', holdingId: protectedHolding.id, year: 1961 },
				...otherHoldings.flatMap(({ id }): NonNullable<CityGrowthRecipe['stockChanges']> => [
					{ kind: 'split', holdingId: id, year: 1961 },
					{ kind: 'retire', holdingId: id, year: 1971 },
					{ kind: 'split', holdingId: id, year: 1971 }
				])
			]
		};
		const run = advanceCityGrowth(createCityGrowth(site, input, seed), 1971);
		const before = readCitySnapshot(run, { kind: 'year', year: 1970 });
		const after = readCitySnapshot(run);
		expect(before.eventCount).toBe(recipe.minimumFoundingHoldings);
		expect(after.holdings.find(({ id }) => id === protectedHolding.id)?.protected).toBe(true);
		expect(activeBuilding(after, protectedHolding.id).id).toBe(
			activeBuilding(before, protectedHolding.id).id
		);
		expect(after.events.filter(({ kind }) => kind === 'building-retired')).toHaveLength(
			otherHoldings.length
		);
		const splits = after.events.filter((event) => event.kind === 'holding-split');
		expect(splits.length).toBeGreaterThan(0);
		for (const { predecessorId, children, childIds } of splits) {
			const parent = required(
				before.holdings.find(({ id }) => id === predecessorId),
				'predecessor'
			);
			const original = activeBuilding(before, predecessorId);
			expect(after.holdings.some(({ id }) => id === predecessorId)).toBe(false);
			expect(after.buildings.some(({ id }) => id === original.id)).toBe(false);
			const retired = required(
				after.retiredBuildings.find(({ id }) => id === original.id),
				'retired stock'
			);
			expect(retired.retiredYear).toBe(1971);
			expect(retired.parts.map(({ id }) => id)).toEqual(original.parts.map(({ id }) => id));
			expect(Object.isFrozen(retired)).toBe(true);
			expect(children.map(({ id }) => id)).toEqual([...childIds]);
			expect(children[0].areaM2 + children[1].areaM2).toBeCloseTo(parent.areaM2);
			for (const [index, child] of children.entries()) {
				expect(child.parentHoldingId).toBe(parent.id);
				expect(child.splitPath).toEqual([...parent.splitPath, index]);
				expect(child.memberCellIds).toBe(parent.memberCellIds);
				expect(child.areaM2).toBeGreaterThanOrEqual(defaults.minimumSplitAreaM2);
				expect(child.portal.frontageM).toBeGreaterThanOrEqual(defaults.minimumSplitFrontageM);
				expect(child.portal.laneId).toBe(parent.portal.laneId);
				expect(child.portal.parcelId).toBe(child.id);
				expect(isSimpleRing(child.outline)).toBe(true);
				expect(Object.isFrozen(child.portal.points[0])).toBe(true);
			}
		}
		expect(after.events.slice(0, before.eventCount)).toEqual([...before.events]);
		expect(after.lanes).toEqual(before.lanes);
		const undersized = required(
			splits
				.flatMap(({ children }) => [...children])
				.find(({ areaM2 }) => areaM2 < 2 * defaults.minimumSplitAreaM2),
			'child too small to subdivide'
		);
		const another = createCityGrowth(
			site,
			{
				...input,
				stockChanges: [
					...(input.stockChanges ?? []),
					{ kind: 'split', holdingId: undersized.id, year: 1972 }
				]
			},
			seed
		);
		expect(advanceCityGrowth(another, 1972).events).toEqual(run.events);
	});

	test('protection blocks splitting an otherwise splittable vacant child holding', () => {
		const flat = createCitySite(() => ({ height: 4, waterKind: null, waterClearance: Infinity }));
		const baseRecipe: CityGrowthRecipe = {
			...recipe,
			planFamily: 'square',
			carrierSizeM: 600,
			holdingsPerStep: 0
		};
		const foundedRun = createCityGrowth(flat, baseRecipe, seed);
		const target = required(
			readCitySnapshot(foundedRun).holdings.toSorted((a, b) => b.areaM2 - a.areaM2)[0],
			'largest founding holding'
		);
		const firstSplit = advanceCityGrowth(
			createCityGrowth(
				flat,
				{
					...baseRecipe,
					stockChanges: [
						{ kind: 'retire', holdingId: target.id, year: 1961 },
						{ kind: 'split', holdingId: target.id, year: 1961 }
					]
				},
				seed
			),
			1961
		);
		const splitEvent = required(
			firstSplit.events.find((event) => event.kind === 'holding-split'),
			'initial parent split'
		);
		if (splitEvent.kind !== 'holding-split') throw Error('Expected holding split');
		const vacantChild = required(
			splitEvent.children.find(({ areaM2 }) => areaM2 >= 2 * defaults.minimumSplitAreaM2),
			'splittable vacant child'
		);
		const childSplitChanges = [
			{ kind: 'retire' as const, holdingId: target.id, year: 1961 },
			{ kind: 'split' as const, holdingId: target.id, year: 1961 },
			{ kind: 'split' as const, holdingId: vacantChild.id, year: 1971 }
		];
		const allowed = advanceCityGrowth(
			createCityGrowth(flat, { ...baseRecipe, stockChanges: childSplitChanges }, seed),
			1971
		);
		expect(
			allowed.events.some(
				(event) => event.kind === 'holding-split' && event.predecessorId === vacantChild.id
			)
		).toBe(true);

		const blocked = advanceCityGrowth(
			createCityGrowth(
				flat,
				{
					...baseRecipe,
					protectedHoldingIds: [vacantChild.id],
					stockChanges: childSplitChanges
				},
				seed
			),
			1971
		);
		expect(
			blocked.events.some(
				(event) => event.kind === 'holding-split' && event.predecessorId === vacantChild.id
			)
		).toBe(false);
		expect(
			readCitySnapshot(blocked).holdings.find(({ id }) => id === vacantChild.id)?.protected
		).toBe(true);
	});

	test('founding events depend only on reservation-time inputs, never future stock changes', () => {
		const plain = createCityGrowth(
			site,
			{ ...recipe, planFamily: 'square', holdingsPerStep: 0 },
			seed
		);
		const withUnreachable = createCityGrowth(
			site,
			{
				...recipe,
				planFamily: 'square',
				holdingsPerStep: 0,
				stockChanges: [{ kind: 'infill', holdingId: 'missing-holding', year: 2029, storeys: 1 }]
			},
			seed
		);
		expect(JSON.stringify(withUnreachable.events)).toBe(JSON.stringify(plain.events));
	});

	test('recipe eras date new construction and massing edits touch only the new upper slices', () => {
		const initial = createCityGrowth(site, continuityRecipe, seed);
		const { id } = burgageHolding(readCitySnapshot(initial));
		const stockChanges = [
			{ kind: 'infill', holdingId: id, year: 1971, storeys: 2 },
			{ kind: 'extend', holdingId: id, year: 1991, storeys: 4 },
			{ kind: 'extend', holdingId: id, year: 2011, storeys: 2 }
		] as const;
		function withOperators(setbackDepth: number, porosityRatio: number) {
			const run = createCityGrowth(
				site,
				{
					...continuityRecipe,
					stockChanges,
					eras: [
						{ fromYear: 1970, styleId: 'memphis' },
						{ fromYear: 1990, styleId: 'archigram', setbackDepth, porosityRatio },
						{ fromYear: 2010, styleId: 'organic' }
					]
				},
				seed
			);
			return advanceCityGrowth(run, 2011);
		}
		const plain = withOperators(0, 0);
		const stepped = withOperators(1, 0);
		const carved = withOperators(1, 0.5);
		const extendedAt = (run: typeof plain) => {
			const event = run.events.find(
				(event) => event.kind === 'building-extended' && event.year === 1991
			);
			if (event?.kind !== 'building-extended') throw Error('Expected dated extension');
			return event;
		};
		expect(extendedAt(plain).parts).toHaveLength(8);
		expect(extendedAt(stepped).parts.length).toBeLessThan(8);
		expect(extendedAt(carved).parts.length).toBeLessThan(extendedAt(stepped).parts.length);
		const [before, after] = phases(carved, 1972, 2011);
		const original = activeBuilding(before, id);
		const later = activeBuilding(after, id);
		expect(later.parts.slice(0, original.parts.length)).toEqual([...original.parts]);
		expect([...new Set(later.parts.map(({ styleId }) => styleId))]).toEqual([
			'neutral',
			'memphis',
			'archigram',
			'organic'
		]);
		const newStoreys = later.parts.filter(({ phase }) => phase === 'addition');
		expect(newStoreys.length).toBeGreaterThan(0);
		expect(
			newStoreys.every(({ styleId, builtYear }) => styleId === 'organic' && builtYear === 2011)
		).toBe(true);
	});

	test('all six kinds replay byte-for-byte across annual batches and exact cursors', () => {
		const base = createCityGrowth(site, continuityRecipe, seed);
		const { id } = burgageHolding(readCitySnapshot(base));
		const input: CityGrowthRecipe = {
			...continuityRecipe,
			holdingsPerStep: 1,
			stockChanges: [
				{ kind: 'infill', holdingId: id, year: 1971, storeys: 2, use: 'workshop' },
				{ kind: 'extend', holdingId: id, year: 1990, storeys: 3 },
				{ kind: 'convert', holdingId: id, year: 1990, fromUse: 'workshop', use: 'office' },
				{ kind: 'retire', holdingId: id, year: 2011 },
				{ kind: 'split', holdingId: id, year: 2011 },
				{ kind: 'extend', year: 2021, storeys: 1 }
			]
		};
		const initial = createCityGrowth(site, input, seed);
		const whole = advanceCityGrowth(initial, 2030);
		let annual = initial;
		for (let year = initial.throughYear + 1; year <= 2030; year++)
			annual = advanceCityGrowth(annual, year);
		expect(JSON.stringify(annual.events)).toBe(JSON.stringify(whole.events));
		expect([...new Set(whole.events.map(({ kind }) => kind))]).toEqual([
			'holding-settled',
			'building-infill',
			'building-extended',
			'building-converted',
			'building-retired',
			'holding-split'
		]);
		for (const [index, event] of whole.events.entries()) {
			const exact = readCitySnapshot(whole, { kind: 'event', index });
			expect(exact.lastEvent).toBe(event);
			expect(exact.eventCount).toBe(index + 1);
			expect(Object.isFrozen(exact.buildings)).toBe(true);
			expect(JSON.stringify(exact)).toBe(
				JSON.stringify(readCitySnapshot(annual, { kind: 'event', index }))
			);
			const previous = whole.events[index - 1];
			if (previous) expect(event.year).toBeGreaterThanOrEqual(previous.year);
			expect(event.sequence).toBe(previous?.year === event.year ? previous.sequence + 1 : 0);
			const additions = exact.buildings.flatMap(({ parts }) =>
				parts.filter(({ phase }) => phase === 'addition')
			);
			switch (event.kind) {
				case 'building-infill':
				case 'building-extended':
					expect(additions.map(({ id }) => id)).toEqual(event.parts.map(({ id }) => id));
					break;
				case 'holding-settled':
					expect(additions.map(({ id }) => id)).toEqual(event.building.parts.map(({ id }) => id));
					break;
				default:
					expect(additions).toEqual([]);
			}
			const byYear = readCitySnapshot(whole, { kind: 'year', year: event.year });
			expect(JSON.stringify(byYear)).toBe(
				JSON.stringify(readCitySnapshot(annual, { kind: 'year', year: event.year }))
			);
			if (whole.events[index + 1]?.year !== event.year) expect(byYear.lastEvent).toBe(event);
			if (event.kind === 'building-retired') {
				const previous = readCitySnapshot(whole, { kind: 'event', index: index - 1 });
				const earlier = activeBuilding(previous, event.holdingId);
				const retired = required(
					exact.retiredBuildings.find(({ id }) => id === earlier.id),
					'retired building'
				);
				expect(exact.buildings.some(({ id }) => id === retired.id)).toBe(false);
				expect(retired.retiredYear).toBe(event.year);
				expect(retired.parts.map((part) => ({ ...part, phase: 'retained' }))).toEqual([
					...earlier.parts
				]);
			}
		}
	});

	test('captures dated rules by value and rejects invalid dates and era order', () => {
		const change = { kind: 'extend' as const, year: 1951, storeys: 1 };
		const era = { fromYear: 1951, styleId: 'memphis' as const };
		const input = { ...continuityRecipe, stockChanges: [change], eras: [era] };
		const run = createCityGrowth(site, input, seed);
		change.year = 2029;
		era.fromYear = 2029;
		const next = advanceCityGrowth(run, 1951);
		const event = next.events.at(-1);
		if (event?.kind !== 'building-extended') throw Error('Expected extension');
		expect(event.parts[0].styleId).toBe('memphis');
		expect(Object.isFrozen(run.recipe.eras?.[0])).toBe(true);
		expect(Object.isFrozen(run.recipe.stockChanges?.[0])).toBe(true);
		expect(() => createCityGrowth(site, { ...input, eras: [era, era] }, seed)).toThrow(RangeError);
		expect(() =>
			createCityGrowth(
				site,
				{
					...input,
					stockChanges: [{ ...change, year: input.startYear }]
				},
				seed
			)
		).toThrow(RangeError);
	});
});

const developmentRecipe: CityGrowthRecipe = { ...recipe, development: {} };
const riverSite = () =>
	createCitySite(
		(x) => {
			const clearance = Math.abs(x) - 30;
			if (clearance < 0)
				return { height: 1, waterClearance: clearance, waterHeight: 2, waterKind: 'river' };
			return { height: 9, waterClearance: clearance, waterKind: null };
		},
		{ terrainRevision: () => 'straight-river/1' }
	);
const riverRecipe: CityGrowthRecipe = {
	...developmentRecipe,
	planFamily: 'organic',
	development: { railFromYear: 9999 }
};

function expectFrozen(value: unknown) {
	if (value === null || typeof value !== 'object') return;
	expect(Object.isFrozen(value)).toBe(true);
	for (const child of Object.values(value)) expectFrozen(child);
}

function compareGrowthBatches(make: () => ReturnType<typeof createCityGrowth>) {
	const initial = make();
	const whole = advanceCityGrowth(initial, 2030);
	let annual = initial;
	let milestones = initial;
	for (let year = initial.throughYear + 1; year <= 2030; year++) {
		annual = advanceCityGrowth(annual, year);
		if ((year - initial.recipe.startYear) % initial.recipe.stepYears === 0)
			milestones = advanceCityGrowth(milestones, year);
	}
	const fresh = advanceCityGrowth(make(), 2030);
	const history = JSON.stringify(whole.events);
	for (const result of [annual, milestones, fresh])
		expect(JSON.stringify(result.events)).toBe(history);
	for (const [index, event] of whole.events.entries()) {
		const cursor = { kind: 'event', index } as const;
		const exact = readCitySnapshot(whole, cursor);
		expect(exact.lastEvent).toBe(event);
		expect(JSON.stringify(exact)).toBe(JSON.stringify(readCitySnapshot(fresh, cursor)));
		const previous = whole.events[index - 1];
		expect(event.sequence).toBe(previous?.year === event.year ? previous.sequence + 1 : 0);
		const byYear = { kind: 'year', year: event.year } as const;
		expect(JSON.stringify(readCitySnapshot(whole, byYear))).toBe(
			JSON.stringify(readCitySnapshot(annual, byYear))
		);
		expectFrozen(event);
	}
	return whole;
}

describe('crossings, station centers and the 2030 stock town', () => {
	test('building an addressed bridge unlocks the other bank before the next private admission', () => {
		const ground = riverSite();
		const run = compareGrowthBatches(() => createCityGrowth(riverSite(), riverRecipe, seed));
		const opened = required(readCitySnapshot(run).crossings[0], 'committed crossing');
		const index = run.events.indexOf(opened);
		const before = readCitySnapshot(run, { kind: 'event', index: index - 1 });
		const after = readCitySnapshot(run, { kind: 'event', index });
		expect(before.crossings).toHaveLength(0);
		expect(after.crossings).toEqual([opened]);
		const { crossings, grid } = readCityGrid(ground, riverRecipe.carrierSizeM, 'organic', seed);
		expect(crossings).toContainEqual(opened.crossing);
		expect(new Set(opened.parts.map(({ id }) => id)).size).toBe(opened.parts.length);
		expect(opened.parts.filter(({ kind }) => kind === 'bearing')).toHaveLength(2);
		expect(opened.parts.every(({ builtYear }) => builtYear === opened.year)).toBe(true);
		expect(opened.parts.filter(({ kind }) => kind === 'deck')).not.toHaveLength(0);
		const landing = required(
			grid.vertices.find(({ id }) => id === opened.toNodeId),
			'bank node'
		);
		const next = run.events.slice(index + 1).find((event) => event.kind === 'holding-settled');
		if (next?.kind !== 'holding-settled') throw Error('Expected a new holding after construction');
		expect(next.year).toBe(opened.year);
		expect(opened.unlockedHoldingIds).toContain(next.holding.id);
		expect(Math.sign(readVertexMean(next.holding.outline)[0])).toBe(Math.sign(landing.position[0]));

		const deferred = advanceCityGrowth(
			createCityGrowth(
				ground,
				{
					...riverRecipe,
					development: { crossingFromYear: opened.year + 1, railFromYear: 9999 }
				},
				seed
			),
			opened.year
		);
		expect(deferred.events.slice(0, index)).toEqual([...before.events]);
		expect(readCitySnapshot(deferred).crossings).toEqual([]);
		expect(readCitySnapshot(deferred).holdings.map(({ id }) => id)).not.toContain(next.holding.id);
	}, 30_000);

	test('reserves converging market frontage and keeps it public through later stock changes', () => {
		const ground = riverSite();
		const initial = createCityGrowth(ground, riverRecipe, seed);
		const committed = advanceCityGrowth(initial, 2030);
		const square = required(readCitySnapshot(committed).squares[0], 'market reservation');
		const { id } = square.holding;
		const changes: CityGrowthRecipe['stockChanges'] = [
			{ kind: 'split', holdingId: id, year: square.year + 1 },
			{ kind: 'infill', holdingId: id, year: square.year + 1, storeys: 1 }
		];
		const run = advanceCityGrowth(
			createCityGrowth(ground, { ...riverRecipe, stockChanges: changes }, seed),
			2030
		);
		const snapshot = readCitySnapshot(run);
		expect(snapshot.holdings.find((holding) => holding.id === id)).toMatchObject({
			publicUse: true,
			protected: true,
			builtYear: square.year
		});
		const frontageLane = required(
			snapshot.lanes.find((lane) => lane.id === square.holding.portal.laneId),
			'committed market frontage lane'
		);
		expect(frontageLane.nodeIds).toContain(square.nodeId);
		const committedAtJunction = snapshot.lanes.filter(({ nodeIds }) =>
			nodeIds.includes(square.nodeId)
		);
		const isCrossingLanding = snapshot.crossings.some(({ toNodeId }) => toNodeId === square.nodeId);
		expect(committedAtJunction.length + (isCrossingLanding ? 1 : 0)).toBeGreaterThanOrEqual(3);
		expect(snapshot.buildings.some(({ holdingId }) => holdingId === id)).toBe(false);
		expect(snapshot.assets).toContainEqual(
			expect.objectContaining({
				assetId: 'park/grove',
				host: { kind: 'parcel', id },
				builtYear: square.year
			})
		);
		expect(snapshot.assets.some(({ assetId }) => assetId === 'access/walkway')).toBe(true);
	}, 30_000);

	test('opens a docked secondary center with workshops, services and an outlying landmark', () => {
		const run = compareGrowthBatches(() =>
			createCityGrowth(
				createCitySite(undefined, { seed }),
				{
					...developmentRecipe,
					development: { crossingFromYear: 9999 }
				},
				seed
			)
		);
		const snapshot = readCitySnapshot(run);
		const station = required(snapshot.stations[0], 'station');
		const line = required(
			snapshot.rail.find(({ id }) => id === station.railId),
			'overland line'
		);
		expect(line.sequence).toBeLessThan(station.sequence);
		expect(station.dock[0].nodeIds).toContain(station.station.approachId);
		expect(station.dock.at(-1)?.nodeIds).toContain('station/' + station.station.id);
		const core = readCitySnapshot(run, { kind: 'year', year: run.recipe.startYear });
		const catchment = new Set(station.catchmentHoldingIds);
		expect(core.holdings.every(({ id }) => !catchment.has(id))).toBe(true);
		const stationHoldings = snapshot.holdings.filter(({ centerId }) => centerId === station.id);
		expect(stationHoldings.length).toBeGreaterThan(1);
		expect(
			stationHoldings.every(({ id, builtYear }) => catchment.has(id) && builtYear >= station.year)
		).toBe(true);
		const stationBuildings = snapshot.buildings.filter(({ holdingId }) =>
			stationHoldings.some(({ id }) => id === holdingId)
		);
		expect(stationBuildings.map(({ use }) => use)).toContain('workshop');
		expect(stationBuildings.map(({ use }) => use)).toContain('public');
		const landmark = required(
			snapshot.assets.find(({ assetId }) => assetId.startsWith('sculpture/')),
			'station sculpture'
		);
		expect(landmark.builtYear).toBe(station.year);
		const [x, y] = landmark.anchor;
		expect(
			core.holdings.every(
				({ outline }) =>
					distance(readVertexMean(outline), [x, y]) > defaults.growthCenterSeparationM / 2
			)
		).toBe(true);
		expect(landmark.object.anchors[0].position).toEqual(landmark.anchor);
	}, 30_000);

	test('round-trips dated occupancy and addressed public stock through the sandbox world', () => {
		const initial = createCityGrowth(riverSite(), riverRecipe, seed);
		expect(() => createSandboxHandover(initial)).toThrow(RangeError);
		const run = advanceCityGrowth(initial, 2030);
		const handover = createSandboxHandover(run);
		const { world, document, stock } = handover;
		expect(stock.year).toBe(2030);
		expect(stock.buildings).toEqual(readCitySnapshot(run).buildings);
		expect(stock.assets).toEqual(readCitySnapshot(run).assets);
		expect(stock.assets.map(({ assetId }) => assetId)).toContain('park/grove');
		const restored = handover.restore(handover.serialize(document));
		expect(world.restore(restored.serialize()).readPlacements()).toEqual(document.readPlacements());
		expect(restored.readOrphans()).toEqual([]);
		expect(restored.readHistory().strokes).toBe(0);
		for (const building of stock.buildings) {
			const host = { kind: 'parcel', id: building.holdingId } as const;
			const placement = required(restored.readPlacement(host), 'restored house');
			expect(placement.hostReference.key).toBe(building.holdingId);
			expect(handover.readStock(restored, host)).toEqual(building);
			expect(handover.build(restored, placement).parts).toEqual(building.parts);
		}
		const [placement] = restored.readPlacements();
		restored.apply([{ kind: 'remove', id: placement.id }]);
		const edited = handover.restore(handover.serialize(restored));
		expect(handover.readStock(edited, placement.host)).toBeUndefined();
		edited.undo();
		expect(handover.readStock(edited, placement.host)).toBeDefined();

		const housePlacement = required(
			restored.readPlacements().find(({ assetId }) => assetId.startsWith('house/')),
			'restored house placement'
		);
		const different = world.createDocument([
			{
				kind: 'place',
				host: housePlacement.host,
				assetId: housePlacement.assetId,
				params: { height: 24 },
				seed: housePlacement.seed + 1
			}
		]);
		expect(handover.readStock(different, housePlacement.host)).toBeUndefined();
		expect(() => handover.serialize(different)).toThrow();
		const tampered = JSON.parse(handover.serialize(document)) as {
			format: string;
			sandbox: string;
			stock: unknown;
		};
		const parsedSandbox = JSON.parse(tampered.sandbox) as { stock: unknown[] };
		parsedSandbox.stock.push(parsedSandbox.stock[0]);
		tampered.sandbox = JSON.stringify(parsedSandbox);
		expect(() => handover.restore(JSON.stringify(tampered))).toThrow();
	}, 30_000);

	test('handover preserves split child parcel topology and station ground landmarks', () => {
		const flat = createCitySite(() => ({ height: 4, waterKind: null, waterClearance: Infinity }), {
			terrainRevision: () => 'flat-split/1'
		});
		const splitBase: CityGrowthRecipe = {
			...recipe,
			planFamily: 'square',
			carrierSizeM: 600,
			holdingsPerStep: 0
		};
		const largest = required(
			readCitySnapshot(createCityGrowth(flat, splitBase, seed)).holdings.toSorted(
				(a, b) => b.areaM2 - a.areaM2
			)[0],
			'largest founding holding'
		);
		const splitRun = advanceCityGrowth(
			createCityGrowth(
				flat,
				{
					...splitBase,
					stockChanges: [
						{ kind: 'retire', holdingId: largest.id, year: 1961 },
						{ kind: 'split', holdingId: largest.id, year: 1961 }
					]
				},
				seed
			),
			2030
		);
		const splitEvent = required(
			splitRun.events.find((event) => event.kind === 'holding-split'),
			'split event'
		);
		if (splitEvent.kind !== 'holding-split') throw Error('Expected holding split');
		const splitHandover = createSandboxHandover(splitRun);
		const splitRestored = splitHandover.restore(splitHandover.serialize(splitHandover.document));
		expect(
			splitHandover.world.resolveReference(
				{ v: 1, world: splitHandover.world.world.id, kind: 'parcel', key: largest.id },
				splitRestored
			).status
		).toBe('missing');
		for (const childId of splitEvent.childIds) {
			expect(
				splitHandover.world.resolveReference(
					{ v: 1, world: splitHandover.world.world.id, kind: 'parcel', key: childId },
					splitRestored
				).status
			).toBe('resolved');
		}

		const stationRun = advanceCityGrowth(
			createCityGrowth(
				createCitySite(undefined, { seed }),
				{ ...developmentRecipe, development: { crossingFromYear: 9999 } },
				seed
			),
			2030
		);
		const stationHandover = createSandboxHandover(stationRun);
		const sculpture = required(
			stationHandover.stock.assets.find(({ assetId }) => assetId === 'sculpture/cantilever-totem'),
			'station sculpture'
		);
		const restoredStation = stationHandover.restore(
			stationHandover.serialize(stationHandover.document)
		);
		const placed = required(
			restoredStation.readPlacement(sculpture.host),
			'restored ground sculpture placement'
		);
		expect(placed.assetId).toBe('sculpture/cantilever-totem');
		expect(stationHandover.readStock(restoredStation, sculpture.host)).toEqual(sculpture);
		expect(stationHandover.build(restoredStation, placed).anchors[0].position).toEqual(
			sculpture.anchor
		);
	}, 30_000);
});

test('low neighbor roof limits adjacent extensions to neighbor + 6 storeys while keeping existing floors', () => {
	const flat = createCitySite(() => ({ height: 7, waterKind: null, waterClearance: Infinity }));
	const input: CityGrowthRecipe = {
		...developmentRecipe,
		planFamily: 'square',
		carrierSizeM: 2200,
		holdingsPerStep: 5000,
		maximumActiveHoldings: 5004,
		development: { crossingFromYear: 9999, railFromYear: 9999 }
	};
	const expanded = advanceCityGrowth(createCityGrowth(flat, input, seed), 1960);
	const town = readCitySnapshot(expanded);
	const grid = readCityGrid(flat, input.carrierSizeM, 'square', seed).grid;
	const neighborsByCell = new Map(grid.cells.map(({ id, neighbors }) => [id, neighbors]));
	const byCell = new Map<string, string[]>();
	for (const holding of town.holdings) {
		for (const cell of holding.memberCellIds) {
			const list = byCell.get(cell) ?? [];
			list.push(holding.id);
			byCell.set(cell, list);
		}
	}
	const target = required(
		town.holdings.find(({ id, memberCellIds }) =>
			memberCellIds.some((cell) =>
				(neighborsByCell.get(cell) ?? []).some(
					(neighbor) =>
						neighbor !== null &&
						!memberCellIds.includes(neighbor) &&
						(byCell.get(neighbor) ?? []).some((otherId) => otherId !== id)
				)
			)
		),
		'holding with an occupied neighbor cell'
	);
	const capped = advanceCityGrowth(
		createCityGrowth(
			flat,
			{
				...input,
				stockChanges: [{ kind: 'extend', holdingId: target.id, year: 1961, storeys: 20 }]
			},
			seed
		),
		1961
	);
	const built = activeBuilding(readCitySnapshot(capped), target.id);
	const storeys = [
		...new Set(
			built.parts.filter(({ kind }) => kind === 'storey').map(({ datumIndex }) => datumIndex)
		)
	];
	// Neighbor stands at 2 storeys (initialStoreys); neighbor cap is 2 + 6 = 8 storeys.
	expect(storeys.length).toBeLessThanOrEqual(8);
	expect(storeys.length).toBeGreaterThan(2);
}, 30_000);

test('area-driven skyline caps new work and retains floors when occupied area contracts', () => {
	const flat = createCitySite(() => ({ height: 7, waterKind: null, waterClearance: Infinity }));
	const input: CityGrowthRecipe = {
		...developmentRecipe,
		planFamily: 'square',
		carrierSizeM: 2200,
		holdingsPerStep: 5000,
		maximumActiveHoldings: 5004,
		development: { crossingFromYear: 9999, railFromYear: 9999 }
	};
	const initial = createCityGrowth(flat, input, seed);
	const town = readCitySnapshot(advanceCityGrowth(initial, 1960));
	const { holdingId } = required(town.buildings[0], 'first town building');
	const retirements = town.buildings.flatMap((building) =>
		building.holdingId === holdingId
			? []
			: [{ kind: 'retire' as const, year: 1962, holdingId: building.holdingId }]
	);
	const run = advanceCityGrowth(
		createCityGrowth(
			flat,
			{
				...input,
				stockChanges: [
					{ kind: 'extend', holdingId, year: 1951, storeys: 20 },
					{ kind: 'extend', holdingId, year: 1961, storeys: 20 },
					...retirements,
					{ kind: 'extend', holdingId, year: 1963, storeys: 20 }
				]
			},
			seed
		),
		1963
	);
	const storeys = (year: number) => {
		const snapshot = readCitySnapshot(run, { kind: 'year', year });
		const building = activeBuilding(snapshot, holdingId);
		return [
			...new Set(
				building.parts.filter(({ kind }) => kind === 'storey').map(({ datumIndex }) => datumIndex)
			)
		];
	};
	expect(storeys(1951)).toHaveLength(2);
	expect(storeys(1961)).toHaveLength(6);
	expect(storeys(1963)).toEqual(storeys(1961));
	expect(readCitySnapshot(run).buildings).toHaveLength(1);
	const built = activeBuilding(readCitySnapshot(run, { kind: 'year', year: 1961 }), holdingId);
	const retained = activeBuilding(readCitySnapshot(run), holdingId);
	expect(retained.parts).toEqual(built.parts.map((part) => ({ ...part, phase: 'retained' })));
}, 30_000);
