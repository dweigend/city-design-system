import { expect, test } from 'bun:test';
import {
	cityPlanVariants,
	citySiteParams,
	createCitySite,
	readCityDistricts,
	readCityGrid,
	readCityParcels
} from './index';

test('reuses only carrier-issued parcel selections from the same site and revision', () => {
	let revision = 'first';
	const site = createCitySite(undefined, { terrainRevision: () => revision });
	const peer = createCitySite();
	const size = citySiteParams.citySize.min;
	const layout = readCityGrid(site, size);
	const first = readCityParcels(site, layout);
	expect(readCityParcels(site, layout)).toBe(first);
	expect(Object.isFrozen(first)).toBe(true);

	const copied = { ...layout.growth, rankedCellIds: [...layout.growth.rankedCellIds] };
	expect(readCityParcels(site, { ...layout, growth: copied })).toEqual(first);
	copied.rankedCellIds.length = 0;
	expect(readCityParcels(site, { ...layout, growth: copied }).parcels).toEqual([]);
	const peerHoldings = readCityParcels(peer, layout);
	expect(peerHoldings).toEqual(first);
	expect(peerHoldings).not.toBe(first);

	revision = 'second';
	const updated = readCityGrid(site, size);
	const second = readCityParcels(site, updated);
	expect(second).toEqual(first);
	expect(second).not.toBe(first);
	expect(readCityParcels(site, updated)).toBe(second);
}, 20_000);

test('publishes whole holdings through both density thresholds on all seven plan grids', () => {
	const seed = citySiteParams.seed.default;
	for (const grid of cityPlanVariants) {
		const site = createCitySite(undefined, { seed, relief: 0, runoff: 1 });
		const steps = [600, 1400, 1600, 3200, 3400, 7000].map((size) =>
			readCityGrid(site, size, grid, seed)
		);
		const districts = new Set(steps.map((layout) => readCityDistricts(site, layout).settlement));
		expect(districts).toEqual(new Set(['village', 'town', 'city']));
		expect(steps[0].crossings.length).toBeLessThan(steps[steps.length - 1].crossings.length);
		const plans = steps.map((layout) => readCityParcels(site, layout));
		for (const [index, smaller] of plans.slice(0, -1).entries()) {
			const larger = plans[index + 1];
			function check<T extends { id: string }>(before: readonly T[], after: readonly T[]) {
				const next = new Map(after.map((record) => [record.id, record]));
				expect(
					before.filter((record) => JSON.stringify(record) !== JSON.stringify(next.get(record.id)))
				).toEqual([]);
			}
			check(smaller.lanes, larger.lanes);
			check(smaller.blocks, larger.blocks);
			check(smaller.parcels, larger.parcels);
			check(smaller.portals, larger.portals);
		}
		for (const [index, layout] of steps.entries()) {
			const plan = plans[index];
			const nodes = new Set(plan.lanes.flatMap(({ nodeIds }) => nodeIds));
			const lanes = new Set(plan.lanes.map(({ id }) => id));
			expect(
				layout.crossings.flatMap(({ heads }) => heads).every(({ nodeId }) => nodes.has(nodeId))
			).toBe(true);
			expect(
				plan.portals.every(({ laneId, frontageM }) => lanes.has(laneId) && frontageM >= 3)
			).toBe(true);
			expect(plan.portals.length).toBe(plan.parcels.length);
		}
	}
}, 120_000);
