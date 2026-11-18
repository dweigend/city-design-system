import assert from 'node:assert/strict';
import { test } from 'node:test';
import init, { type Vec2 } from 'manifold-3d';
import { hash } from '../hash-random';
import {
	buildEnvelope,
	roundFootprint,
	offsetFootprint,
	type EnvelopeMesh,
	type Roof
} from './index';
const kernel = await init();
kernel.setup();
const roofs: Roof[] = ['hip', 'gable', 'sawtooth', 'shed'];
test('changing the first survey point, winding or wall subdivisions preserves the complete mesh', () => {
	const outline: Vec2[] = [
		[0, 0],
		[12, 0],
		[9, 4],
		[4, 3],
		[0, 3]
	];
	for (const roof of roofs) {
		const build = (polygon: Vec2[]) =>
			buildEnvelope(kernel, [
				{
					polygon,
					roof,
					params: { pitch: 0.31 },
					grade: [0.02, -0.1],
					storeys: [{}, { offset: -0.2, radius: 0.25 }]
				}
			]);
		const expected = build(outline);
		const surveyed: Vec2[] = [[0, 0], [0.00000001, 0], [1, 0], [4, 0], ...outline.slice(1), [0, 1]];
		for (const ring of [surveyed, [...surveyed].reverse()]) {
			for (let i = 0; i < ring.length; i++) {
				const rotated = ring.slice(i).concat(ring.slice(0, i));
				assert.deepEqual(build([...rotated, rotated[0]]), expected);
			}
		}
	}
});

function rotate(ring: Vec2[], i: number) {
	return [...ring.slice(i), ...ring.slice(0, i)];
}

// Triangle signatures preserve winding and shell membership while ignoring vertex and face numbering.
function faces(mesh: EnvelopeMesh) {
	const point = (i: number) =>
		Array.from(mesh.positions.subarray(3 * i, 3 * i + 3), (v, j) => v + mesh.origin[j]).join(',');
	let start = 0;
	return mesh.shellIndexEnds
		.map((end) => {
			const triangles: string[] = [];
			for (let i = start; i < end; i += 3) {
				const [a, b, c] = Array.from(mesh.indices.subarray(i, i + 3), point);
				triangles.push(
					[
						[a, b, c],
						[b, c, a],
						[c, a, b]
					]
						.map((t) => t.join(';'))
						.sort()[0]
				);
			}
			start = end;
			return triangles.sort().join('|');
		})
		.sort();
}
function checkSurvey(ring: Vec2[], survey: Vec2[], roof: Roof, direction = 0) {
	const build = (polygon: Vec2[]) =>
		buildEnvelope(kernel, [{ polygon, roof, params: { pitch: 0.31, direction } }]);
	assert.deepEqual(roundFootprint(survey, 0), roundFootprint(ring, 0));
	assert.deepEqual(offsetFootprint(kernel, survey, -0.125), offsetFootprint(kernel, ring, -0.125));
	assert.deepEqual(faces(build(survey)), faces(build(ring)));
}
test('an exact closing-wall station cannot choose which near-coincident corner survives', () => {
	const d = 2 ** -24;
	const ring: Vec2[] = [
		[0, 0],
		[2, -2],
		[6, 0],
		[4, 4],
		[4 - d, 4 + d]
	];
	checkSurvey(ring, [...ring, [(4 - d) / 4, (4 + d) / 4]], 'hip');
});
function generatedRing(seed: number): Vec2[] {
	const directions: Vec2[] = [
		[1, 0],
		[1, 1],
		[0, 1],
		[-1, 1],
		[-1, 0],
		[-1, -1],
		[0, -1],
		[1, -1]
	];
	const ring: Vec2[] = directions.map(([x, y], i) => {
		const r = 2 + Math.floor(10 * hash(seed, i, 0));
		return [x * r, y * r];
	});
	// A short bevel straddles the tolerance threshold. All coordinates stay dyadic.
	const d = seed % 2 ? 2 ** -24 : 0.125;
	ring.splice(1, 0, [ring[0][0] + d, d]);
	return rotate(ring, seed % ring.length);
}
function subdivide(ring: Vec2[], seed: number) {
	return ring.flatMap((a, i) => {
		const b = ring[(i + 1) % ring.length];
		const points = [a];
		for (let j = 1; j <= 3; j++) {
			if (hash(seed, i, j) < 0.5 || (i === ring.length - 1 && j === 2)) {
				const t = j / 4;
				points.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
			}
		}
		return points;
	});
}
test('seeded simple rings retain their oriented triangles after resampling every wall cyclically', () => {
	for (let seed = 0; seed < 96; seed++) {
		const ring = generatedRing(seed),
			survey = subdivide(ring, seed);
		const rotated = rotate(survey, Math.floor(hash(seed, 0, 4) * survey.length));
		for (const variant of [rotated, [...rotated].reverse()])
			checkSurvey(ring, variant, roofs[seed % 4], hash(seed, 1, 5) * Math.PI);
	}
});
