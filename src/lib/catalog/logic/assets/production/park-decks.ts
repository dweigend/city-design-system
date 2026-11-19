import { treeCrown } from './tree-crown';
import { circle, crescent, plate } from '../assembly';
import { drum, bulb, cap } from '../parts';
import { panel, collar } from '../objects/forms';
import { series } from './series';

const terrace = series(
	'planted-terraces',
	'deck',
	[5, 7.5, 10],
	['low-garden', 'mid-garden', 'high-garden']
);
export const parkDecks = [
	...terrace(
		'horseshoe-orchard',
		['foot', 'slats', 'planting'],
		(w) => w,
		(w, v) => {
			const outer = w * 0.48,
				angle = (1.08 + 0.24 * v) * Math.PI,
				n = 3 + v;
			return [
				crescent(outer, 0.54 * outer, 0, 0.45, angle, 'foot'),
				crescent(outer * 0.98, 0.84 * outer, 0.45, 0.12, angle, 'slats'),
				...Array.from({ length: n }, (_, i) => {
					const a = (angle * (i + 0.5)) / n,
						r = outer * 0.7,
						x = r * Math.cos(a),
						y = r * Math.sin(a);
					return treeCrown('blocks', [x, y, 0.45], 0.57 + 0.075 * v, v, i / n, 'slats');
				}).flat()
			];
		}
	),
	...terrace(
		'cascade-paddy',
		['foot', 'liquid', 'planting'],
		(w) => w * 0.7,
		(w, v) => {
			const n = v + 2,
				bay = (w - 0.18) / n,
				d = w * 0.67;
			return Array.from({ length: n }, (_, i) => {
				const x = ((i + 0.5) / n - 0.5) * (w - 0.18),
					h = 0.28 + i * 0.23;
				return [
					panel(x, 0, 0, bay, d, h, 'foot'),
					panel(x, 0, h, bay - 0.2, d - 0.32, 0.06, 'liquid'),
					...[-1, 1].map((t) =>
						cap([x, t * d * 0.31, h + 0.04], Math.min(bay * 0.26, 0.48), 0.25, 'planting')
					)
				];
			}).flat();
		}
	),
	...terrace(
		'well-court',
		['foot', 'slats', 'planting'],
		(w) => w,
		(w, v) => {
			const r = w * 0.48,
				inner = r * 0.5,
				h = 0.48 + v * 0.32;
			return [
				collar(0, 0, 0, r, r - inner, h, 'foot'),
				collar(0, 0, h, r, 0.4, 0.13, 'slats'),
				drum([0, 0, 0], inner * 0.98, 0.18, 'planting'),
				...treeCrown('clumps', [0, 0, 0.18], inner * 0.86, v, 0.56, 'slats')
			];
		}
	),
	...terrace(
		'hanging-seed-bowls',
		['foot', 'body', 'planting'],
		(w) => w * 0.65,
		(w, v) => {
			const n = v + 2,
				bay = (w - 0.3) / n,
				r = Math.min(bay * 0.45, w * 0.21);
			return [
				panel(0, 0, 0, w, w * 0.62, 0.28, 'foot'),
				...Array.from({ length: n }, (_, i) => {
					const x = (i - (n - 1) / 2) * bay,
						y = ((i % 2) - 0.5) * w * 0.22,
						h = 1.1 + 0.45 * (i % 3);
					return [
						drum([x, y, 0.28], 0.17, h, 'foot'),
						bulb([x, y, h + 0.4], r, 0.49, 'body'),
						cap([x, y, h + 0.39 + r * 0.45], r * 0.73, 0.38, 'planting')
					];
				}).flat()
			];
		}
	),
	...terrace(
		'staggered-moss-bleachers',
		['foot', 'slats', 'planting'],
		(w) => w * 0.8,
		(w, v) => {
			const n = v + 2,
				depth = (w * 0.74) / n;
			return Array.from({ length: n }, (_, i) => {
				const y = (i - (n - 1) / 2) * depth,
					h = (i + 1) * 0.34,
					x = ((i % 2) - 0.5) * 0.28;
				return [
					panel(x, y, 0, w - 0.42, depth, h, 'foot'),
					panel(x, y - depth * 0.22, h, w - 0.58, depth * 0.41, 0.12, 'slats'),
					panel(x, y + depth * 0.22, h, w - 0.72, depth * 0.38, 0.19, 'planting')
				];
			}).flat();
		}
	),
	...terrace(
		'floating-courtyard',
		['foot', 'slats', 'planting'],
		(w) => w,
		(w, v) => {
			const r = w * 0.47,
				h = 1.22 + v * 0.67,
				opening = circle(r * 0.44, 32).reverse();
			return [
				...circle(r * 0.74, 4).map(([x, y]) => drum([x, y, 0], 0.23, h, 'foot')),
				plate(circle(r), h, 0.34, 'slats', opening),
				collar(0, 0, h + 0.34, r, 0.36, 0.29, 'foot'),
				...circle(r * 0.76, 4 + 2 * v).map(([x, y]) =>
					bulb([x, y, h + 0.62], 0.3, 0.85, 'planting')
				)
			];
		}
	),
	...terrace(
		'rill-boardwalk',
		['foot', 'slats', 'liquid'],
		(w) => w * 0.58,
		(w, v) => {
			const d = w * 0.56,
				n = v + 2;
			return [
				panel(0, 0, 0, w, d, 0.26, 'foot'),
				panel(0, 0, 0.26, w - 0.34, d - 0.34, 0.06, 'liquid'),
				...Array.from({ length: n }, (_, i) => {
					const x = ((i + 0.5) / n - 0.5) * w,
						delta = ((i % 2) - 0.5) * d * 0.31;
					return [
						panel(x, delta, 0.26, 0.38, d * 0.52, 0.22, 'foot'),
						panel(x, delta, 0.48, w / n - 0.05, d * 0.52, 0.18, 'slats')
					];
				}).flat()
			];
		}
	)
];
