import { expect, test } from 'bun:test';
import { example } from './example';
import { projectCityVolume } from './index';

test('assigns a planning surface to a metric hull whose canopy follows its base', () => {
	const { object, drawables } = example();
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
});

test('rejects an attempt to project a cell without a corresponding ground ring', () => {
	expect(() =>
		projectCityVolume({ cells: [{ id: 'missing', base: [], height: 6, edges: [] }] }, new Map(), {
			width: 2,
			depth: 2
		})
	).toThrow(/draped cell edges/);
});
