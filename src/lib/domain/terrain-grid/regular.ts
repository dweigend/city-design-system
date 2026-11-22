import type { Vec2 } from '../../core/geometry';
import type { Candidate, Carrier } from './carrier';
import { axes } from './site';

type Ring = readonly Vec2[];
type Chart = (x: number, y: number) => Vec2;
const hexRise = Math.sqrt(3) / 2;
const squareRing: Ring = [
	[0, 0],
	[1, 0],
	[1, 1],
	[0, 1]
];
const hexRing: Ring = [
	[2, 0],
	[1, 1],
	[-1, 1],
	[-2, 0],
	[-1, -1],
	[1, -1]
];

export function addressCarrier(
	chart: Chart,
	point: (i: number, j: number) => Vec2,
	rings: (i: number, j: number) => readonly Ring[],
	warp: Chart = (x, y) => [x, y]
): Carrier {
	return function* (site, outline, bearing, size) {
		const { toLocal, toWorld } = axes(bearing);
		const local = outline.map(([x, y]) =>
			toLocal((x - site.origin[0]) / size, (y - site.origin[1]) / size)
		);
		const ij = local.map(([x, y]) => chart(x, y));
		const rows = ij.map((p) => p[1]);
		const columns = ij.map((p) => p[0]);
		for (let j = Math.floor(Math.min(...rows)) - 3; j <= Math.ceil(Math.max(...rows)) + 3; j++) {
			for (
				let i = Math.floor(Math.min(...columns)) - 3;
				i <= Math.ceil(Math.max(...columns)) + 3;
				i++
			) {
				for (const [part, ring] of rings(i, j).entries()) {
					yield {
						id: `cell/${i},${j}/${part}`,
						corners: ring.map(([a, b]) => {
							const [x, y] = point(a, b);
							const [u, v] = toWorld(...warp(x, y));
							return {
								id: `node/${a},${b}`,
								xy: [site.origin[0] + size * u, site.origin[1] + size * v]
							};
						})
					};
				}
			}
		}
	};
}

const identity: Chart = (x, y) => [x, y];
const squares = (i: number, j: number) => [squareRing.map(([a, b]): Vec2 => [i + a, j + b])];
export const square = addressCarrier(identity, identity, squares);

function band(index: number) {
	const cycle = Math.floor(index / 3);
	return 3 * cycle + [0, 0.7, 2][index - cycle * 3];
}

export const bands = addressCarrier(identity, (i, j) => [band(i), band(j + 1) - 0.7], squares);

const contourShift = (x: number) => 1.2 * Math.sin(x / 7);
export const contour = addressCarrier(
	(x, y) => [x, y - contourShift(x)],
	identity,
	squares,
	(x, y) => [x, y + contourShift(x)]
);

export const triangle = addressCarrier(
	(x, y) => [x - y / (2 * hexRise), y / hexRise],
	(i, j) => [i + j / 2, j * hexRise],
	(i, j) => [
		[
			[i, j],
			[i + 1, j],
			[i, j + 1]
		],
		[
			[i + 1, j],
			[i + 1, j + 1],
			[i, j + 1]
		]
	]
);

export const hex = addressCarrier(
	(x, y) => [x / 1.5, y / (2 * hexRise) - x / 3],
	(i, j) => [i / 2, j * hexRise],
	(i, j) => [hexRing.map(([a, b]): Vec2 => [3 * i + a, 2 * j + i + b])]
);

export const polar: Carrier = function* (site, outline, bearing, size) {
	const radius = Math.max(
		...outline.map(([x, y]) => Math.hypot(x - site.origin[0], y - site.origin[1]))
	);
	const sectors = 16;
	function point(ring: number, sector: number) {
		if (!ring) return { id: 'center', xy: site.origin };
		const index = sector % sectors;
		const angle = bearing + (index * 2 * Math.PI) / sectors;
		const distance = (ring + 0.5) * size;
		const xy: Vec2 = [
			site.origin[0] + distance * Math.cos(angle),
			site.origin[1] + distance * Math.sin(angle)
		];
		return { id: `radial/${ring}/${index}`, xy };
	}
	for (let ring = 0; ring <= Math.ceil(radius / size); ring++) {
		for (let i = 0; i < sectors; i++) {
			const corners = [point(ring, i), point(ring + 1, i), point(ring + 1, i + 1)];
			if (ring) corners.push(point(ring, i + 1));
			yield { id: `sector/${ring}/${i}`, corners } satisfies Candidate;
		}
	}
};
