import { expect, test } from 'bun:test';
import { cityPlanVariants } from '../../domain/city-volume';
import {
	citySiteParams,
	createCitySite,
	readCityDistricts,
	readCityGrid,
	readCityParcels
} from './index';

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
