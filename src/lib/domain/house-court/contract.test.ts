import { describe, expect, test } from 'bun:test';
import { createCatalog } from '../../core/catalog';
import { encodeKey, equalRefs, readWorldReference, type Ref } from '../../core/ref';
import type { Vec2 } from '../../core/geometry';
import type { Shape } from '../../core/object';
import {
	cellAreaM2,
	cellSubgridCatalog,
	createCellSpace,
	createCellSpaceStoreys,
	readStoreyElevation,
	readCellStoreys,
	type CellSubgridGenerator,
	parcelEdgeId,
	type CellSpace,
	type Parcel
} from '../cell-space';
import { cellRoles } from '../massing';
import { example, mixedStoreyExample } from './example';
import {
	createHouseCourt,
	createHouseAssembly,
	createHouseObject,
	houseFaces,
	houseFigures,
	houseSlots,
	houseStyles,
	readHousePartRefs,
	type HouseCourt,
	type HouseStyle
} from './index';

const parcel = (id: string, points: readonly Vec2[], frontage = [0]): Parcel => ({
	id,
	corners: points.map((position, i) => ({ id: `c${i}`, position })),
	frontage: frontage.map((i) => parcelEdgeId(`c${i}`, `c${(i + 1) % points.length}`)),
	baseZ: 2,
	storeyCount: 10
});
const hexagon = Array.from({ length: 6 }, (_, i): Vec2 => [
	15 * Math.cos((i * Math.PI) / 3),
	15 * Math.sin((i * Math.PI) / 3)
]);
const spaces = Object.entries({
	rectangle: parcel('rectangle', [
		[0, 0],
		[20, 0],
		[20, 30],
		[0, 30]
	]),
	trapezoid: parcel('trapezoid', [
		[0, 0],
		[28, 0],
		[22, 24],
		[3, 26]
	]),
	hexagon: parcel('hexagon', hexagon, [0, 1]),
	triangle: parcel('triangle', [
		[0, 0],
		[34, 0],
		[14, 30]
	]),
	ell: parcel('ell', [
		[0, 0],
		[32, 0],
		[32, 14],
		[14, 14],
		[14, 30],
		[0, 30]
	])
}).map(([name, fixture]) => [name, createCellSpace(fixture)] as const);
const grid = [0, 0.5, 1].flatMap((complexity) =>
	[1, 14, 32].flatMap((height) =>
		[1, 12, 32].map((width) => ({ height, width, complexity, seed: 5 }))
	)
);
const styles = Object.values(houseStyles) as HouseStyle[];

/** Signed volume and unmatched directed edges of a triangle mesh; a closed, consistently wound
 * two-manifold surface has none and counts every undirected edge exactly twice. */
function closure(shape: Shape) {
	if (shape.kind !== 'mesh') throw new Error('Expected a mesh');
	const { positions: p, indices } = shape;
	const key = (i: number) => [0, 1, 2].map((k) => Math.round(p[i * 3 + k] * 1e6)).join(',');
	const directed = new Map<string, number>();
	const uses = new Map<string, number>();
	let volume = 0;
	for (let t = 0; t < indices.length; t += 3) {
		const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
		const [ax, ay, az, bx, by, bz, cx, cy, cz] = [a, b, c].flatMap((i) => [
			p[i * 3],
			p[i * 3 + 1],
			p[i * 3 + 2]
		]);
		volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
		for (const [u, v] of [
			[a, b],
			[b, c],
			[c, a]
		]) {
			const [ku, kv] = [key(u), key(v)];
			if (ku === kv) continue;
			directed.set(`${ku}>${kv}`, (directed.get(`${ku}>${kv}`) ?? 0) + 1);
			const pair = [ku, kv].sort().join('|');
			uses.set(pair, (uses.get(pair) ?? 0) + 1);
		}
	}
	const open = [...directed].filter(([edge, n]) => {
		const [u, v] = edge.split('>');
		return n !== (directed.get(`${v}>${u}`) ?? 0);
	}).length;
	return { volume, open, crowded: [...uses.values()].filter((n) => n > 2).length };
}

function inside(quad: readonly Vec2[], [px, py]: Vec2) {
	return quad.every(([ax, ay], i) => {
		const [bx, by] = quad[(i + 1) % quad.length];
		return (bx - ax) * (py - ay) - (by - ay) * (px - ax) >= -1e-6;
	});
}

function groundReach(space: CellSpace, house: HouseCourt) {
	const cells = new Map(house.cells.map((cell) => [cell.id, cell]));
	const open = (id: string) =>
		(cells.get(id)?.fromStorey ?? 0) > 0 || (cells.get(id)?.toStorey ?? 0) === 0;
	const start = space.cells
		.filter((cell) => cell.sides.some(({ frontage }) => frontage) && open(cell.id))
		.map(({ id }) => id);
	const seen = new Set(start);
	for (const id of seen)
		for (const { neighbour } of space.cells.find((cell) => cell.id === id)?.sides ?? [])
			if (neighbour && open(neighbour)) seen.add(neighbour);
	return seen;
}

/** Every mass part is closed and stays inside its own cell and storey span, or is an envelope shell. */
function checkMasses(space: CellSpace, house: HouseCourt, style: HouseStyle) {
	const object = createHouseObject(space, house, 'block', style);
	let volume = 0;
	for (const { id, slot, shape } of object.parts) {
		if (slot !== 'mass') continue;
		const result = closure(shape);
		expect(result.open).toBe(0);
		expect(result.crowded).toBe(0);
		expect(result.volume).toBeGreaterThan(0);
		volume += result.volume;
		const cell = space.cells.find((c) => id.startsWith(`${c.id}/`));
		const occupancy = house.cells.find((c) => c.id === cell?.id);
		if (!cell || !occupancy || shape.kind !== 'mesh') continue;
		const { positions: p } = shape;
		const top = readStoreyElevation(space, Math.min(space.storeyCount, occupancy.toStorey + 1));
		for (let i = 0; i < p.length; i += 3) {
			expect(inside(cell.quad, [p[i], p[i + 1]])).toBe(true);
			expect(p[i + 2]).toBeGreaterThanOrEqual(
				readStoreyElevation(space, occupancy.fromStorey) - 1e-6
			);
			expect(p[i + 2]).toBeLessThanOrEqual(top + 1e-6);
		}
	}
	return volume;
}

describe('createHouseCourt', () => {
	test.each(spaces)(
		'%s: closed, non-overlapping volume and a reachable court for every style at the input bounds',
		(_, space) => {
			for (const style of styles)
				for (const inputs of grid) {
					const house = createHouseCourt(space, inputs, style);
					const volume = checkMasses(space, house, style);
					if (style.fill.kinds.includes('envelope')) {
						const expected = house.cells.reduce((sum, { id, fromStorey, toStorey }) => {
							const cell = space.cells.find((c) => c.id === id);
							return (
								sum +
								(cell ? cellAreaM2(cell) : 0) *
									(readStoreyElevation(space, toStorey) - readStoreyElevation(space, fromStorey))
							);
						}, 0);
						expect(volume).toBeCloseTo(expected, 4);
					}
					const court = house.cells.filter(({ role }) => role === 'court');
					expect(court.length).toBeGreaterThan(0);
					const reach = groundReach(space, house);
					for (const { id } of court) expect(reach.has(id)).toBe(true);
					for (const cell of house.cells)
						expect(cellRoles[cell.role].built).toBe(cell.toStorey > cell.fromStorey);
				}
		}
	);

	test('is deterministic per style and the seed only moves storeys of the neutral row', () => {
		const [, space] = spaces[2];
		const inputs = { height: 21, width: 32, complexity: 1, seed: 9 };
		for (const style of styles) {
			expect(createHouseCourt(space, inputs, style)).toEqual(
				createHouseCourt(space, inputs, style)
			);
			expect(
				createHouseObject(space, createHouseCourt(space, inputs, style), 'full', style)
			).toEqual(createHouseObject(space, createHouseCourt(space, inputs, style), 'full', style));
		}
		const other = createHouseCourt(space, { ...inputs, seed: 10 });
		expect(other.cells.map(({ role }) => role)).toEqual(
			createHouseCourt(space, inputs).cells.map(({ role }) => role)
		);
	});

	test('built cells grow with width and every cell grows with height (neutral row)', () => {
		for (const [, space] of spaces) {
			const built = (width: number) =>
				new Set(
					createHouseCourt(space, { width, seed: 1 })
						.cells.filter(({ toStorey }) => toStorey > 0)
						.map(({ id }) => id)
				);
			for (const width of [1, 6, 12, 20, 28])
				for (const id of built(width)) expect(built(width + 4).has(id)).toBe(true);
			const storeys = (height: number) =>
				createHouseCourt(space, { height, complexity: 1, width: 32, seed: 1 }).cells.map(
					({ toStorey }) => toStorey
				);
			for (const height of [3.5, 10.5, 17.5, 28])
				storeys(height).forEach((value, i) =>
					expect(storeys(height + 3.5)[i]).toBeGreaterThanOrEqual(value)
				);
		}
	});

	test('height sets the storeys, width one keeps only the frontage', () => {
		const [, space] = spaces[0];
		expect(createHouseCourt(space, { height: 1, seed: 0 }).storeys).toBe(1);
		expect(createHouseCourt(space, { height: 32, seed: 0 }).storeys).toBe(9);
		const narrow = createHouseCourt(space, { width: 1, seed: 0 });
		for (const cell of space.cells) {
			const role = narrow.cells.find(({ id }) => id === cell.id)?.role ?? '';
			if (!cell.sides.some(({ frontage }) => frontage)) expect(['court', 'garden']).toContain(role);
		}
		expect(houseFigures(space, narrow).courtAreaM2).toBeGreaterThan(0);
	});

	test('the neutral row is the R11 house: its slots and parts', () => {
		const [, space] = spaces[0];
		const house = createHouseCourt(space, { height: 14, width: 28, complexity: 0.6, seed: 3 });
		expect(houseSlots(houseStyles.neutral, 'full')).toEqual([
			'plot',
			'court',
			'wall',
			'rim',
			'opening',
			'accent',
			'gallery',
			'stair'
		]);
		const parts = createHouseObject(space, house, 'full').parts.map(({ slot }) => slot);
		expect([...new Set(parts)]).toEqual([
			'plot',
			'court',
			'wall',
			'rim',
			'opening',
			'gallery',
			'stair'
		]);
		expect(
			house.cells.map(({ role, toStorey }) => `${role}${toStorey}`).join(' ')
		).toMatchSnapshot();
	});

	test('geometry names role slots only and carries no colour, in every style', () => {
		const [, space] = spaces[4];
		for (const style of styles) {
			const house = createHouseCourt(
				space,
				{ height: 17.5, width: 32, complexity: 1, seed: 3 },
				style
			);
			for (const detail of ['full', 'block'] as const) {
				const object = createHouseObject(space, house, detail, style);
				expect(object.slots).toEqual(houseSlots(style, detail));
				expect(JSON.stringify(object)).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(|hsla?\(|"--/i);
				expect(object.anchors.map(({ name }) => name)).toEqual(['entrance', 'court']);
			}
		}
	});

	test('the three styles differ in their parts on the same parcel and inputs', () => {
		const [, space] = spaces[0];
		const inputs = { height: 17.5, width: 28, complexity: 0.8, seed: 3 };
		const slots = (style: HouseStyle) =>
			new Set(
				createHouseObject(space, createHouseCourt(space, inputs, style), 'full', style).parts.map(
					({ slot }) => slot
				)
			);
		expect(slots(houseStyles.archigram).has('frame')).toBe(true);
		expect(slots(houseStyles.organic).has('planter')).toBe(true);
		expect(slots(houseStyles.memphis).has('body-second')).toBe(true);
	});

	test('R11-04: gallery and stair stay inside the court or are left out', () => {
		const tiny = createCellSpace(
			parcel('tiny', [
				[0, 0],
				[2, 0],
				[2, 2],
				[0, 2]
			])
		);
		const house = createHouseCourt(tiny, { height: 21, width: 32, complexity: 1, seed: 3 });
		for (const { slot, shape } of createHouseObject(tiny, house, 'full').parts)
			if ((slot === 'gallery' || slot === 'stair') && shape.kind === 'mesh')
				for (let i = 0; i < shape.positions.length; i += 3)
					expect(
						inside(
							[
								[0, 0],
								[2, 0],
								[2, 2],
								[0, 2]
							],
							[shape.positions[i], shape.positions[i + 1]]
						)
					).toBe(true);
	});

	test('R11-05: cells touching only at an edge go to separate envelope shells', () => {
		const space = createCellSpace(
			parcel('wedge', [
				[0, 0],
				[28, 0],
				[0, 28]
			])
		);
		const house = createHouseCourt(space, { height: 21, width: 16, complexity: 1, seed: 0 });
		for (const { slot, shape } of createHouseObject(space, house, 'full').parts)
			if (slot === 'wall') expect(closure(shape).crowded).toBe(0);
	});

	test('R11-07: occupancy of a space with other cell identities or another style throws', () => {
		const [, space] = spaces[0];
		const renamed = createCellSpace({
			...parcel(
				'rectangle',
				[
					[0, 0],
					[20, 0],
					[20, 30],
					[0, 30]
				],
				[]
			),
			corners: ['w', 'x', 'y', 'z'].map((id, i) => ({
				id,
				position:
					space.cells[0].quad[0] &&
					(
						[
							[0, 0],
							[20, 0],
							[20, 30],
							[0, 30]
						] as Vec2[]
					)[i]
			}))
		});
		const house = createHouseCourt(space, { seed: 1 });
		expect(() => createHouseObject(renamed, { ...house }, 'block')).toThrow(RangeError);
		expect(() => createHouseObject(space, house, 'block', houseStyles.memphis)).toThrow(RangeError);
	});

	test('a space without frontage throws and the example builds', () => {
		const [, space] = spaces[0];
		const blind = {
			...space,
			cells: space.cells.map((cell) => ({
				...cell,
				sides: cell.sides.map((side) => ({ ...side, frontage: false }))
			}))
		};
		expect(() => createHouseCourt(blind, { seed: 1 })).toThrow(RangeError);
		expect(example().parts.length).toBeGreaterThan(0);
	});
});

test('preserves frame connections and face counts across datum translations', () => {
	const [, original] = spaces[0];
	// Exercise separate storeys that can land in the same rounded Z bucket.
	const space = createCellSpaceStoreys(original, {
		baseZ: 0,
		storeyCount: original.storeyCount,
		storeyHeightM: 0.00035
	});
	const style = houseStyles.archigram;
	const house = createHouseCourt(space, { height: 21, width: 28, complexity: 0.8, seed: 3 }, style);
	function frameAt(baseZ: number) {
		const shape = createHouseObject({ ...space, baseZ }, house, 'full', style).parts.find(
			({ slot }) => slot === 'frame'
		)?.shape;
		if (shape?.kind !== 'mesh') throw new Error('Expected a frame mesh');
		return shape;
	}
	const frame = frameAt(space.baseZ);
	for (const offset of [0.3333, 1000.123456]) {
		const shifted = frameAt(space.baseZ + offset);
		expect(shifted.positions).toHaveLength(frame.positions.length);
		expect(shifted.indices).toEqual(frame.indices);
		const positionError = shifted.positions.reduce((maximum, position, index) => {
			const expected = frame.positions[index] + (index % 3 === 2 ? offset : 0);
			return Math.max(maximum, Math.abs(position - expected));
		}, 0);
		expect(positionError).toBeLessThan(1e-9);
	}
});

test('preserves envelope shell boundaries and face counts across datum translations', () => {
	const space = createCellSpace({
		...parcel('wedge', [
			[0, 0],
			[28, 0],
			[0, 28]
		]),
		baseZ: 0,
		storeyHeightM: 0.0000004
	});
	const house = createHouseCourt(space, { height: 21, width: 16, complexity: 1, seed: 0 });
	const meshCounts = (baseZ: number) =>
		createHouseObject({ ...space, baseZ }, house, 'full')
			.parts.filter(({ slot }) => slot === 'wall')
			.map(({ id, shape }) => {
				if (shape.kind !== 'mesh') throw new Error('Expected an envelope mesh');
				return [id, shape.indices.length, shape.positions.length];
			});
	const counts = meshCounts(space.baseZ);
	expect(counts.length).toBeGreaterThan(1);
	expect(meshCounts(1000.1234564)).toEqual(counts);
});

test('builds closed mixed-height mass on all subgrids, including a caller-registered rule', () => {
	const catalog = createCatalog<CellSubgridGenerator>({
		rows: [
			...cellSubgridCatalog.rows,
			{ id: 'coarse-quad', create: (parcel) => createCellSpace(parcel, 0) }
		]
	});
	for (const id of catalog.ids) {
		for (const style of styles) {
			const { space, house } = mixedStoreyExample(id, catalog, style);
			expect(space.storeyElevationsM).toEqual([0, 4.8, 8, 11.2, 15.7]);
			expect(house.unbuildable).toBeUndefined();
			const volume = checkMasses(space, house, style);
			expect(volume).toBeGreaterThan(0);
			if (style.id !== 'neutral') continue;
			const expected = house.cells.reduce(
				(sum, { fromStorey, toStorey }, index) =>
					sum +
					cellAreaM2(space.cells[index]) *
						(readStoreyElevation(space, toStorey) - readStoreyElevation(space, fromStorey)),
				0
			);
			expect(volume).toBeCloseTo(expected, 6);
		}
	}
});

test('uses stable JSON refs to attach external functions to storeys and every house part', () => {
	type FunctionKind = 'Public Space' | 'Workshop' | 'Office' | 'Housing' | 'City Farm';
	const uses: readonly FunctionKind[] = [
		'Public Space',
		'Workshop',
		'Office',
		'Housing',
		'City Farm'
	];
	const functions = new Map<string, FunctionKind>();
	function attach(ref: Ref, index: number) {
		const encoded = JSON.stringify(ref);
		const restored = readWorldReference(JSON.parse(encoded));
		expect(restored && equalRefs(ref, restored)).toBe(true);
		expect(functions.has(encoded)).toBe(false);
		functions.set(encoded, uses[index % uses.length]);
	}
	for (const style of styles) {
		functions.clear();
		const { space, house, object } = mixedStoreyExample('corner-quad', cellSubgridCatalog, style);
		const before = JSON.stringify(object);
		const rows = readHousePartRefs(house, 'fixture');
		const storeys = new Set(
			readCellStoreys(space, 'fixture').map(({ ref }, i) => {
				attach(ref, i);
				return JSON.stringify(ref);
			})
		);
		const rendered = new Set(object.parts.map(({ id }) => id));
		expect(rows.every(({ partId }) => partId.includes('/datum/') || rendered.has(partId))).toBe(
			true
		);
		for (const [index, part] of rows.entries()) {
			attach(part.ref, index);
			expect(part.ref.key).toBe(encodeKey([house.id, part.partId]));
			expect(part.storeyRefs.length).toBeGreaterThan(0);
			for (const ref of part.storeyRefs) {
				expect(storeys.has(JSON.stringify(ref))).toBe(true);
				const [, cell, , storey] = JSON.parse(ref.key);
				expect(storey).toBeGreaterThanOrEqual(part.storeySpan[0]);
				expect(storey).toBeLessThan(part.storeySpan[1]);
				if (part.cellId !== null) expect(cell).toBe(part.cellId);
			}
		}
		const replay = mixedStoreyExample('corner-quad', cellSubgridCatalog, style);
		expect(replay.house.partAddresses).toEqual(house.partAddresses);
		expect(readHousePartRefs(replay.house, 'fixture')).toEqual(rows);
		expect(new Set(functions.values())).toEqual(new Set(uses));
		expect(JSON.stringify(replay.object)).toBe(before);
		for (const { ref, storeyRefs } of readHousePartRefs(house, 'another-world')) {
			expect(ref.world).toBe('another-world');
			expect(storeyRefs.every(({ world }) => world === 'another-world')).toBe(true);
		}
	}
});

test('keeps framed capsules closed when a mixed slice is shorter than the nominal gaps', () => {
	const { space: plan } = mixedStoreyExample();
	const space = createCellSpaceStoreys(plan, {
		baseZ: 0,
		storeyCount: 4,
		storeyHeightsM: [4.8, 0.7, 3.2, 4.5]
	});
	const style: HouseStyle = {
		...houseStyles.archigram,
		fill: { ...houseStyles.archigram.fill, capsuleShareRatio: 1 }
	};
	const house = createHouseCourt(space, { height: 13.2, width: 28, complexity: 0, seed: 7 }, style);
	const capsules = createHouseObject(space, house, 'block', style).parts.filter(({ id }) =>
		id.endsWith('/capsule/1')
	);
	expect(capsules.length).toBeGreaterThan(0);
	for (const { shape } of capsules) {
		const result = closure(shape);
		expect(result).toMatchObject({ open: 0, crowded: 0 });
		expect(result.volume).toBeGreaterThan(0);
	}
});

test('keeps occupied body refs through clipping, extension and shell regrouping', () => {
	const plan = createCellSpace(
		parcel('unbroken-front', [
			[0, 0],
			[20, 0],
			[20, 24],
			[0, 24]
		]),
		0
	);
	const inputs = { height: 32, width: 32, complexity: 0, seed: 7 };
	const initial = createCellSpaceStoreys(plan, { baseZ: 0, datumIndex: 4, storeyCount: 3 });
	const clipped = createCellSpaceStoreys(plan, { baseZ: 3.5, datumIndex: 5, storeyCount: 2 });
	const extended = createCellSpaceStoreys(plan, { baseZ: 0, datumIndex: 4, storeyCount: 5 });
	for (const style of [houseStyles.neutral, houseStyles.memphis]) {
		const reads = [initial, clipped, extended].map((space) =>
			readHousePartRefs(createHouseCourt(space, inputs, style), 'town')
				.filter(
					({ body, partId, storeySpan }) =>
						body && partId.includes('/datum/') && storeySpan[0] === 5
				)
				.map(({ ref }) => ref.key)
		);
		expect(reads[0].length).toBeGreaterThan(0);
		expect(reads[1]).toEqual(reads[0]);
		expect(reads[2]).toEqual(reads[0]);
	}
	const style = houseStyles.neutral;
	const retained = (use: 'public' | 'office') => ({ phase: 'retained' as const, use });
	const complete = createHouseCourt(initial, inputs, style, {
		storeyProgram: () => retained('public')
	});
	const regrouped = createHouseCourt(initial, inputs, style, {
		storeyProgram: (_, cell) => retained(cell === initial.cells[0].id ? 'office' : 'public')
	});
	const assembled = createHouseAssembly(initial, regrouped, 'full', style);
	expect(assembled.addresses.map(({ partId }) => partId)).toEqual(
		assembled.object.parts.map(({ id }) => id)
	);
	expect(assembled.addresses.filter(({ body }) => body).length).toBeGreaterThan(
		createHouseAssembly(initial, complete, 'full', style).addresses.filter(({ body }) => body)
			.length
	);
	expect(
		new Set(
			assembled.addresses.flatMap(({ program, body }) => (body && program ? [program.use] : []))
		)
	).toEqual(new Set(['public', 'office']));
	const bodyKeys = (house: HouseCourt) =>
		readHousePartRefs(house, 'town')
			.filter(({ body }) => body)
			.map(({ ref }) => ref.key);
	expect(bodyKeys(regrouped)).toEqual(bodyKeys(complete));
});

test('adjacent inset addition cells expose their facing walls for envelope cladding', () => {
	const plan = createCellSpace(
		parcel('inset-pair', [
			[0, 0],
			[20, 0],
			[20, 20],
			[0, 20]
		]),
		0
	);
	const space = createCellSpaceStoreys(plan, { baseZ: 0, datumIndex: 0, storeyCount: 2 });
	const inputs = { height: 7, width: 32, complexity: 0, seed: 3 };
	const retained = createHouseCourt(space, inputs, houseStyles.neutral, {
		storeyProgram: () => ({ phase: 'retained', use: 'public' })
	});
	const addition = createHouseCourt(space, inputs, houseStyles.neutral, {
		storeyProgram: () => ({ phase: 'addition', use: 'office' })
	});
	const retainedWalls = houseFaces(space, retained, 'full', houseStyles.neutral).filter(
		({ place }) => place === 'wall'
	);
	const additionWalls = houseFaces(space, addition, 'full', houseStyles.neutral).filter(
		({ place }) => place === 'wall'
	);
	expect(additionWalls.length).toBeGreaterThan(retainedWalls.length);
});
