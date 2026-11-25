import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { createCatalog } from '../../core/catalog';
import { bounds } from '../../core/object';
import {
	createCellSpace,
	parcelEdgeId,
	type CellSubgridGenerator,
	type Parcel
} from '../../domain/cell-space';
import {
	buildAsset,
	buildAssetResult,
	InvalidAssetParamsError,
	listAssets,
	readAsset,
	UnknownAssetError,
	validateAssetHost,
	WrongAssetHostError
} from './index';
import { placementsExample } from './example';

const parcel: Parcel = {
	id: 'metric-plot',
	corners: [
		{ id: 'a', position: [4, 7] },
		{ id: 'b', position: [20, 7] },
		{ id: 'c', position: [20, 23] },
		{ id: 'd', position: [4, 23] }
	],
	frontage: [parcelEdgeId('a', 'b')],
	baseZ: 3,
	storeyCount: 10
};
const host = { kind: 'parcel', parcel } as const;
const id = 'house/court-neutral';

test('lists and filters static definitions, with no mutable registration data exposed', () => {
	expect(listAssets({ kind: 'house' }).map(({ id }) => id)).toEqual([
		id,
		'house/court-memphis',
		'house/court-archigram',
		'house/court-organic'
	]);
	expect(listAssets({ kind: 'house', tags: ['court', 'neutral'] })).toEqual([readAsset(id)]);
	expect(listAssets({ kind: 'house', tags: ['court', 'missing'] })).toEqual([]);
	expect(listAssets({ kind: 'missing' })).toEqual([]);
	expect(Object.isFrozen(readAsset(id).params.height)).toBe(true);
});

test('names ID, host and parameter failures independently', () => {
	expect(() => readAsset('missing')).toThrow(UnknownAssetError);
	expect(() => buildAsset('missing', host, {}, 1)).toThrow(UnknownAssetError);
	expect(() => buildAsset(id, { kind: 'ground', point: [0, 0, 0] }, {}, 1)).toThrow(
		WrongAssetHostError
	);
	const invalidParams: unknown[] = [{ color: 1 }, { height: NaN }, { height: '1' }, null, []];
	for (const params of invalidParams) {
		expect(() => buildAsset(id, host, params as Record<string, number>, 1)).toThrow(
			InvalidAssetParamsError
		);
	}
	expect(() => buildAsset(id, host, {}, 0.5)).toThrow(InvalidAssetParamsError);
});

test('every court house builds at its defaults and every combination of bounds', () => {
	const space = { kind: 'cell-space', space: createCellSpace(parcel) } as const;
	for (const { id, params } of listAssets({ kind: 'house' })) {
		const limits = Object.entries(params).reduce<Record<string, number>[]>(
			(rows, [key, { min, max }]) =>
				rows.flatMap((row) => [
					{ ...row, [key]: min },
					{ ...row, [key]: max }
				]),
			[{}]
		);
		for (const overrides of [{}, ...limits]) {
			const object = buildAsset(id, host, overrides, 42);
			expect(object).toEqual(buildAsset(id, space, overrides, 42));
			expect(object.parts.length).toBeGreaterThan(0);
			expect(object.footprint).toEqual({ width: 16, depth: 16 });
			expect(bounds(object).min[2]).toBeLessThanOrEqual(parcel.baseZ);
			expect(object.anchors.map(({ name }) => name)).toContain('entrance');
			for (const part of object.parts) {
				expect(object.slots).toContain(part.slot);
				expect(JSON.stringify(part)).not.toMatch(
					/"(?:colou?r|material|finish|token)"|#[a-f\d]{3,8}\b|(?:rgb|hsl)a?\(/i
				);
			}
		}
	}
});

test('builds a house through the subgrid registered for its parcel host', () => {
	const subgridCatalog = createCatalog<CellSubgridGenerator>({
		rows: [
			{
				id: 'coarse-quad',
				create: (parcel, { refinementRounds }) => createCellSpace(parcel, refinementRounds)
			}
		]
	});
	const selected = buildAsset(
		id,
		{
			...host,
			subgridId: 'coarse-quad',
			subgridOptions: { refinementRounds: 0 },
			subgridCatalog
		},
		{},
		42
	);
	expect(selected).toEqual(
		buildAsset(id, { kind: 'cell-space', space: createCellSpace(parcel, 0) }, {}, 42)
	);
});

test('replays three JSON placements into identical objects', () => {
	const { records, restored, original, rebuilt } = placementsExample();
	expect(original).toHaveLength(3);
	expect(restored).toEqual(records);
	expect(rebuilt).toEqual(original);
	// Full placeable objects built from these saved addresses, model houses of #91.
	expect(
		rebuilt.map((object) => createHash('sha256').update(JSON.stringify(object)).digest('hex'))
	).toEqual([
		'dedfb22543e7da9db986a9a7e32bf0a5608b3557fcba12d67125cdc0c1041b18',
		'2971657b1a799ae384af327ee99ccf8abc2ce1eea24b6c016f81498a05f741f2',
		'b4dde4b8b5178aacd93ff8f35199e2b7ef85e207c0871db3a7f61ecd9edf0c81'
	]);
});

test('rejects a stair asset on an otherwise valid flat plan edge', () => {
	const flat = {
		kind: 'plan-edge',
		id: 'flat',
		points: [
			[0, 0, 0],
			[20, 0, 0]
		]
	} as const;
	expect(() => buildAsset('access/stair', flat, {}, 0)).toThrow(/inclined run/);
});

test.each([
	{ points: [[0, 0, 0]], error: 'Expected a resolved graph edge' },
	{
		points: [
			[0, 0, 0],
			[0, 0, 2]
		],
		error: 'Invalid track direction'
	}
] as const)('platform validation and build reject the same invalid edge', ({ points, error }) => {
	const edge = { kind: 'graph-edge', id: 'alignment', points } as const;
	expect(() => validateAssetHost('rail/platform', edge)).toThrow(error);
	expect(() => buildAsset('rail/platform', edge, {}, 1)).toThrow(error);
});

test('platform validation and build accept a horizontal edge', () => {
	const edge = {
		kind: 'graph-edge',
		id: 'alignment',
		points: [
			[2, 3, 1],
			[12, 3, 1]
		]
	} as const;
	expect(() => validateAssetHost('rail/platform', edge)).not.toThrow();
	const object = buildAsset('rail/platform', edge, {}, 1);
	expect(object.anchors[0].position).toEqual([2, 3, 1]);
});

test('replays a three-role model grove within the parcel and triangle budget', () => {
	const id = 'park/grove';
	expect(listAssets({ kind: 'park' })).toEqual([readAsset(id)]);
	expect(readAsset(id).hostKinds).toEqual(['parcel']);
	const grove = buildAsset(id, host, { density: 6, height: 8 }, 42);
	expect(grove).toEqual(buildAsset(id, host, { density: 6, height: 8 }, 42));
	expect(grove).not.toEqual(buildAsset(id, host, { density: 6, height: 8 }, 43));
	expect(grove.parts.map(({ slot }) => slot)).toEqual(['lawn', 'trunk', 'canopy']);
	const extent = bounds(grove);
	expect(extent.min).toEqual([4, 7, 3]);
	expect(extent.max.slice(0, 2)).toEqual([20, 23]);
	const triangles = grove.parts
		.flatMap(({ shape }) => (shape.kind === 'mesh' ? [shape.indices.length / 3] : []))
		.reduce((total, count) => total + count, 0);
	const sparse = buildAsset(id, host, { density: 2, height: 8 }, 42);
	expect(sparse.parts[2].shape).not.toEqual(grove.parts[2].shape);
	expect(triangles).toBeGreaterThan(90);
	expect(triangles).toBeLessThan(400);
	expect(() => buildAsset(id, host, { width: 4 }, 42)).toThrow(InvalidAssetParamsError);
});

test('grove lawn and trees leave a hole in a complex holding', () => {
	const grove = buildAsset(
		'park/grove',
		{
			kind: 'parcel',
			parcel: {
				id: 'court',
				outline: [
					[0, 0],
					[40, 0],
					[40, 40],
					[0, 40]
				]
			},
			groundAt: ([x]) => x / 20,
			holes: [
				[
					[10, 10],
					[10, 30],
					[30, 30],
					[30, 10]
				]
			]
		},
		{},
		19
	);
	const lawn = grove.parts.find(({ slot }) => slot === 'lawn')?.shape;
	if (lawn?.kind !== 'mesh') throw new Error('Expected a grove lawn mesh');
	let area = 0;
	for (let i = 0; i < lawn.indices.length; i += 3) {
		const [a, b, c] = lawn.indices.slice(i, i + 3).map((vertex) => 3 * vertex);
		const [ax, ay] = lawn.positions.slice(a, a + 2);
		const [bx, by] = lawn.positions.slice(b, b + 2);
		const [cx, cy] = lawn.positions.slice(c, c + 2);
		area += ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2;
	}
	expect(area).toBe(1200);
	for (const { slot, shape } of grove.parts) {
		if (slot === 'lawn' || shape.kind !== 'mesh') continue;
		for (let i = 0; i < shape.positions.length; i += 3) {
			const [x, y] = shape.positions.slice(i, i + 2);
			expect(x > 10 && x < 30 && y > 10 && y < 30).toBe(false);
		}
	}
});

test('grove seats trees on the triangulated lawn above an interior terrain depression', () => {
	const grove = buildAsset(
		'park/grove',
		{
			kind: 'parcel',
			parcel: {
				id: 'bowl',
				outline: [
					[0, 0],
					[30, 0],
					[30, 30],
					[0, 30]
				]
			},
			groundAt: ([x, y]) => (x > 1 && x < 29 && y > 1 && y < 29 ? 0 : 10)
		},
		{ density: 8, height: 8 },
		7
	);
	const trunk = grove.parts.find(({ slot }) => slot === 'trunk')?.shape;
	const canopy = grove.parts.find(({ slot }) => slot === 'canopy')?.shape;
	if (trunk?.kind !== 'mesh' || canopy?.kind !== 'mesh')
		throw new Error('Expected trunk and canopy meshes');
	expect(trunk.positions.length).toBeGreaterThan(0);
	for (let i = 2; i < trunk.positions.length; i += 3)
		expect(trunk.positions[i]).toBeGreaterThanOrEqual(10);
	for (let i = 2; i < canopy.positions.length; i += 3)
		expect(canopy.positions[i]).toBeGreaterThan(10);
});

test('grove host validation rejects outside, intersecting, overlapping, nested and enclosing holes', () => {
	const outline = [
		[0, 0],
		[40, 0],
		[40, 40],
		[0, 40]
	] as const;
	const invalidHoles = [
		// Disjoint hole outside the parcel.
		[
			[
				[50, 50],
				[60, 50],
				[60, 60],
				[50, 60]
			]
		],
		// Hole crossing the outer boundary.
		[
			[
				[30, 10],
				[50, 10],
				[50, 30],
				[30, 30]
			]
		],
		// Overlapping holes.
		[
			[
				[4, 4],
				[18, 4],
				[18, 18],
				[4, 18]
			],
			[
				[12, 12],
				[26, 12],
				[26, 26],
				[12, 26]
			]
		],
		// Nested holes.
		[
			[
				[4, 4],
				[26, 4],
				[26, 26],
				[4, 26]
			],
			[
				[10, 10],
				[20, 10],
				[20, 20],
				[10, 20]
			]
		],
		// Hole enclosing the parcel.
		[
			[
				[-10, -10],
				[50, -10],
				[50, 50],
				[-10, 50]
			]
		]
	] as const;
	for (const holes of invalidHoles) {
		const invalidHost = {
			kind: 'parcel',
			parcel: { id: 'bad', outline },
			groundAt: () => 0,
			holes
		} as const;
		expect(() => validateAssetHost('park/grove', invalidHost)).toThrow(RangeError);
		expect(() => buildAsset('park/grove', invalidHost, {}, 1)).toThrow(RangeError);
	}
});

test('builds three static ground sculptures with complete material roles and deterministic variation', () => {
	const point = [12, -7, 3] as const;
	const ground = { kind: 'ground', point } as const;
	const assets = listAssets({ kind: 'sculpture' });
	expect(assets.map(({ id }) => id)).toEqual([
		'sculpture/portal-arch',
		'sculpture/cantilever-totem',
		'sculpture/plaza-canopy'
	]);
	const { sculptures } = placementsExample();
	for (const [index, { id, hostKinds }] of assets.entries()) {
		expect(hostKinds).toEqual(['ground']);
		const overrides = { scale: 1.25, rotation: Math.PI / 2 };
		const result = buildAssetResult(id, ground, overrides, 37);
		expect(result).toEqual(sculptures[index]);
		expect(result).toEqual(buildAssetResult(id, ground, overrides, 37));
		expect(result.object).not.toEqual(buildAsset(id, ground, overrides, 38));
		expect(result.object.anchors).toEqual([{ name: 'ground', position: point, normal: [0, 0, 1] }]);
		expect(bounds(result.object).min[2]).toBeCloseTo(point[2], 10);
		expect(Object.keys(result.metadata ?? {}).sort()).toEqual([...result.object.slots].sort());
		const unrotated = buildAsset(id, ground, {}, 37);
		const { min, max } = bounds(result.object);
		expect(max[0] - min[0]).toBeCloseTo(unrotated.footprint.depth * overrides.scale, 10);
		expect(max[1] - min[1]).toBeCloseTo(unrotated.footprint.width * overrides.scale, 10);
	}
});

test('clamps and snaps sculpture inputs and validates hosts, overrides and seed', () => {
	const ground = { kind: 'ground', point: [0, 0, 0] } as const;
	const edge = {
		kind: 'graph-edge',
		id: 'walk',
		points: [
			[0, 0, 0],
			[8, 0, 0]
		]
	} as const;
	for (const { id, params } of listAssets({ kind: 'sculpture' })) {
		expect(buildAsset(id, ground, { scale: 0.1, rotation: 100 }, 37)).toEqual(
			buildAsset(id, ground, { scale: params.scale.min, rotation: params.rotation.max }, 37)
		);
		expect(buildAsset(id, ground, { scale: 1.23, rotation: 0.04 }, 37)).toEqual(
			buildAsset(id, ground, { scale: 1.25, rotation: 0 }, 37)
		);
		expect(() => buildAsset(id, ground, { scale: NaN }, 37)).toThrow(InvalidAssetParamsError);
		expect(() => buildAsset(id, ground, { span: 5 }, 37)).toThrow(InvalidAssetParamsError);
		expect(() => buildAsset(id, ground, {}, 0.5)).toThrow(InvalidAssetParamsError);
		for (const unsupported of [host, edge])
			expect(() => validateAssetHost(id, unsupported)).toThrow(WrongAssetHostError);
	}
	expect(
		listAssets().filter(
			({ hostKinds, kind }) => hostKinds.includes('parcel') && kind === 'sculpture'
		)
	).toEqual([]);
});
