import { expect, test } from 'bun:test';
import { bounds, move, PlaceableObject, type Part, type Shape } from './index';
import { example } from './example';

const box = { kind: 'box', center: [2, 3, 1], size: [4, 2, 2], rotation: Math.PI / 2 } as const;
const prism = {
	kind: 'prism',
	polygon: [
		[4, 5],
		[6, 5],
		[5, 8]
	],
	base: 3,
	top: 7
} as const;
const mesh = {
	kind: 'mesh',
	positions: [0, 0, 0, 2, 0, 5, 0, 2, 1, 90, 90, 90],
	indices: [0, 1, 2]
} as const;

function objectWith(shape: Shape) {
	return PlaceableObject.create({
		id: 'test-object',
		slots: ['body'],
		parts: [{ id: 'body', slot: 'body', shape }],
		footprint: { width: 4, depth: 2 },
		anchors: [{ name: 'joint', position: [2, 3, 1], normal: [1, 0, 0] }]
	});
}

test('requires unique part ids and declared slots', () => {
	const object = objectWith(box);
	expect(() =>
		PlaceableObject.create({ ...object, parts: [...object.parts, ...object.parts] })
	).toThrow(/Duplicate part id/);
	expect(() => PlaceableObject.create({ ...object, slots: [] })).toThrow(/Undeclared part slot/);
});

const invalidShapes: readonly Shape[] = [
	{ ...box, center: [NaN, 0, 0] },
	{ ...box, size: [1, Infinity, 1] },
	{ ...box, size: [-1, 2, 3] },
	{ ...box, rotation: -Infinity },
	{ ...prism, base: NaN },
	{ ...prism, top: Infinity },
	{ ...prism, top: 1 },
	{
		...prism,
		polygon: [
			[4, 5],
			[6, 5]
		]
	},
	{
		...prism,
		polygon: [
			[4, 5],
			[6, 5],
			[5, Infinity]
		]
	},
	{ ...mesh, positions: [NaN, ...mesh.positions.slice(1)] },
	{ ...mesh, positions: mesh.positions.slice(1) },
	{ ...mesh, indices: [] },
	{ ...mesh, indices: [0, 1] },
	{ ...mesh, indices: [0, 1, 0] },
	{ ...mesh, indices: [0, 1, 4] },
	{ ...mesh, indices: [0, 1, -1] },
	{ ...mesh, indices: [0, 1, 1.5] },
	{ ...mesh, indices: [0, 1, Infinity] }
];

test.each(invalidShapes.map((shape): [Shape] => [shape]))('rejects invalid shape %j', (shape) => {
	expect(() => objectWith(shape)).toThrow(RangeError);
});

test('requires finite dimensions and anchor coordinates, and unit normals', () => {
	const object = objectWith(box);
	for (const footprint of [
		{ width: NaN, depth: 1 },
		{ width: 1, depth: -Infinity },
		{ width: 1, depth: -2 }
	])
		expect(() => PlaceableObject.create({ ...object, footprint })).toThrow(RangeError);
	const anchor = object.anchors[0];
	const invalidAnchors = [
		{ ...anchor, position: [0, 1, Infinity] as const },
		{ ...anchor, normal: [NaN, 0, 1] as const },
		{ ...anchor, normal: [0, 0, 0] as const },
		{ ...anchor, normal: [2, 0, 0] as const }
	];
	for (const invalid of invalidAnchors)
		expect(() => PlaceableObject.create({ ...object, anchors: [invalid] })).toThrow(RangeError);
});

test('bounds each shape in world space and ignores unused mesh vertices', () => {
	const rotated = bounds(objectWith(box));
	expect(rotated.min[0]).toBeCloseTo(1);
	expect(rotated.max[0]).toBeCloseTo(3);
	expect(rotated.min.slice(1)).toEqual([1, 0]);
	expect(rotated.max.slice(1)).toEqual([5, 2]);
	expect(bounds(objectWith(prism))).toEqual({ min: [4, 5, 3], max: [6, 8, 7] });
	expect(bounds(objectWith(mesh))).toEqual({ min: [0, 0, 0], max: [2, 2, 5] });
	expect(bounds(example())).toEqual({ min: [-3.24, -2.24, 0], max: [3.24, 2.24, 4.6] });
	expect(() => bounds(PlaceableObject.create({ ...objectWith(box), parts: [] }))).toThrow(
		RangeError
	);
});

test('moves each shape and its anchors together, preserving ids, slots, part order and footprint', () => {
	const house = example();
	const moved = move(house, [8, 10, 5], Math.PI / 2);
	expect(moved.id).toBe(house.id);
	expect(moved.slots).toEqual(house.slots);
	expect(moved.footprint).toEqual(house.footprint);
	expect(moved.parts.map(({ id, slot }) => ({ id, slot }))).toEqual(
		house.parts.map(({ id, slot }) => ({ id, slot }))
	);
	expect(moved.parts[0].shape).toEqual({
		kind: 'box',
		center: [8, 10, 5.12],
		size: [6.3, 4.3, 0.24],
		rotation: Math.PI / 2
	});
	const { shape } = moved.parts[2];
	const originalRoof = house.parts[2].shape;
	if (shape.kind !== 'mesh' || originalRoof.kind !== 'mesh')
		throw new Error('Expected the gable roof mesh');
	expect(shape.indices).toEqual(originalRoof.indices);
	expect(shape.positions.slice(6, 9)).toEqual([8, 6.76, 9.6]);
	expect(moved.anchors.map(({ name, position }) => ({ name, position }))).toEqual([
		{ name: 'entry', position: [10, 10, 5] },
		{ name: 'ridge', position: [8, 10, 9.6] }
	]);
	expect(moved.anchors[0].normal[0]).toBeCloseTo(1);
	expect(moved.anchors[0].normal[1]).toBeCloseTo(0);
	expect(moved.anchors[1].normal).toEqual([0, 0, 1]);
	expect(move(objectWith(prism), [0, 0, 5], 0).parts[0].shape).toEqual({
		...prism,
		base: prism.base + 5,
		top: prism.top + 5
	});
	expect(() => move(house, [0, Infinity, 0], 0)).toThrow(RangeError);
	expect(() => move(house, [0, 0, 0], NaN)).toThrow(RangeError);
});

function expectFrozen(value: unknown): void {
	if (value === null || typeof value !== 'object') return;
	expect(Object.isFrozen(value)).toBe(true);
	for (const child of Object.values(value)) expectFrozen(child);
}

test('creates and moves detached objects without mutating or freezing inputs', () => {
	const input = structuredClone(example());
	const original = structuredClone(input);
	const object = PlaceableObject.create(input);
	expect(input).toEqual(original);
	expect(Object.isFrozen(input.parts[1].shape)).toBe(false);
	expect(object.parts[1].shape).not.toBe(input.parts[1].shape);
	expectFrozen(object);
	const moved = move(input, [1, 0, 0], 0);
	expect(input).toEqual(original);
	expectFrozen(moved);
});

test('geometry excludes appearance fields in its type and source', async () => {
	const part: Part = {
		id: 'part',
		slot: 'wall',
		shape: box,
		// @ts-expect-error A part has no appearance fields.
		color: 'example'
	};
	expect(part.shape).toBe(box);

	const colorLiteral = /['"`](?:#[\da-f]{3,8}\b|(?:rgb|hsl)a?\(|--)/i;
	const sources = new Bun.Glob('*.ts');
	for await (const file of sources.scan(import.meta.dir)) {
		if (file.endsWith('.test.ts')) continue;
		const source = await Bun.file(`${import.meta.dir}/${file}`).text();
		expect(source).not.toMatch(colorLiteral);
	}
});
