import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { hash } from '../hash-random';
import { buildRoofFrame, type RoofCell } from './index';

type Ring = RoofCell['polygon'];
const rectangle: Ring = [
	[0, 0],
	[0, 12],
	[-4, 12],
	[-4, 0]
];
const cell = (polygon: Ring): RoofCell => ({ id: 'a', height: 4, polygon });

function* surveys(ring: Ring) {
	for (const order of [ring, [...ring].reverse()])
		for (let i = 0; i < order.length; i++) yield [...order.slice(i), ...order.slice(0, i)];
}
function generatedRing(seed: number): Ring {
	// Integer affine images of convex templates keep inserted dyadic midpoints exactly collinear.
	const templates: Ring[] = [
		[
			[0, 0],
			[4, 0],
			[0, 3]
		],
		[
			[0, 0],
			[4, 0],
			[3, 3],
			[0, 4]
		],
		[
			[0, 0],
			[3, 0],
			[5, 2],
			[3, 4],
			[0, 3]
		],
		[
			[0, 1],
			[2, 0],
			[4, 1],
			[4, 3],
			[2, 4],
			[0, 3]
		]
	];
	const draw = (channel: number, limit: number) => Math.floor(hash(seed, 0, channel) * limit);
	const sx = 1 + draw(1, 4),
		sy = 1 + draw(2, 4),
		shear = draw(3, 5) - 2;
	return templates[draw(0, templates.length)].map(([x, y]) => [
		sx * x + shear * y + seed,
		sy * y - seed
	]);
}
function subdivide(ring: Ring, seed: number): Ring {
	return ring.flatMap((a, i) => {
		const b = ring[(i + 1) % ring.length];
		if (i && hash(seed, i, 5) < 0.5) return [a];
		const mid: Ring[number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
		return [a, mid];
	});
}

function bearings(frame: ReturnType<typeof buildRoofFrame>) {
	if (!frame) return;
	const ids = new Set(frame.structure.lager.map((b) => b.knotenId));
	return frame.structure.knoten.filter((n) => ids.has(n.id));
}
test('a 4 by 12 m roof fits the verified 7 m span in every survey order', () => {
	for (const ring of surveys(rectangle)) {
		const result = buildRoofFrame([cell(ring)], { maxSpan: 7 });
		assert.equal(result?.analysis.status, 'ok');
		assert.deepEqual(
			bearings(result)?.map((n) => n.p),
			[
				[0, 6, 4],
				[-2, 12, 4],
				[-4, 6, 4]
			]
		);
	}
});

test('sampled roofs retain solvability and bearing identities across wall subdivisions and survey orders', () => {
	const outcomes = new Set<boolean>();
	for (let seed = 0; seed < 48; seed++) {
		const source = generatedRing(seed),
			maxSpan = 4 + Math.floor(hash(seed, 0, 4) * 10);
		for (const ring of [
			source,
			source.map(([x, y]): Ring[number] => [-y, x]),
			source.map(([x, y]): Ring[number] => [-x, y])
		]) {
			const expected = buildRoofFrame([cell(ring)], { maxSpan });
			outcomes.add(expected?.analysis.status === 'ok');
			for (const polygon of surveys(subdivide(ring, seed))) {
				assert.deepEqual(buildRoofFrame([cell(polygon)], { maxSpan }), expected, 'seed ' + seed);
			}
		}
	}
	assert.equal(outcomes.size, 2);
});

// Frozen from buildRoofFrame at 7f270be. For each seed, sweep integer maxSpan from
// 1 to 50 for every start and winding and retain the smallest limit that solved.
const legacySpans = [
	10, 12, 9, 17, 6, 13, 11, 7, 14, 9, 16, 10, 9, 12, 4, 10, 13, 13, 9, 13, 9, 11, 8, 15, 13, 13, 9,
	9, 16, 11, 7, 15, 14, 6, 8, 8, 11, 13, 9, 14, 16, 11, 9, 10, 12, 7, 5, 13
];
test('every minimum solvable span in the 7f270be roof corpus still solves', () => {
	for (const [seed, maxSpan] of legacySpans.entries()) {
		assert.equal(
			buildRoofFrame([cell(generatedRing(seed))], { maxSpan })?.analysis.status,
			'ok',
			'legacy seed ' + seed
		);
	}
});
test('retains the 7f270be two-roof solution when local choices cannot connect', () => {
	const second: Ring = rectangle.map(([x, y]) => [x + 9, y + 4]);
	assert.equal(
		buildRoofFrame([cell(rectangle), { ...cell(second), id: 'b' }], { maxSpan: 8 })?.analysis
			.status,
		'ok'
	);
});

test('rigid rotations and reflections carry the bearings with an asymmetric roof', () => {
	const maps: ((p: Ring[number]) => Ring[number])[] = [([x, y]) => [-y, x], ([x, y]) => [-x, y]];
	let solved = 0;
	for (let seed = 0; seed < 48; seed++) {
		// Dyadic offsets distinguish symmetric template corners and keep subdivisions exact.
		const ring = generatedRing(seed).map(([x, y], i): Ring[number] =>
			i === 0 ? [x + 1 / 8, y + 1 / 32] : [x, y]
		);
		const maxSpan = 4 + Math.floor(hash(seed, 0, 4) * 10);
		const original = buildRoofFrame([cell(ring)], { maxSpan });
		if (original) solved++;
		for (const transform of maps) {
			const outline = subdivide(ring.map(transform), seed).reverse();
			const i = seed % outline.length;
			const result = buildRoofFrame([cell([...outline.slice(i), ...outline.slice(0, i)])], {
				maxSpan
			});
			assert.equal(result?.analysis.status, original?.analysis.status);
			const feet = bearings(original)?.map((n) => ({
				id: n.id,
				p: [...transform([n.p[0], n.p[1]]), n.p[2]]
			}));
			assert.deepEqual(bearings(result), feet, 'seed ' + seed);
		}
	}
	assert.ok(solved > 0 && solved < 48);
});
