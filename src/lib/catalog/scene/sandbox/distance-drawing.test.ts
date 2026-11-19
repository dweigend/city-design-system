// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { expect, test } from 'bun:test';
import { BLICK } from '../../data/leitstil';
import type { Primitive, Vec3 } from '../../logic/parametrik/types';
import { deckParts } from '../../logic/walkway/span';
import { contourWidthMeters } from './contour-width';
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
	expect(contourWidthMeters(disc, 0) * city.scale).toBeCloseTo(10, 8);
	expect(contourWidthMeters(disc, city.elevation) * city.scale).toBeCloseTo(0.5, 8);
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

test('oblique indexed panels use the minimum silhouette width and ignore unused vertices', () => {
	const mesh: Primitive = {
		id: 'panel',
		material: 'concrete',
		role: 'neu',
		token: '--paper',
		kind: 'mesh',
		points: [
			[0, 0, 0],
			[4, 4, 0],
			[3, 5, 0],
			[-1, 1, 0],
			[100, 0, 0]
		],
		triangles: [0, 1, 2, 0, 2, 3],
		lines: []
	};
	expect(contourWidthMeters(mesh, Math.PI / 2)).toBeCloseTo(Math.SQRT2, 10);
	expect(contourWidthMeters({ ...mesh, triangles: [0, 0, 0] }, Math.PI / 2)).toBe(0);
});

test('translated and rotated garden trays keep the inclusive six-pixel plan contour', () => {
	for (const x of [0, 43.380373247743925, 1e14]) {
		const tray: Primitive = {
			id: 'tray',
			kind: 'box',
			role: 'neu',
			material: 'glaze',
			token: '--paper',
			position: [x, -x, 24.59],
			size: [4, 3, 0.5],
			rotation: 1.7534404827208785
		};
		const distance = { ...city, scale: 2 };
		expect(contourWidthMeters(tray, city.elevation) * 2).toBeCloseTo(6, 10);
		expect(distanceDrawing([tray], distance).unoutlined.size).toBe(0);
		expect(distanceDrawing([tray], { ...distance, scale: 2 * (1 - 1e-7) }).unoutlined.size).toBe(0);
		expect(distanceDrawing([tray], { ...distance, scale: 2 * (1 - 2e-6) }).unoutlined.size).toBe(1);
	}
});
