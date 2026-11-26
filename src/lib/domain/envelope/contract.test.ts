import { expect, test } from 'bun:test';
import { crossProduct, displacement, dotProduct, length, type Vec3 } from '../../core/geometry';
import type { MeshShape } from '../../core/mesh';
import { PlaceableObject } from '../../core/object';
import { canopySurvey, example } from './example';
import { createFacadeBands, createTensionPatch } from './index';

type Tri = readonly [Vec3, Vec3, Vec3];

function trianglesOf(shape: MeshShape): Tri[] {
	const vertex = (i: number): Vec3 => [
		shape.positions[3 * i],
		shape.positions[3 * i + 1],
		shape.positions[3 * i + 2]
	];
	const tris: Tri[] = [];
	for (let i = 0; i < shape.indices.length; i += 3) {
		tris.push([
			vertex(shape.indices[i]),
			vertex(shape.indices[i + 1]),
			vertex(shape.indices[i + 2])
		]);
	}
	return tris;
}

function samePoint(a: Vec3, b: Vec3) {
	return length(displacement(a, b)) < 1e-9;
}

function sharesVertex(a: Tri, b: Tri) {
	return a.some((p) => b.some((q) => samePoint(p, q)));
}

function segmentPiercesTriangle(p0: Vec3, p1: Vec3, [v0, v1, v2]: Tri) {
	const dir = displacement(p0, p1);
	const e1 = displacement(v0, v1);
	const e2 = displacement(v0, v2);
	const h = crossProduct(dir, e2);
	const det = dotProduct(e1, h);
	if (Math.abs(det) < 1e-12) return false;
	const inv = 1 / det;
	const s = displacement(v0, p0);
	const u = inv * dotProduct(s, h);
	if (u < -1e-9 || u > 1 + 1e-9) return false;
	const q = crossProduct(s, e1);
	const v = inv * dotProduct(dir, q);
	if (v < -1e-9 || u + v > 1 + 1e-9) return false;
	const t = inv * dotProduct(e2, q);
	return t > 1e-9 && t < 1 - 1e-9;
}

function assertCleanSurface(shape: MeshShape) {
	const tris = trianglesOf(shape);
	const keys = new Set<string>();
	for (const tri of tris) {
		expect(
			length(crossProduct(displacement(tri[0], tri[1]), displacement(tri[0], tri[2])))
		).toBeGreaterThan(0);
		const key = tri
			.map((p) => p.map((v) => Math.round(v * 1e6)).join(','))
			.sort()
			.join('|');
		expect(keys.has(key)).toBe(false);
		keys.add(key);
	}
	for (let i = 0; i < tris.length; i++) {
		for (let j = i + 1; j < tris.length; j++) {
			if (sharesVertex(tris[i], tris[j])) continue;
			const a = tris[i];
			const b = tris[j];
			const edgesA: readonly (readonly [Vec3, Vec3])[] = [
				[a[0], a[1]],
				[a[1], a[2]],
				[a[2], a[0]]
			];
			const edgesB: readonly (readonly [Vec3, Vec3])[] = [
				[b[0], b[1]],
				[b[1], b[2]],
				[b[2], b[0]]
			];
			expect(edgesA.some(([p, q]) => segmentPiercesTriangle(p, q, b))).toBe(false);
			expect(edgesB.some(([p, q]) => segmentPiercesTriangle(p, q, a))).toBe(false);
		}
	}
}

test('spans three frontage bays and leaves the vertical reveals open at the clips', () => {
	const { bands } = example();
	expect(bands.slots).toEqual(['envelope-band', 'envelope-clip']);
	expect(bands.anchors).toHaveLength(18);
	expect(new Set(bands.anchors.map(({ name }) => name)).size).toBe(18);
	expect(bands.anchors[0]).toMatchObject({ position: [-10, -4, 2.5], normal: [0, -1, 0] });
	expect(bands.anchors.at(-1)?.normal[0]).toBeGreaterThan(0);
	for (const { shape } of bands.parts) {
		if (shape.kind !== 'mesh') throw new Error('Expected indexed bands');
		const heights = shape.positions.filter((_, i) => i % 3 === 2);
		expect(heights.some((z) => z > 2.95 && z < 3.3)).toBe(false);
		expect(heights.some((z) => z > 4.2 && z < 4.55)).toBe(false);
	}
	expect(bands).toEqual(example().bands);
});

test('joins straight and right-angle bays without internal caps or intersecting surfaces', () => {
	const straight = createFacadeBands({
		id: 'straight',
		grips: [
			{ id: 'a', position: [0, 0, 1] },
			{ id: 'b', position: [2, 0, 1] },
			{ id: 'c', position: [4, 0, 1] }
		],
		bandCount: 1,
		bandHeightM: 0.4,
		pitchM: 1
	});
	const rightAngle = createFacadeBands({
		id: 'corner',
		grips: [
			{ id: 'a', position: [0, 0, 1] },
			{ id: 'b', position: [2, 0, 1] },
			{ id: 'c', position: [2, 2, 1] }
		],
		bandCount: 1,
		bandHeightM: 0.4,
		pitchM: 1
	});
	for (const object of [straight, rightAngle]) {
		const [bandPart, clipPart] = object.parts;
		if (bandPart.shape.kind !== 'mesh' || clipPart.shape.kind !== 'mesh')
			throw new Error('Expected indexed meshes');
		// One continuous 3-ring ribbon: 2 end caps + 2 segments × 4 quads = 20 triangles (no internal cap).
		expect(bandPart.shape.indices).toHaveLength(20 * 3);
		// Start cuff (12 tris) + joined interior cuff (20 tris) + end cuff (12 tris) = 44 triangles.
		expect(clipPart.shape.indices).toHaveLength(44 * 3);
		assertCleanSurface(bandPart.shape);
		assertCleanSurface(clipPart.shape);
	}
	const straightBand = straight.parts[0].shape;
	if (straightBand.kind !== 'mesh') throw new Error('Expected indexed band');
	// Verify no triangle lies entirely on the interior joint plane x = 2.
	const internalCapCount = trianglesOf(straightBand).filter((tri) =>
		tri.every(([x]) => Math.abs(x - 2) < 1e-9)
	).length;
	expect(internalCapCount).toBe(0);
});

test('passes through the surveyed grips with consistently outward-wound triangles', () => {
	const patch = createTensionPatch({ ...canopySurvey, subdivisions: 4 });
	const [body, cuffs] = patch.parts;
	expect(body.slot).toBe('membrane');
	expect(cuffs.slot).toBe('envelope-clip');
	const { shape } = body;
	if (shape.kind !== 'mesh') throw new Error('Expected indexed membrane');
	const vertex = (i: number): Vec3 => [
		shape.positions[3 * i],
		shape.positions[3 * i + 1],
		shape.positions[3 * i + 2]
	];
	expect(shape.positions).toHaveLength(25 * 3);
	expect(shape.indices).toHaveLength(32 * 3);
	expect([0, 4, 24, 20, 2, 22].map(vertex)).toEqual(patch.anchors.map(({ position }) => position));
	for (let i = 0; i < shape.indices.length; i += 3) {
		const [a, b, c] = shape.indices.slice(i, i + 3).map(vertex);
		expect(
			dotProduct(crossProduct(displacement(a, b), displacement(a, c)), [0, 0, 1])
		).toBeGreaterThan(0);
	}
	expect(vertex(12)[2]).toBeLessThan(8);
});

test('higher normalized tension lifts the interior while holding survey anchors fixed', () => {
	const loose = createTensionPatch({ ...canopySurvey, subdivisions: 4, tensionRatio: 0.1 });
	const tight = createTensionPatch({ ...canopySurvey, subdivisions: 4, tensionRatio: 1 });
	const sagged = loose.parts[0].shape;
	const taut = tight.parts[0].shape;
	if (sagged.kind !== 'mesh' || taut.kind !== 'mesh') throw new Error('Expected indexed membrane');
	expect(taut.positions[38]).toBeGreaterThan(sagged.positions[38]);
	expect(loose.anchors).toEqual(tight.anchors);
	expect(loose.parts[1]).toEqual(tight.parts[1]);
});

test('validates each result as a frozen, detached and color-free object', () => {
	const position: [number, number, number] = [...canopySurvey.corners[0].position];
	const patch = createTensionPatch({
		...canopySurvey,
		corners: [
			{ id: 'south-west', position },
			canopySurvey.corners[1],
			canopySurvey.corners[2],
			canopySurvey.corners[3]
		]
	});
	position[2] = 20;
	expect(patch.anchors[0].position).toEqual(canopySurvey.corners[0].position);
	for (const object of [patch, example().bands]) {
		expect(PlaceableObject.isValidated(object)).toBe(true);
		expect(Object.isFrozen(object.parts[0].shape)).toBe(true);
		expect(Object.isFrozen(object.anchors[0].position)).toBe(true);
		expect(JSON.stringify(object)).not.toMatch(/"(?:color|material|finish)"|#[a-f\d]{3,8}\b/i);
	}
});

test('rejects invalid surveys and dimensions with RangeError', () => {
	const [a, b, c, d] = canopySurvey.corners;
	const patch = { id: 'invalid', corners: [a, b, c, d] as const };
	for (const override of [
		{ subdivisions: 0 },
		{ subdivisions: 129 },
		{ sagRatio: NaN },
		{ sagRatio: -0.1 },
		{ tensionRatio: 0 },
		{ tensionRatio: 1.1 },
		{
			corners: [
				a,
				c,
				{ ...b, position: [10, -4, 10] as const },
				{ ...d, position: [-10, 4, 10] as const }
			] as const
		},
		{ corners: [a, b, { ...c, position: b.position }, d] as const },
		{ corners: [a, b, { ...c, position: [Infinity, 4, 10] as const }, d] as const }
	])
		expect(() => createTensionPatch({ ...patch, ...override })).toThrow(RangeError);
	expect(() => createTensionPatch({ ...canopySurvey, subdivisions: 3 })).toThrow(RangeError);
	expect(() =>
		createTensionPatch({
			...patch,
			edgeGrips: [{ id: 'edge', position: [1, -4, 8] }, undefined, undefined, undefined]
		})
	).toThrow(RangeError);

	const bands = { id: 'facade', grips: [a, b], bandCount: 2, bandHeightM: 0.5, pitchM: 1 };
	for (const override of [
		{ bandCount: 0 },
		{ bandCount: 2.5 },
		{ bandCount: Number.MAX_SAFE_INTEGER },
		{ pitchM: Infinity },
		{ pitchM: 0.5 },
		{ grips: [a, { ...b, position: a.position }] },
		{ grips: [a, c, b, d] },
		{
			grips: [
				{ id: 'a', position: [0, 0, 2] as const },
				{ id: 'b', position: [6, 0, 2] as const },
				{ id: 'c', position: [3, 0, 2] as const }
			]
		},
		{
			grips: [
				{ id: 'a', position: [0, 0, 1] as const },
				{ id: 'b', position: [2, 0, 1] as const }
			],
			bandCount: 1,
			bandHeightM: 1e-18,
			pitchM: 2
		},
		{ grips: [a, { ...b, id: a.id }] }
	])
		expect(() => createFacadeBands({ ...bands, ...override })).toThrow(RangeError);
});
