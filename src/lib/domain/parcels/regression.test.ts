import { expect, test } from 'bun:test';
import type { Vec2 } from '../../core/geometry';
import { dryPlanEdges, planEdgeId, type TerrainGrid } from '../terrain-grid';
import { intersect, polygonArea, subtract } from './geometry';
import { createParcelPlan, type HoldingRule, type ParcelPlanInput } from './index';

const partition = { minimumAreaM2: 5, targetAreaM2: 44 };

function input(
	ring: readonly Vec2[],
	program: HoldingRule,
	widthM: number,
	laneSide = 0
): ParcelPlanInput {
	const vertexIds = ring.map((_, i) => 'v|' + i);
	const grid: TerrainGrid = {
		vertices: ring.map(([x, y], i) => ({ id: vertexIds[i], position: [x, y, 0] })),
		cells: [{ id: 'holding', vertexIds, neighbors: vertexIds.map(() => null) }],
		boundary: []
	};
	const side = planEdgeId(vertexIds[laneSide], vertexIds[(laneSide + 1) % vertexIds.length]);
	return {
		grid,
		lanes: dryPlanEdges(grid, grid)
			.filter(({ id }) => id === side)
			.map((edge) => ({
				edge,
				widthM,
				surface: 'walk',
				hierarchy: ['local']
			})),
		plannedKinds: { holding: 'test' },
		holdingRules: { test: program },
		tolerance: {
			linearToleranceM: 0.000001,
			areaToleranceM2: 0.01,
			relativeAreaToleranceRatio: 1e-8
		}
	};
}

test('rejects a frontage cut that touches a re-entrant notch tip', () => {
	const plan = createParcelPlan(
		input(
			[
				[0, 0],
				[10, 0],
				[10, 10],
				[0, 10],
				[0, 7],
				[5, 5],
				[0, 3]
			],
			{ minimumFrontageM: 2, partition },
			2
		)
	).read();
	expect(plan.parcels.map(({ areaM2 }) => areaM2)).toEqual([80]);
	expect(plan.portals).toHaveLength(1);
});

test('a lane on the inner wall of a U reserves ground only on its own arm', () => {
	const settings = input(
		[
			[0, 0],
			[10, 0],
			[10, 10],
			[7, 10],
			[7, 3],
			[6, 3],
			[6, 10],
			[0, 10]
		],
		{ minimumFrontageM: 2 },
		4,
		3
	);
	const block = createParcelPlan(settings).read().blocks[0];
	const opposite = [
		[
			[5, 3],
			[6, 3],
			[6, 10],
			[5, 10]
		]
	] as const;
	const overlap = block.laneGround.flatMap((polygon) =>
		intersect(polygon, opposite, settings.tolerance.linearToleranceM)
	);
	expect(overlap).toHaveLength(0);
	expect(block.laneAreaM2).toBeCloseTo(14);
});

test('clips a court passage against a shallow notch while keeping both full-width ends', () => {
	const settings = input(
		[
			[0, 0],
			[40, 0],
			[40, 40],
			[0, 40],
			[0, 3],
			[18.004, 3],
			[18.004, 2],
			[0, 2]
		],
		{ minimumFrontageM: 3, partition, court: { insetM: 8, passageWidthM: 4 } },
		2
	);
	const block = createParcelPlan(settings).read().blocks[0];
	const { publicGround, netGround } = block;
	expect(block.courtFit).toBe('fit');
	expect(publicGround.entrance?.frontageM).toBe(4);
	const outside = publicGround.passage.flatMap((polygon) =>
		subtract(polygon, netGround, settings.tolerance.linearToleranceM)
	);
	expect(outside.reduce((sum, polygon) => sum + polygonArea(polygon), 0)).toBeCloseTo(0, 5);
});

test('assigns an undersized initial component to open public ground', () => {
	const plan = createParcelPlan(
		input(
			[
				[0, 0],
				[30, 0],
				[30, 1.1],
				[0, 1.1]
			],
			{ minimumFrontageM: 3, partition },
			2
		)
	).read();
	expect(plan.parcels).toHaveLength(0);
	expect(plan.portals).toHaveLength(0);
	expect(plan.blocks[0].accounting.openAreaM2).toBeCloseTo(3);
});

test('combines overlapping lane reservations in either order', () => {
	const settings = input(
		[
			[0, 0],
			[30, 0],
			[30, 30],
			[0, 30]
		],
		{ minimumFrontageM: 3 },
		3
	);
	const [local] = settings.lanes;
	const promenade = { ...local, widthM: 6, hierarchy: ['promenade'], surface: 'stairs' } as const;
	const combined = createParcelPlan({ ...settings, lanes: [local, promenade] }).read();
	expect(createParcelPlan({ ...settings, lanes: [promenade, local] }).read()).toEqual(combined);
	expect(combined.lanes[0]).toMatchObject({
		widthM: 6,
		hierarchy: ['local', 'promenade'],
		surface: 'stairs'
	});
	expect(combined.blocks[0].laneAreaM2).toBeCloseTo(90);
});
