import { expect, test } from 'bun:test';
import type { Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { dryPlanEdges, type TerrainGrid } from '../terrain-grid';
import { exampleGround, parcelExample } from './example';
import { createParcelPlan } from './index';

test('reserves half a 3 m walkway on each 60 m block at a four-way junction', () => {
	const input = exampleGround();
	const plan = createParcelPlan(input).read();
	expect(plan.blocks).toHaveLength(6);
	for (const block of plan.blocks) {
		expect(block.grossAreaM2).toBe(3600);
		expect(block.laneAreaM2).toBeCloseTo(351);
		expect(block.netGround[0][0]).toHaveLength(4);
	}
	const junction = plan.lanes.filter(({ points }) => points.some(([x, y]) => x === 60 && y === 60));
	expect(junction).toHaveLength(4);
	expect(junction.every(({ widthM, blockIds }) => widthM === 3 && blockIds.length === 2)).toBe(
		true
	);
	expect(parcelExample().lanes).toHaveLength(2);
});

function pairExample() {
	const input = exampleGround();
	const seam = required(
		input.lanes.find(({ edge }) => edge.cellIds.length === 2),
		'shared side'
	);
	const [a, b] = seam.edge.cellIds;
	return {
		input: { ...input, merges: [{ memberCellIds: [a, b] as const, plannedKind: 'plaza' }] },
		memberCellIds: [a, b],
		seam
	};
}

test('a two-cell holding hides its seam and reads as one whole block', () => {
	const { input, memberCellIds, seam } = pairExample();
	const prepared = createParcelPlan(input);
	const result = prepared.read(memberCellIds);
	expect(result.mergedUnits).toHaveLength(1);
	expect(result.blocks).toHaveLength(1);
	expect(result.parcels).toHaveLength(1);
	expect(result.parcels[0].publicUse).toBe(true);
	expect(result.portals[0].parcelId).toBe(result.parcels[0].id);
	expect(result.blocks[0].memberCellIds).toEqual([...memberCellIds].sort());
	expect(result.blocks[0].grossAreaM2).toBe(7200);
	expect(result.blocks[0].laneAreaM2).toBeCloseTo(531);
	expect(result.lanes.some(({ edgeId }) => edgeId === seam.edge.id)).toBe(false);
	expect(() => prepared.read(memberCellIds.slice(0, 1))).toThrow('selected whole');
	const full = prepared.read();
	expect(full.blocks.find(({ id }) => id === result.blocks[0].id)).toEqual(result.blocks[0]);
	expect(full.lanes.filter(({ id }) => result.lanes.some((lane) => lane.id === id))).toEqual([
		...result.lanes
	]);
});

test('preserves addresses, areas and incidence with rotated and reversed rings and reordered inputs', () => {
	const { input } = pairExample();
	const reversed = {
		...input.grid,
		vertices: [...input.grid.vertices].reverse(),
		cells: [...input.grid.cells].reverse().map((cell) => ({
			...cell,
			vertexIds: [...cell.vertexIds.slice(1), cell.vertexIds[0]].reverse()
		}))
	};
	const reorderedLanes = [...input.lanes].reverse().map((lane) => ({
		...lane,
		edge: { ...lane.edge, cellIds: [...lane.edge.cellIds].reverse() }
	}));
	expect(createParcelPlan({ ...input, grid: reversed, lanes: reorderedLanes }).read()).toEqual(
		createParcelPlan(input).read()
	);
});

test('stops a frontage cut at the first exit of a re-entrant eight-sided block', () => {
	const ring: readonly Vec2[] = [
		[0, 0],
		[60, 0],
		[60, 18],
		[22, 18],
		[22, 43],
		[60, 43],
		[60, 60],
		[0, 60]
	];
	const vertexIds = ring.map((_, i) => 'v/' + i);
	const grid: TerrainGrid = {
		vertices: ring.map(([x, y], i) => ({ id: vertexIds[i], position: [x, y, 0] })),
		cells: [{ id: 'exhibit', vertexIds, neighbors: vertexIds.map(() => null) }],
		boundary: vertexIds.map((from, i) => [from, vertexIds[(i + 1) % ring.length]])
	};
	const result = createParcelPlan({
		...exampleGround(),
		grid,
		lanes: dryPlanEdges(grid, grid).map((edge) => ({
			edge,
			widthM: 3,
			hierarchy: ['walkway'],
			surface: 'walk'
		})),
		plannedKinds: { exhibit: 'exhibit' },
		holdingRules: {
			exhibit: { minimumFrontageM: 3, partition: { targetAreaM2: 2000, minimumAreaM2: 100 } }
		}
	}).read();
	expect(result.parcels).toHaveLength(2);
	expect(
		result.parcels.some(({ outline }) => outline.some(([x, y]) => x === 30 && y === 16.5))
	).toBe(true);
	expect(
		result.parcels.every(({ outline }) => !outline.some(([x, y]) => x === 30 && y >= 43))
	).toBe(true);
	expect(result.portals.every(({ frontageM }) => frontageM >= 3)).toBe(true);
	expect(result.blocks[0].laneAreaM2 + result.blocks[0].accounting.parcelAreaM2).toBeCloseTo(
		2650,
		4
	);
});

test('connects an inset court to a public lane with a three-meter passage', () => {
	const input = exampleGround();
	const result = createParcelPlan({
		...input,
		holdingRules: {
			exhibit: {
				minimumFrontageM: 3,
				partition: { targetAreaM2: 320, minimumAreaM2: 100 },
				court: { insetM: 12, passageWidthM: 3 }
			}
		}
	}).read();
	for (const { courtFit, publicGround, accounting } of result.blocks) {
		expect(courtFit).toBe('fit');
		expect(accounting.courtAreaM2).toBeCloseTo(1089);
		expect(accounting.passageAreaM2).toBeCloseTo(36);
		expect(publicGround.entrance?.frontageM).toBe(3);
		expect(result.lanes.some(({ id }) => id === publicGround.entrance?.laneId)).toBe(true);
	}
});

test('parcel policy is fixed before either of two blocks is read', () => {
	const { grid, lanes, plannedKinds } = exampleGround();
	const [first, second] = grid.cells.map(({ id }) => id);
	const partition = { targetAreaM2: 1400, minimumAreaM2: 100 };
	const court = { insetM: 12, passageWidthM: 3 };
	const rule = { minimumFrontageM: 3, partition, court };
	const tolerance = {
		linearToleranceM: 0.000001,
		areaToleranceM2: 0.01,
		relativeAreaToleranceRatio: 1e-8
	};
	const input = { grid, lanes, plannedKinds, holdingRules: { exhibit: rule }, tolerance };
	const expected = createParcelPlan(input).read([first, second]);
	const forward = createParcelPlan(input);
	const reverse = createParcelPlan(input);
	forward.read([first]);
	reverse.read([second]);

	partition.targetAreaM2 = 3600;
	court.insetM = 40;
	rule.minimumFrontageM = 100;
	tolerance.linearToleranceM = 0.01;
	forward.read([second]);
	reverse.read([first]);

	expect(forward.read([first, second])).toEqual(expected);
	expect(reverse.read([second, first])).toEqual(expected);
});
