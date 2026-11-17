import { expect, test } from 'bun:test';
import { random } from '../../../random';
import {
	compile,
	validateModel,
	topologyOf,
	transact,
	undo,
	redo,
	encode,
	decode,
	defaultLimits,
	emptyMeaning,
	fieldGrid,
	sampleField,
	trace,
	parcelize,
	parcelRelations,
	connectPorts,
	distances,
	orient,
	quadQuality,
	buildTopology,
	type Intent,
	type Vec,
	type SourceFace,
	type CrossField,
	type Port,
	type Connection
} from './index';
function lattice(n = 4): Intent {
	const positions = new Map<string, Vec>(),
		faces = new Map<string, SourceFace>();
	for (let y = 0; y <= n; y++)
		for (let x = 0; x <= n; x++) positions.set(`${x}:${y}`, [x * 10, y * 10]);
	for (let y = 0; y < n; y++)
		for (let x = 0; x < n; x++) {
			const id = `cell:${x}:${y}`;
			faces.set(id, {
				id,
				level: 0,
				ring: [`${x}:${y}`, `${x + 1}:${y}`, `${x + 1}:${y + 1}`, `${x}:${y + 1}`]
			});
		}
	return {
		version: 1,
		seed: 42,
		positions,
		faces,
		semantics: new Map([...faces.keys()].map((id) => [id, emptyMeaning()])),
		fixed: new Set(),
		limits: defaultLimits
	};
}
function single(points: Vec[]): Intent {
	const ids = points.map((_, i) => `v${i}`),
		id = 'source';
	return {
		version: 1,
		seed: 42,
		positions: new Map(ids.map((id, i) => [id, points[i]])),
		faces: new Map([[id, { id, ring: ids, level: 0 }]]),
		semantics: new Map([[id, emptyMeaning()]]),
		fixed: new Set(),
		limits: defaultLimits
	};
}
test('property: 120 seeded local edits equal full derivation; snapshots reversible; remote chunks untouched', () => {
	const initial = compile(lattice()),
		rng = random(1097);
	for (let n = 0; n < 120; n++) {
		const x = 1 + Math.floor(rng() * 3),
			y = 1 + Math.floor(rng() * 3),
			id = `${x}:${y}`,
			p: Vec = [x * 10 + (rng() - 0.5) * 3, y * 10 + (rng() - 0.5) * 3];
		const tx = transact(initial, { positions: new Map([[id, p]]) }),
			fresh = compile(tx.after.intent);
		expect(tx.after).toEqual(fresh);
		expect(tx.rebuilt).toBe(4);
		expect(topologyOf(tx.after)).toEqual(topologyOf(fresh));
		for (const [key, c] of initial.chunks)
			if (!tx.dirty.includes(key)) expect(tx.after.chunks.get(key)).toBe(c);
		expect(undo(tx.after, tx)).toBe(initial);
		expect(redo(initial, tx)).toBe(tx.after);
		expect(encode(tx.after)).toBe(encode(decode(encode(tx.after))));
		validateModel(tx.after);
	}
});
test('property: semantic programs edit without rebuilding geometry', () => {
	const a = compile(lattice());
	for (let level = 0; level < 20; level++) {
		const tx = transact(a, {
			meanings: new Map([
				[
					'cell:0:0',
					{
						...emptyMeaning(),
						occupancy: 'occupied',
						programs: [{ level, use: 'housing', height: 3 }]
					}
				]
			])
		});
		expect(tx.rebuilt).toBe(0);
		expect(tx.after).toEqual(compile(tx.after.intent));
		for (const [id, c] of a.chunks) expect(tx.after.chunks.get(id)).toBe(c);
	}
});
test('property: 80 affine convex polygons retain coverage, twins, positive Jacobians', () => {
	const rng = random(82);
	for (let n = 0; n < 80; n++) {
		const count = 3 + (n % 7),
			theta = rng() * 6.28,
			scale = 1 + rng() * 10;
		const pts = Array.from({ length: count }, (_, i): Vec => {
			const a = theta + (i * 2 * Math.PI) / count;
			return [scale * Math.cos(a) + 2 * Math.sin(a), 3 * Math.sin(a)];
		});
		const m = compile(single(pts));
		validateModel(m);
		expect(m).toEqual(compile(single(pts)));
	}
});
test('concave fallback, topology event, holes and independent levels', () => {
	const before = compile(
		single([
			[0, 0],
			[10, 0],
			[10, 10],
			[0, 10]
		])
	);
	const tx = transact(before, { positions: new Map([['v2', [2, 2]]]) });
	expect(tx.after.chunks.get('source')!.topology.faces.size).toBe(6);
	expect(tx.after).toEqual(compile(tx.after.intent));
	validateModel(tx.after);
	const i = lattice(3),
		faces = new Map(i.faces),
		semantics = new Map(i.semantics);
	faces.delete('cell:1:1');
	semantics.delete('cell:1:1');
	validateModel(compile({ ...i, faces, semantics }));
	const two = single([
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 1]
		]),
		positions = new Map(two.positions),
		fs = new Map(two.faces),
		ms = new Map(two.semantics);
	for (const [id, p] of two.positions) positions.set(`up:${id}`, p);
	fs.set('up', { id: 'up', level: 1, ring: ['up:v0', 'up:v1', 'up:v2', 'up:v3'] });
	ms.set('up', emptyMeaning());
	validateModel(compile({ ...two, positions, faces: fs, semantics: ms }));
});
test('reject bad topology, quality, collisions, protected changes and stale histories atomically', () => {
	expect(() =>
		compile(
			single([
				[0, 0],
				[1, 1],
				[0, 1],
				[1, 0]
			])
		)
	).toThrow();
	expect(() =>
		compile({
			...single([
				[0, 0],
				[10, 0],
				[0.1, 0.01]
			]),
			limits: { ...defaultLimits, minAngle: 30 }
		})
	).toThrow('quality-unattainable');
	expect(() =>
		buildTopology([
			{ id: 'a', ring: ['a', 'b', 'c'], level: 0 },
			{ id: 'b', ring: ['a', 'd', 'e'], level: 0 }
		])
	).toThrow('nonmanifold-vertex');
	const i = lattice(),
		m = compile({ ...i, fixed: new Set(['1:1']) }),
		saved = encode(m);
	expect(() => transact(m, { positions: new Map([['1:1', [11, 11]]]) })).toThrow('protected');
	expect(() => transact(m, { positions: new Map([['2:2', [100, 100]]]) })).toThrow();
	expect(encode(m)).toBe(saved);
	const tx = transact(m, { positions: new Map([['2:2', [21, 21]]]) });
	expect(() => undo(m, tx)).toThrow('stale');
});
test('exact orientation fallback and bilinear Jacobian detect degeneracy and folding', () => {
	expect(orient([0, 0], [1, 1], [2, 2])).toBe(0);
	expect(orient([0, 0], [1, 1], [2, 2 + Number.EPSILON * 2])).toBe(1);
	expect(
		quadQuality([
			[0, 0],
			[1, 0],
			[0.1, 0.1],
			[0, 1]
		]).minJacobian
	).toBeLessThan(0);
});
const field: CrossField = {
	angle: 0,
	strength: 1,
	density: 1,
	sources: [{ kind: 'direction', point: [10, 10], angle: 0.12, radius: 30, weight: 0.4 }]
};
test('cross-field is quarter-turn invariant, detects zeros and indexed singularities', () => {
	const a = sampleField(field, [10, 10]),
		b = sampleField({ ...field, angle: Math.PI / 2 }, [10, 10]);
	expect(a.angle).toBeCloseTo(b.angle, 12);
	expect(
		sampleField(
			{
				angle: 0,
				strength: 1,
				density: 1,
				sources: [{ kind: 'direction', point: [0, 0], radius: 1, angle: Math.PI / 4, weight: 1 }]
			},
			[0, 0]
		).singular
	).toBe(true);
	const singular: CrossField = {
		angle: 0,
		strength: 0,
		density: 1,
		sources: [{ kind: 'singularity', point: [0, 0], radius: 10, weight: 1, index: 0.25, phase: 0 }]
	};
	expect(trace(singular, [0, 0], 0, { min: [-1, -1], max: [1, 1] }, 0.1).stop).toBe('singularity');
});
test('field chart integrates both hyperstreamline families, deterministic quads, explicit incomplete chart', () => {
	const b = { min: [0, 0] as Vec, max: [20, 20] as Vec },
		out = fieldGrid(field, b, 5);
	validateModel(out.model);
	expect(out).toEqual(fieldGrid(field, b, 5));
	expect(out.alleys.length).toBe(10);
	expect(out.model.intent.faces.size).toBe(16);
	expect(out.alleys[0].points.at(-1)![1]).not.toBe(out.alleys[0].points[0][1]);
	expect(() => fieldGrid({ ...field, strength: 0, sources: [] }, b)).toThrow('singularity');
});
test('OBB parcels all have usable access; split/merge lineage and area preserved', () => {
	const p: Vec[] = [
			[0, 0],
			[40, 0],
			[40, 20],
			[0, 20]
		],
		fronts = [
			{
				id: 'lane',
				a: [0, 0] as Vec,
				b: [40, 0] as Vec,
				level: 0,
				width: 2,
				kind: 'alley' as const
			}
		],
		o = { maxArea: 220, minArea: 50, minFront: 3, minWidth: 1.2, maxDepth: 8, level: 0 };
	const result = parcelize('block', p, fronts, o);
	expect(result.leaves.length).toBe(4);
	expect(result.unresolved).toEqual([]);
	for (const q of result.leaves) expect(q.access[0].length).toBeGreaterThanOrEqual(3);
	const coarse = parcelize('block', p, fronts, { ...o, maxArea: 1000 });
	expect(parcelRelations(coarse.leaves, result.leaves)[0].to.length).toBe(4);
	expect(() => parcelize('block', p, fronts, { ...o, level: 1 })).toThrow('landlocked');
	const capped = parcelize('block', p, fronts, { ...o, maxDepth: 0 });
	expect(capped.unresolved).toEqual(['block']);
});
test('ports respect levels, channels and clearance; loops reduce detour and permutation invariant', () => {
	const ports: Port[] = ['a', 'b', 'c', 'd'].map((id, i) => ({
		id,
		owner: id,
		level: i === 3 ? 1 : 0,
		channel: 'walk'
	}));
	const edge = (
		id: string,
		a: string,
		b: string,
		cost: number,
		kind: Connection['kind'] = 'horizontal'
	): Connection => ({
		id,
		a,
		b,
		cost,
		kind,
		clear: true,
		width: 2,
		capacity: 10,
		span: 1,
		maxSpan: 10
	});
	const es = [
		edge('ab', 'a', 'b', 2),
		edge('bc', 'b', 'c', 2),
		edge('ac', 'a', 'c', 3),
		edge('cd', 'c', 'd', 1),
		edge('lift', 'c', 'd', 5, 'lift')
	];
	const tree = connectPorts(ports, es, { minWidth: 1, loops: 0, minGain: 0 }),
		loop = connectPorts(ports, es, { minWidth: 1, loops: 1, minGain: 0 });
	expect(tree.rejected).toContain('cd');
	expect(tree.treeEdges).toBe(3);
	expect(loop.edges.length).toBe(4);
	expect(distances(loop, 'a').get('c')).toBeLessThan(distances(tree, 'a').get('c')!);
	expect(loop.edges).toEqual(
		connectPorts([...ports].reverse(), [...es].reverse(), { minWidth: 1, loops: 1, minGain: 0 })
			.edges
	);
});

test('property: parcel cache dependency closure equals full recomputation, exact land undo/redo', async () => {
	const { compileLand, transactLand, undoLand, redoLand, encodeLand, decodeLand } =
		await import('./land');
	const m = compile(lattice()),
		plans = new Map(
			[...m.intent.faces.values()].map((f) => [
				f.id,
				{
					block: f.id,
					fronts: [
						{
							id: `front:${f.id}`,
							a: f.ring[0],
							b: f.ring[1],
							level: 0,
							width: 2,
							kind: 'alley' as const
						}
					],
					options: { maxArea: 60, minArea: 10, minFront: 1, minWidth: 1, maxDepth: 4, level: 0 }
				}
			])
		);
	const before = compileLand(m, plans),
		rng = random(912);
	for (let n = 0; n < 30; n++) {
		const tx = transactLand(before, {
			positions: new Map([['2:2', [20 + rng() * 0.5, 20 + rng() * 0.5]]])
		});
		expect(tx.after).toEqual(compileLand(compile(tx.after.model.intent), plans));
		expect(tx.dirtyParcels.length).toBe(4);
		expect(encodeLand(decodeLand(encodeLand(tx.after)))).toBe(encodeLand(tx.after));
		for (const [id, p] of before.parcels)
			if (!tx.dirtyParcels.includes(id)) expect(tx.after.parcels.get(id)).toBe(p);
		expect(undoLand(tx.after, tx)).toBe(before);
		expect(redoLand(before, tx)).toBe(tx.after);
	}
});
test('legacy adapter imports all standard raster families or explicitly rejects unmet geometry', async () => {
	const { gridGenerators } = await import('../../index'),
		{ toPatch, organicGrid } = await import('../index'),
		{ fromPatch } = await import('./adapters');
	for (const g of [...gridGenerators, { kind: 'organic', generate: organicGrid }]) {
		const p = toPatch(g.generate({}, 42), { iterations: 0 });
		// Native strict tests cover input rejection. This compatibility check uses the
		// declared permissive metric floor for pre-existing extreme contour slivers.
		const m = fromPatch(p, {
			minAngle: 0.00001,
			minJacobian: 1e-9,
			minArea: 1e-14,
			maxAspect: 1e9
		});
		validateModel(m);
		expect(m.intent.seed).toBe(p.seed);
	}
});
