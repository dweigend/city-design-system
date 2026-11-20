import { mount, type AssetRecipe } from '../definition';
import type { ObjectGeometry } from '../object-geometry';
import type { Vec3 } from '../../parametrik/types';
import { actionFigure, clay } from '../production/activities/action-figure';
import { plazaLayout } from './plaza-layout';
import { scatterLayout } from './scatter-layout';

const surfaces = { body: { ...clay, token: '--body-living' } } as const;
const base = {
	category: 'neighbourhood-services',
	anchors: [mount('deck')],
	slotNames: ['body'],
	suggestions: surfaces
} as const;
type Pair = [number, number];
// Fit the origins to the reservation, keeping the original rigid geometry and 0.15 m of air per edge.
function extent(parts: ObjectGeometry[], axis: 0 | 1): Pair {
	const edges = parts.flatMap((p) => {
		switch (p.kind) {
			case 'sphere':
				return [p.position[axis] - p.radius, p.position[axis] + p.radius];
			case 'capsule':
				return [
					Math.min(p.from[axis], p.to[axis]) - p.radius,
					Math.max(p.from[axis], p.to[axis]) + p.radius
				];
			case 'mesh':
				return p.points.map((q) => q[axis]);
			default:
				throw Error('Unexpected staffage primitive ' + p.kind);
		}
	});
	return [Math.min(...edges), Math.max(...edges)];
}
function station(u: number, size: number, [lo, hi]: Pair) {
	return -size / 2 + 0.15 - lo + u * (size - 0.3 - hi + lo);
}
const sizes: Record<number, Pair> = { 3: [2.16, 1.45], 7: [4.9, 1.8], 15: [9.7, 1.95] };
function crowd(
	id: string,
	footprint: Pair,
	variants: string[],
	layout: (variant: number) => Pair[]
): AssetRecipe {
	return {
		...base,
		id,
		footprint,
		variants,
		draw(v, s) {
			const positions = layout(v);
			return positions.flatMap(([x, y], i) => {
				const pose = i % 3 === 1 ? 'walk' : 'stand';
				const heading =
					variants[v] === 'deck-line'
						? i % 5 === 0
							? 2.8
							: 0.22 * ((i % 3) - 1)
						: (((i * 5) % 8) * Math.PI) / 4;
				const options = {
					slot: 'body',
					heading,
					phase: 1,
					sample: [0.25, 0.5, 0.75][(Math.floor(3 * s) + i) % 3]
				};
				const model = actionFigure(pose, [0, 0, 0], options);
				const origin: Vec3 = [
					station(x, footprint[0], extent(model, 0)),
					station(y, footprint[1], extent(model, 1)),
					0
				];
				return actionFigure(pose, origin, options);
			});
		}
	};
}
function deck(n: number, landing = false) {
	return crowd(
		'kit-scatter-' + (landing ? 'landing-' : 'group-') + n,
		sizes[n],
		['loose-knot', 'deck-line', 'two-knots'],
		(v) => scatterLayout(n, v, landing)
	);
}
function plaza(n: number, footprint: Pair) {
	return crowd('kit-scatter-plaza-' + n, footprint, ['loose-knot', 'two-knots', 'ring'], (v) =>
		plazaLayout(n, v)
	);
}
function single(pose: 'stand' | 'walk'): AssetRecipe {
	return {
		...base,
		id: 'kit-scatter-' + pose,
		footprint: pose === 'stand' ? [0.54, 0.71] : [0.8, 0.71],
		variants: ['forward', 'turn', 'reverse'],
		draw(v, s) {
			return actionFigure(pose, [0, 0, 0], {
				slot: 'body',
				sample: s,
				phase: 1,
				heading: [0, 0.16, Math.PI][v]
			});
		}
	};
}
export const scatterPeople = [
	single('stand'),
	single('walk'),
	deck(3),
	deck(7),
	deck(15),
	deck(15, true),
	plaza(7, [3.5, 3]),
	plaza(15, [5.5, 4.5])
];
