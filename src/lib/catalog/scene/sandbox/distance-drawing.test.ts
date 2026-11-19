// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { expect, test } from 'bun:test';
import { BLICK } from '../../data/leitstil';
import type { Primitive, Vec3 } from '../../logic/parametrik/types';
import { deckParts } from '../../logic/walkway/span';
import { distanceDrawing, sameDrawing } from './distance-drawing';

const city = { elevation: Math.PI / 2, block: true, scale: 2.5, minContourPx: 6 };
const ring: Primitive = {
	id: 'stop',
	kind: 'torus',
	position: [0, 0, 0],
	radius: 10,
	tube: 0.2,
	role: 'neu',
	material: 'concrete',
	token: '--cat-nature'
};

test('the city outline threshold uses the stop ring section in CSS pixels', () => {
	const narrow = distanceDrawing([ring], city);
	expect(narrow.parts).toEqual([ring]);
	expect(narrow.unoutlined.has(ring)).toBe(true);
	expect(sameDrawing(narrow, distanceDrawing([ring], { ...city, scale: 3 }))).toBe(true);
	const threshold = distanceDrawing([ring], { ...city, scale: 15 });
	expect(threshold.unoutlined.has(ring)).toBe(false);
	expect(sameDrawing(narrow, threshold)).toBe(false);
	expect(distanceDrawing([ring], { ...city, block: false }).unoutlined.size).toBe(0);
});

test('a solid façade disc only keeps its contour when its projected width meets the threshold', () => {
	const disc: Primitive = {
		id: 'window',
		kind: 'ring',
		position: [0, 0, 0],
		radius: 2,
		innerRadius: 0,
		depth: 0.2,
		rotation: BLICK.azimutRad + Math.PI / 2,
		role: 'neu',
		material: 'concrete',
		token: '--cat-nature'
	};
	const faceOn = distanceDrawing([disc], { ...city, elevation: 0 });
	expect(faceOn.unoutlined.has(disc)).toBe(false);
	const edgeOn = distanceDrawing([disc], city);
	expect(edgeOn.parts).toEqual([disc]);
	expect(edgeOn.unoutlined.has(disc)).toBe(true);
	const horizontal = { ...disc, tilt: Math.PI / 2 };
	expect(distanceDrawing([horizontal], city).unoutlined.has(horizontal)).toBe(false);
});

test('a narrow path keeps its fill when viewed diagonally in the plan', () => {
	const path: Primitive = {
		id: 'path',
		kind: 'box',
		position: [0, 0, 0],
		size: [20, 2, 1],
		rotation: Math.PI / 4,
		role: 'neu',
		material: 'concrete',
		token: '--cat-nature'
	};
	expect(distanceDrawing([path], city).unoutlined.has(path)).toBe(true);
	expect(distanceDrawing([path], { ...city, scale: 4 }).unoutlined.has(path)).toBe(false);
});

test('sloped walkways keep a continuous surface at city zoom', () => {
	const corners: [Vec3, Vec3, Vec3, Vec3] = [
		[0, 0, 2],
		[0, 2, 2],
		[8, 2, 5],
		[8, 0, 5]
	];
	const parts = deckParts(corners, 'walk', 2, '--cat-nature', undefined, true);
	const overview = distanceDrawing(parts, city);
	expect(overview.details).toBe(false);
	expect(overview.parts).toHaveLength(1);
	expect(overview.parts[0]).toMatchObject({ kind: 'membrane', corners, token: '--cat-nature' });
	expect(overview.unoutlined.has(overview.parts[0])).toBe(true);
	const closer = distanceDrawing(parts, { ...city, block: false });
	expect(closer.details).toBe(true);
	expect(closer.parts).toEqual(parts);
	expect(closer.parts.filter(({ kind }) => kind === 'polyline')).toHaveLength(2);
});
