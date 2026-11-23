import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
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
