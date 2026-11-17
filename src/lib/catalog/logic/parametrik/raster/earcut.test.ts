import { describe, expect, test } from 'bun:test';
import { ShapeUtils, Vector2 } from 'three';
import type { Point2 } from '../vocab';
import { random } from '../random';
import { triangulate } from './earcut';
import { triangles } from './geometry';
import { contourGrid, gridGenerators, voronoiGrid } from './index';
import { organicGrid } from './universal';

/** The former implementation of `triangles`: three.js earcut, kept here as the reference. */
const reference = (ring: Point2[]) =>
	ShapeUtils.triangulateShape(
		ring.map((v) => new Vector2(...v)),
		[]
	);

const L: Point2[] = [
	[0, 0],
	[30, 0],
	[30, 10],
	[10, 10],
	[10, 30],
	[0, 30]
];

function star(n: number, inner: number, outer: number, rng = () => 0.5): Point2[] {
	return Array.from({ length: n }, (_, i) => {
		const a = (i / n) * 2 * Math.PI;
		const r = (i % 2 ? inner : outer) * (0.6 + 0.8 * rng());
		return [r * Math.cos(a), r * Math.sin(a)];
	});
}

/** Random rings, including self-intersecting ones that reach earcut's fallback passes. */
function randomRing(n: number, seed: number, integer: boolean): Point2[] {
	const rng = random(seed);
	return Array.from({ length: n }, () => {
		const p: Point2 = [rng() * 40 - 20, rng() * 40 - 20];
		return integer ? [Math.round(p[0] / 4), Math.round(p[1] / 4)] : p;
	});
}

function generatedRings(): Point2[][] {
	const rings: Point2[][] = [];
	for (const generator of gridGenerators)
		for (const seed of [0, 42, 317])
			for (const pick of ['min', 'max'] as const) {
				const input = Object.fromEntries(generator.params.map((p) => [p.key, p[pick]]));
				rings.push(...generator.generate(input, seed).cells.map((c) => c.polygon));
			}
	rings.push(...contourGrid(L, 5, 17).cells.map((c) => c.polygon));
	rings.push(...voronoiGrid(L, 40, 7, 3).cells.map((c) => c.polygon));
	for (const seed of [0, 42]) rings.push(...organicGrid({}, seed).cells.map((c) => c.polygon));
	return rings;
}

function syntheticRings(): Point2[][] {
	const rings: Point2[][] = [L, [...L].reverse(), [...L, L[0]], [...L].reverse().concat([L[5]])];
	for (const n of [6, 24, 81, 82, 160, 400]) {
		rings.push(star(n, 8, 20), star(n, 8, 20, random(n)), star(n, 8, 20, random(n)).reverse());
	}
	for (let seed = 0; seed < 200; seed++) {
		rings.push(randomRing(4 + (seed % 40), seed, seed % 2 === 0));
		if (seed < 20) rings.push(randomRing(90 + seed, seed, seed % 2 === 0));
	}
	rings.push(
		[],
		[[0, 0]],
		[
			[0, 0],
			[1, 1]
		],
		[
			[0, 0],
			[1, 0],
			[2, 0],
			[3, 0]
		],
		[
			[0, 0],
			[0, 0],
			[0, 0],
			[0, 0]
		],
		[
			[0, 0],
			[2, 2],
			[2, 0],
			[0, 2]
		],
		[
			[0, 0],
			[4, 0],
			[4, 0],
			[4, 4],
			[2, 4],
			[2, 2],
			[2, 4],
			[0, 4]
		]
	);
	return rings;
}

describe('earcut port', () => {
	test.each([
		['generated grid cells', generatedRings],
		['synthetic rings', syntheticRings]
	] as const)('matches three.js triangulation order exactly for %s', (_, rings) => {
		let triangulated = 0;
		for (const ring of rings()) {
			const expected = reference(ring);
			const actual: number[][] = triangulate(ring);
			expect(actual).toEqual(expected);
			expect(triangles(ring)).toEqual(expected.map((t) => t.map((i) => ring[i])));
			if (expected.length > 1) triangulated++;
		}
		expect(triangulated).toBeGreaterThan(10);
	});

	test('does not mutate the input ring', () => {
		const ring = [...L, L[0]];
		const copy = structuredClone(ring);
		triangulate(ring);
		expect(ring).toEqual(copy);
	});
});
