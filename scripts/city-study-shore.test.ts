import { expect, test } from 'bun:test';
import type { TerrainGrid } from '../src/lib/domain/terrain-grid';
import { cityPlanVariants, createCitySite, readCityGrid } from '../src/lib/world/city-site';
import { shoreFit, shoreMetrics } from './city-study-shore';
import { shoreStudySizeM } from './config/city-study';

const cases = [
	{ seed: 1201, relief: 0, runoff: 1 },
	{ seed: 42, relief: 0, runoff: 1 },
	{ seed: 42, relief: 0.75, runoff: 1.5 },
	{ seed: 42, relief: 1, runoff: 0.5 }
];

test('the organic lowland fixture exercises clipped shore cells', () => {
	const settings = cases[0];
	const city = createCitySite(undefined, settings);
	const layout = readCityGrid(city, shoreStudySizeM, 'organic', settings.seed);
	expect(shoreMetrics(layout, city.sampleGround).clipped).toBeGreaterThan(0);
});

test('measures the horizontal chord against the actual rendered route', () => {
	const plan: TerrainGrid = {
		identity: { scope: 'shore', variant: 'organic' },
		cells: [],
		boundary: [],
		vertices: [
			{ id: 'start', position: [0, 0, 0] },
			{ id: 'middle', position: [3, 4, 0] },
			{ id: 'midpoint', position: [3, 0, 0] },
			{ id: 'end', position: [6, 0, 0] }
		]
	};
	const route = {
		id: 'shore-crossing',
		heads: [
			{ nodeId: 'start', cellIds: [] },
			{ nodeId: 'end', cellIds: [] }
		],
		path: {
			nodeIds: ['start', 'middle', 'end'],
			edges: [
				{ id: 'a', from: 'start', to: 'middle' },
				{ id: 'b', from: 'middle', to: 'end' }
			],
			lengthM: 12
		}
	} as const;
	const { renderedStraightness } = shoreMetrics(
		{
			grid: plan,
			plan,
			selectedCrossings: [
				route,
				{
					...route,
					path: {
						nodeIds: ['start', 'midpoint', 'end'],
						edges: [
							{ id: 'c', from: 'start', to: 'midpoint' },
							{ id: 'd', from: 'midpoint', to: 'end' }
						],
						lengthM: 6
					}
				},
				{ ...route, span: { nodeIds: ['start', 'end'], lengthM: 5 } }
			]
		},
		() => {
			throw new Error('A crossing-only fixture has no ground cells');
		}
	);
	expect(renderedStraightness).toEqual([0.6, 1, 1]);
});

test('fails the shoreline gate if either target misses or no shoreline was measured', () => {
	const counts = { clipped: 6, occupiedShore: 10, shoreEdges: 10, alignedEdges: 4 };
	expect(shoreFit([counts]).pass).toBe(false);
	expect(shoreFit([{ ...counts, clipped: 2 }]).pass).toBe(false);
	expect(shoreFit([{ ...counts, alignedEdges: 8 }]).pass).toBe(false);
	expect(shoreFit([{ ...counts, clipped: 2, alignedEdges: 8 }]).pass).toBe(true);
	expect(shoreFit([]).pass).toBe(false);
});

for (const variant of cityPlanVariants) {
	test(`${variant} meets the shoreline fit targets across the terrain matrix`, () => {
		const rows = cases.map((settings) => {
			const city = createCitySite(undefined, settings);
			const layout = readCityGrid(city, shoreStudySizeM, variant, settings.seed);
			const row = shoreMetrics(layout, city.sampleGround);
			expect(row.occupiedShore).toBeGreaterThan(0);
			expect(row.shoreEdges).toBeGreaterThan(0);
			return row;
		});
		expect(shoreFit(rows)).toMatchObject({ unclippedTargetMet: true, alignedTargetMet: true });
	}, 30_000);
}
