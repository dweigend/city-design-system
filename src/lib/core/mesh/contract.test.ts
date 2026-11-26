import { expect, test } from 'bun:test';
import { crossProduct, displacement, dotProduct, length, unitVector, type Vec3 } from '../geometry';
import { example } from './example';
import { createMeshObject, createSweptTube, mesh } from './index';

test('retains metric width and geometry when appending another mesh', () => {
	const ribbon = example();
	expect(ribbon.footprint).toEqual({ width: 4, depth: 1 });
	const { shape } = ribbon.parts[0];
	if (shape.kind !== 'mesh') throw Error('Expected ribbon mesh');
	const merged = mesh();
	merged.append(shape);
	expect(createMeshObject('ribbon', { deck: merged }, [])).toEqual(ribbon);
});

function vertex(positions: readonly number[], index: number): Vec3 {
	const offset = index * 3;
	return [positions[offset], positions[offset + 1], positions[offset + 2]];
}

const radialSegments = 12;
const dimensions = { radius: 0.2, radialSegments };
const bend = [
	[0, 0, 0],
	[4, 0, 0],
	[4, 0, 3],
	[4, 3, 3]
] as const;

test('transports a shared ring through horizontal, vertical and spatial turns', () => {
	const startTransverse = [0, 1, 0] as const;
	const { body, anchors } = createSweptTube(bend, { ...dimensions, startTransverse });
	expect(body.positions).toHaveLength(bend.length * radialSegments * 3);
	expect(body.indices).toHaveLength((bend.length - 1) * radialSegments * 6);
	for (const [i, point] of bend.entries()) {
		const offset = displacement(point, vertex(body.positions, i * radialSegments));
		expect(length(offset)).toBeCloseTo(dimensions.radius, 12);
		if (i < 2) expect(dotProduct(unitVector(offset), startTransverse)).toBeCloseTo(1, 12);
	}
	const first = body.indices.slice(0, 3).map((index) => vertex(body.positions, index));
	const outward = crossProduct(displacement(first[0], first[1]), displacement(first[0], first[2]));
	expect(dotProduct(outward, startTransverse)).toBeGreaterThan(0);
	expect(anchors[0].normal[0]).toBe(-1);
	expect(anchors[1].normal[1]).toBe(1);
	const beforeSpatial = unitVector(displacement(bend[1], vertex(body.positions, radialSegments)));
	const afterSpatial = unitVector(
		displacement(bend[2], vertex(body.positions, 2 * radialSegments))
	);
	const transportAxis = unitVector(crossProduct([1, 0, 1], [0, 1, 1]));
	expect(dotProduct(beforeSpatial, transportAxis)).toBeCloseTo(
		dotProduct(afterSpatial, transportAxis),
		12
	);
});

test('honors both endpoint transverses and distributes a half-turn by arc length', () => {
	const run = [
		[0, 0, 0],
		[1, 0, 0],
		[4, 0, 0]
	] as const;
	const options = {
		...dimensions,
		startTransverse: [0, 1, 0],
		endTransverse: [0, -1, 0]
	} as const;
	const { body, anchors } = createSweptTube(run, options);
	expect(createSweptTube(run, options)).toEqual({ body, anchors });
	expect(anchors[0].transverse).toEqual(options.startTransverse);
	expect(anchors[1].transverse?.[1]).toBeCloseTo(-1, 12);
	expect(anchors[1].transverse?.[2]).toBeCloseTo(0, 12);
	let previous: Vec3 = options.startTransverse;
	for (let i = 0; i < body.positions.length / (radialSegments * 3); i++) {
		const [x, y, z] = vertex(body.positions, i * radialSegments);
		const radial = unitVector([0, y, z]);
		expect(y).toBeCloseTo(dimensions.radius * Math.cos((Math.PI * x) / 4), 12);
		expect(z).toBeCloseTo(dimensions.radius * Math.sin((Math.PI * x) / 4), 12);
		expect(dotProduct(previous, radial)).toBeGreaterThan(0.7);
		previous = radial;
	}
});

test('an end-only constraint keeps a transported frame free of added twist', () => {
	const run = [
		[0, 0, 0],
		[4, 0, 0],
		[4, 0, 3]
	] as const;
	const endTransverse = [0, -1, 0] as const;
	const { body, anchors } = createSweptTube(run, { ...dimensions, endTransverse });
	expect(body.positions).toHaveLength(run.length * radialSegments * 3);
	expect(anchors[0].transverse?.[1]).toBeCloseTo(-1, 12);
	expect(anchors[1].transverse?.[1]).toBeCloseTo(-1, 12);
	for (const [i, point] of run.entries()) {
		const radial = unitVector(displacement(point, vertex(body.positions, i * radialSegments)));
		expect(dotProduct(radial, endTransverse)).toBeCloseTo(1, 12);
	}
});

test('sleeves are closed annuli at distinct endpoints, joints and repeated rib stations', () => {
	const { collars } = createSweptTube(
		[
			[0, 0, 0],
			[4, 0, 0],
			[8, 0, 0]
		],
		{
			...dimensions,
			collars: {
				innerRadius: 0.18,
				outerRadius: 0.24,
				width: 0.1,
				jointIndices: [0, 1, 1, 2],
				ribSpacing: 2
			}
		}
	);
	if (!collars) throw Error('Expected sleeves');
	const { positions, indices } = collars;
	const stations = [0, 2, 4, 6, 8];
	expect(positions).toHaveLength(stations.length * 4 * radialSegments * 3);
	for (const [i, x] of stations.entries()) {
		const offset = i * 4 * radialSegments;
		const [startX, innerY, innerZ] = vertex(positions, offset);
		const [endX, outerY, outerZ] = vertex(positions, offset + 2 * radialSegments);
		expect(startX).toBeCloseTo(x - 0.05, 12);
		expect(endX).toBeCloseTo(x + 0.05, 12);
		expect(Math.hypot(innerY, innerZ)).toBeCloseTo(0.18, 12);
		expect(Math.hypot(outerY, outerZ)).toBeCloseTo(0.24, 12);
	}
	const directedEdges = new Map<string, number>();
	for (let i = 0; i < indices.length; i += 3) {
		const [a, b, c] = indices.slice(i, i + 3);
		for (const [u, v] of [
			[a, b],
			[b, c],
			[c, a]
		]) {
			const key = `${u}/${v}`;
			directedEdges.set(key, (directedEdges.get(key) ?? 0) + 1);
		}
	}
	for (const [edge, count] of directedEdges) {
		const [a, b] = edge.split('/');
		expect(count).toBe(1);
		expect(directedEdges.get(`${b}/${a}`)).toBe(1);
	}

	const tight = createSweptTube(
		[
			[0, 0, 0],
			[3.05, 0, 0]
		],
		{
			...dimensions,
			collars: { innerRadius: 0.18, outerRadius: 0.24, width: 0.14, ribSpacing: 3 }
		}
	);
	expect(tight.collars?.positions).toHaveLength(2 * 4 * radialSegments * 3);
});

test('rejects invalid sweep geometry, endpoint orientations and sleeve options', () => {
	const invalidLines: readonly (readonly Vec3[])[] = [
		[],
		[[0, 0, 0]],
		[
			[0, 0, 0],
			[0, 0, 0]
		],
		[
			[0, 0, 0],
			[1, 0, 0],
			[-1, 0, 0]
		],
		[
			[0, 0, 0],
			[1, 0, 0],
			[0, 1, 0],
			[0, 0, 0]
		],
		[
			[0, 0, 0],
			[NaN, 0, 0]
		],
		[
			[-Number.MAX_VALUE, 0, 0],
			[Number.MAX_VALUE, 0, 0]
		],
		[
			[0, 1e16, 1e16],
			[1, 1e16, 1e16]
		]
	];
	for (const line of invalidLines)
		expect(() => createSweptTube(line, dimensions)).toThrow(RangeError);
	for (const radius of [0, -1, Infinity, NaN])
		expect(() => createSweptTube(bend, { ...dimensions, radius })).toThrow(RangeError);
	for (const radialSegments of [2, 3.5, Infinity, Number.MAX_SAFE_INTEGER])
		expect(() => createSweptTube(bend, { ...dimensions, radialSegments })).toThrow(RangeError);
	expect(() => createSweptTube(bend, { ...dimensions, startTransverse: [1, 0, 0] })).toThrow(
		RangeError
	);
	expect(() => createSweptTube(bend, { ...dimensions, endTransverse: [0, 0, 2] })).toThrow(
		RangeError
	);
	const collars = { innerRadius: 0.18, outerRadius: 0.24, width: 0.1 };
	for (const invalid of [
		{ ...collars, outerRadius: 0.1 },
		{ ...collars, width: -1 },
		{ ...collars, ribSpacing: 1e-8 },
		{ ...collars, jointIndices: [bend.length] }
	])
		expect(() => createSweptTube(bend, { ...dimensions, collars: invalid })).toThrow(RangeError);
});
