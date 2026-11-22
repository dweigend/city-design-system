import { expect, test } from 'bun:test';
import type { Vec3 } from '../../core/geometry';
import { example } from './example';
import { projectCityVolume } from './index';

test('assigns a planning surface to a metric hull whose canopy follows its base', () => {
	const { object, drawables, heightDrawables } = example();
	expect(object.parts.map(({ id, slot }) => [id, slot])).toEqual([['cell', 'volume']]);
	const { shape } = object.parts[0];
	if (shape.kind !== 'mesh') throw new Error('Expected an indexed hull');
	expect(shape.positions.slice(0, 12)).toEqual([0, 0, 1, 2, 0, 1, 2, 2, 2, 0, 2, 2]);
	expect(shape.positions.slice(12, 24)).toEqual([0, 0, 7, 2, 0, 7, 2, 2, 8, 0, 2, 8]);
	expect(shape.indices).toHaveLength(36);
	expect(drawables[0]).toMatchObject({
		finish: 'glass',
		color: '--blueprint-3',
		opacity: '--alpha-hull'
	});
	expect(drawables[0].strokeSegments).toHaveLength(48);
	expect(heightDrawables[0]).toMatchObject({
		finish: 'glass',
		color: '--blueprint-3',
		opacity: '--alpha-glass'
	});
	expect(heightDrawables[0].shape).toBe(drawables[0].shape);
	expect(heightDrawables[0].strokeSegments).toBe(drawables[0].strokeSegments);
});

test('rejects an attempt to project a cell without a corresponding ground ring', () => {
	expect(() =>
		projectCityVolume({ cells: [{ id: 'missing', base: [], height: 6, edges: [] }] }, new Map(), {
			width: 2,
			depth: 2
		})
	).toThrow(/draped cell edges/);
});

function sharedWall(leftHeight: number, rightHeight: number) {
	const left = [
		[0, 0, 0],
		[2, 0, 1],
		[2, 2, 1],
		[0, 2, 0]
	] as const;
	const right = [
		[2, 0, 1],
		[4, 0, 2],
		[4, 2, 2],
		[2, 2, 1]
	] as const;
	const difference = rightHeight - leftHeight;
	const cells = [
		{
			id: 'left',
			base: left,
			height: leftHeight,
			edges: [null, { id: 'right', heightDifference: difference }, null, null]
		},
		{
			id: 'right',
			base: right,
			height: rightHeight,
			edges: [null, null, null, { id: 'left', heightDifference: -difference }]
		}
	];
	const edges = new Map([
		['left', left.map((point) => [point] as readonly Vec3[])],
		['right', right.map((point) => [point] as readonly Vec3[])]
	]);
	const { object } = projectCityVolume({ cells }, edges, { width: 4, depth: 2 });
	return object.parts.map(({ shape }) => {
		if (shape.kind !== 'mesh') throw new Error('Expected an indexed hull');
		const walls: number[] = [];
		for (let i = 0; i < shape.indices.length; i += 3) {
			const indices = shape.indices.slice(i, i + 3).map((index) => index * 3);
			if (indices.every((index) => shape.positions[index] === 2))
				walls.push(...indices.map((index) => shape.positions[index + 2]));
		}
		return walls;
	});
}

test('omits walls at equal height and draws only the higher cell above the lower roof', () => {
	expect(sharedWall(6, 6)).toEqual([[], []]);
	expect(sharedWall(9, 3)).toEqual([[4, 4, 10, 4, 10, 10], []]);
	expect(sharedWall(3, 9)).toEqual([[], [4, 4, 10, 4, 10, 10]]);
});
