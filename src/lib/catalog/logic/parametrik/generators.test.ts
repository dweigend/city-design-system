import { describe, expect, test } from 'bun:test';
import { random } from './random';
import { box, type Primitive, type Vec3 } from './types';
import { welt, weltDefaults, type WeltParams } from './welt';
import { createPatch, type Patch } from './eckraster/topology';
import { fixture, fixtureNames } from './eckraster/fixtures';
import { slots } from './eckraster/derive';
import { presentation } from './eckraster/presentation';
import { eckModul } from './formen/eck';
import { formFamilies } from './formen';
import { cellContext, cellShapes, defaults } from './formen/zellen';

/**
 * C-50 regression net for the main generators (welt, eckraster, formen) through the entry points
 * their consumers use. A same-seed rerun alone proves nothing about a refactor, so each generator
 * is pinned to a frozen fingerprint: the ID list (identity and output order) and the full output
 * with numbers quantized to 1 µm (1e-6 in meters or radians), hashed with FNV-1a.
 * A golden changes only through a documented author decision, never to make a refactor pass.
 */
const fnv1a = (text: string) => {
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
	return (h >>> 0).toString(16).padStart(8, '0');
};
const quantized = (value: unknown) =>
	JSON.stringify(value, (_key, x) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x));
const fingerprint = (primitives: Primitive[]) => ({
	count: primitives.length,
	ids: fnv1a(primitives.map((p) => p.id).join('\n')),
	data: fnv1a(quantized(primitives))
});
/**
 * Runs `generate` and asserts that it left every input structurally unchanged. A snapshot
 * comparison instead of Object.freeze: frozen arrays push JSC onto slow paths for the whole run.
 */
function untouched<T>(inputs: unknown[], generate: () => T): T {
	const before = JSON.stringify(inputs),
		result = generate();
	expect(JSON.stringify(inputs)).toBe(before);
	return result;
}
const finite = (value: unknown) =>
	JSON.stringify(value, (_key, x) => {
		if (typeof x === 'number' && !Number.isFinite(x)) throw new Error(`non-finite ${x}`);
		return x;
	});
/** A few dozen seeds from our own PRNG, spanning the full seed range. */
const loopSeeds = (count: number) => {
	const rng = random(20261117);
	return Array.from({ length: count }, () => Math.floor(rng() * 4294967296));
};

describe('welt: identity, order, mutation and golden', () => {
	// Seeds that no other test uses, so the module-level structure cache starts cold here.
	const cases: { params: WeltParams; golden: ReturnType<typeof fingerprint> }[] = [
		{
			params: { ...weltDefaults, seed: 7 },
			golden: { count: 11743, ids: '72c6b335', data: '15280e72' }
		},
		{
			params: { ...weltDefaults, seed: 11, raster: 'voronoi', verzug: 0.4 },
			golden: { count: 11482, ids: 'cd0ea9f5', data: '0874008a' }
		}
	];

	test('frozen fingerprint for fixed parameters; the input is not written', () => {
		for (const { params, golden } of cases) {
			const input = { ...params },
				w = untouched([input], () => welt(input));
			expect(new Set(w.primitives.map((p) => p.id)).size).toBe(w.primitives.length);
			expect(fingerprint(w.primitives)).toEqual(golden);
		}
	});

	test('the seed is normalized with `>>> 0` at the boundary (PD-2)', () => {
		const of = (seed: number) => JSON.stringify(welt({ ...weltDefaults, seed }));
		// Interleave another seed so the single-entry cache is evicted between the compared calls.
		const minusOne = of(-1);
		of(3);
		expect(of(4294967295)).toBe(minusOne);
	});
});

describe('eckraster: identity, order, mutation and golden', () => {
	const pointOf = (p: Patch, id: string) => {
		const vertex = p.vertices.find((v) => v.id === id);
		if (!vertex) throw new Error(`missing vertex ${id}`);
		return vertex.point;
	};
	const scene = (seed: number, name: (typeof fixtureNames)[number]['id']) => {
		const p = createPatch(seed),
			o = untouched([p], () => fixture(p, name)),
			s = untouched([p, o], () => slots(p, o));
		return untouched([p, o, s], () => presentation(p, o, s, eckModul, true, true));
	};

	test('frozen fingerprint for every fixture on patch 42; inputs are not written', () => {
		const prints = Object.fromEntries(
			fixtureNames.map(({ id }) => [id, fingerprint(scene(42, id))])
		);
		expect(prints).toEqual({
			aufstockung: { count: 1144, ids: '694a0e0d', data: 'be4f20fb' },
			geruestturm: { count: 1933, ids: '8b87916f', data: 'a70c9f08' },
			hochweg: { count: 947, ids: '49c6f46b', data: '350dd22b' },
			'hochweg-turm': { count: 1314, ids: '788d2d85', data: 'f24d77f9' },
			hof: { count: 1446, ids: 'b231df27', data: 'fc6a214b' },
			huelle: { count: 742, ids: '37de0687', data: '640a831c' },
			quartier: { count: 1915, ids: '52f4a84f', data: '127cdaf1' }
		});
	});

	test('patch IDs and order are seed-independent; geometry follows the declared draw sequence', () => {
		const reference = createPatch(42);
		for (const seed of loopSeeds(24)) {
			const p = createPatch(seed);
			expect(p.vertices.map((v) => v.id)).toEqual(reference.vertices.map((v) => v.id));
			expect(p.faces).toEqual(reference.faces);
			expect(p.cells.map((c) => c.id)).toEqual(reference.cells.map((c) => c.id));
			// PD-6: draw i of random(seed) sets rim i to radius 17 + 1.3·uᵢ at plan angle i·2π/5,
			// counter-clockwise from +x in the x/y ground plane (PE-1).
			const rng = random(seed);
			for (let i = 0; i < 5; i++) {
				const [x, y] = pointOf(p, `rim${i}`),
					a = (i * 2 * Math.PI) / 5,
					r = 17 + rng() * 1.3;
				expect(x).toBeCloseTo(r * Math.cos(a), 9);
				expect(y).toBeCloseTo(r * Math.sin(a), 9);
			}
		}
	});

	test('faces wind counter-clockwise in the x/y ground plane for every seed (PE-1)', () => {
		for (const seed of loopSeeds(24)) {
			const p = createPatch(seed);
			for (const f of p.faces) {
				const ring = f.vertices.map((id) => pointOf(p, id));
				const twiceArea = ring.reduce((sum, [x0, y0], i) => {
					const [x1, y1] = ring[(i + 1) % ring.length];
					return sum + x0 * y1 - x1 * y0;
				}, 0);
				expect(twiceArea).toBeGreaterThan(0);
			}
		}
	});
});

describe('formen: identity, order, mutation and golden', () => {
	const generateAll = (seed: number) =>
		formFamilies.flatMap((family) =>
			cellShapes.flatMap((shape) => {
				const ctx = cellContext(shape, seed),
					params = defaults(family);
				return untouched([ctx, params], () => family.generate(ctx, params)).map((p) => ({
					...p,
					id: `${family.id}/${shape}/${p.id}`
				}));
			})
		);

	test('frozen fingerprint of every family on every test cell with defaults; inputs not written', () => {
		expect(formFamilies.length).toBe(44);
		expect(fingerprint(generateAll(3))).toEqual({ count: 2054, ids: '6a7d7c18', data: 'fb203919' });
	});

	test('unique IDs and finite numbers over a bounded seed loop', () => {
		for (const seed of loopSeeds(4)) {
			const out = generateAll(seed);
			expect(new Set(out.map((p) => p.id)).size).toBe(out.length);
			expect(() => finite(out)).not.toThrow();
		}
	});
});

describe('box ownership', () => {
	test('keeps the position and size arrays by reference, as documented', () => {
		const position: Vec3 = [1, 2, 3],
			size: Vec3 = [4, 5, 6];
		const b = box('b', position, size);
		expect(b.kind === 'box' && b.position).toBe(position);
		expect(b.kind === 'box' && b.size).toBe(size);
	});
});
