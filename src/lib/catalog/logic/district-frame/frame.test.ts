// @ts-expect-error Bun provides its test API at runtime.
import { expect, test } from 'bun:test';
import { districtFrame } from './index';

const a = [2, 0, 4] as const,
	b = [3, 5, 6] as const;
const triangle = {
	id: 'left',
	district: 'slope',
	form: 'house',
	neighbors: ['right', null, null],
	vertexIds: ['a', 'b', 'c'],
	corners: [a, b, [0, 2, 3]] as const
};
const pentagon = {
	id: 'right',
	district: 'slope',
	form: 'house',
	neighbors: ['left', null, null, null, null],
	vertexIds: ['b', 'a', 'd', 'e', 'f'],
	corners: [b, a, [5, -1, 4], [7, 2, 5], [6, 5, 6]] as const
};
const cells = new Map<string, typeof triangle | typeof pentagon>([
	['left', triangle],
	['right', pentagon]
]);

test('both sides of a sloping shared seam yield one canonical axis in metres', () => {
	const left = districtFrame(['left'], cells, cells);
	expect(left).toEqual(districtFrame(['right', 'left'], cells, cells));
	expect(left).toEqual([
		{
			id: '["a","b"]',
			vertices: ['a', 'b'],
			axis: [a, b],
			role: 'gap',
			reason: 'houses',
			nominalDiameter: 0
		}
	]);
});

test('district density can open a seam between protected houses without changing occupancy', () => {
	const policy = {
		seed: 9,
		city: { secondaryDensity: 1 },
		districts: new Map([['slope', { secondaryDensity: 0 }]])
	};
	const state = new Map([...cells].map(([id, c]) => [id, { ...c, protected: true }]));
	expect(districtFrame(['right'], state, cells, new Set(), policy)[0]).toMatchObject({
		role: 'gap',
		reason: 'density',
		nominalDiameter: 0
	});
	expect(state.get('left')?.form).toBe('house');
});

test('a passage keeps an opening across districts and mismatched reciprocal geometry fails atomically', () => {
	const state = new Map(cells);
	state.set('right', { ...pentagon, district: 'civic', form: 'passage' });
	expect(districtFrame(['left'], state, cells)[0]).toMatchObject({
		role: 'gap',
		reason: 'passage'
	});
	const broken = new Map(cells);
	broken.set('right', { ...pentagon, vertexIds: ['z', 'a', 'd', 'e', 'f'] });
	expect(() => districtFrame(['left'], state, broken)).toThrow(RangeError);
});
