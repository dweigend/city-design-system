import { circle } from '../assembly';
import { panel } from '../objects/forms';
import { cap, bulb, drum, rod, surface } from '../parts';
import { series } from './series';
import type { ObjectGeometry } from '../object-geometry';
type Crown =
	| 'pollard'
	| 'terraced-cedar'
	| 'table-pine'
	| 'column-hornbeam'
	| 'cube-linden'
	| 'fan-pear'
	| 'coppice';
const tree = series(
	'park-specimens',
	'deck',
	[2.5, 3.75, 5],
	['low-crown', 'street-crown', 'park-crown']
);
function topiary(type: Crown, r: number, h: number, v: number): ObjectGeometry[] {
	switch (type) {
		case 'pollard':
			return circle(r * 0.52, 3 + v).flatMap(([x, y], i) => [
				rod([0, 0, h * 0.76], [x, y, h + i * 0.07], 0.15, 'slats'),
				bulb([x, y, h + 0.32 + i * 0.07], r * 0.48, 0.88, 'planting')
			]);
		case 'terraced-cedar':
			return Array.from({ length: 3 + v }, (_, i) => ({
				...surface('planting'),
				kind: 'cone',
				position: [0, 0, h + i * 0.43 * r],
				radius: r * (1 - i / (3.6 + v)),
				height: r * 1.06
			}));
		case 'table-pine':
			return circle(r * 0.44, 3).flatMap(([x, y]) => [
				rod([0, 0, h * 0.68], [x, y, h], 0.15, 'slats'),
				cap([x, y, h], r * 0.55, 0.24 * r, 'planting')
			]);
		case 'column-hornbeam':
			return [
				bulb([0, 0, h + 0.82 * r], r * 0.62, 1.72 + v * 0.22, 'planting'),
				...[-1, 1].map((s) => bulb([s * r * 0.36, 0, h + 0.68 * r], r * 0.35, 1.7, 'planting'))
			];
		case 'cube-linden':
			return [panel(0, 0, h - 0.05, r * 1.85, r * 1.46, r * (1.18 + v * 0.2), 'planting')];
		case 'fan-pear':
			return [-1, 1].flatMap((s) => [
				rod([0, 0, h * 0.56], [s * r * 0.63, 0, h + 0.18 * r], 0.15, 'slats'),
				bulb([s * r * 0.49, 0, h + 0.52 * r], r * 0.5, 1.54, 'planting')
			]);
		case 'coppice':
			return circle(r * 0.5, 3 + v).flatMap(([x, y], i) => {
				const z = h * (0.79 + 0.1 * (i % 3));
				return [
					rod([0, 0, 0.23], [x, y, z], 0.15, 'slats'),
					bulb([x, y, z + 0.26 * r], r * 0.46, 1.18, 'planting')
				];
			});
	}
}
function specimen(type: Crown) {
	return tree(
		type + '-park-tree',
		['foot', 'slats', 'planting'],
		(w) => w,
		(w, v, s) => {
			const r = w * 0.46,
				h = w * (0.46 + 0.19 * v) + 0.14 * s;
			return [
				drum([0, 0, 0], w * 0.24, 0.18, 'foot'),
				drum([0, 0, 0.18], r * 0.4, 0.08, 'planting'),
				drum([0, 0, 0.18], Math.max(0.15, 0.13 * r), type === 'coppice' ? 0.35 : h - 0.14, 'slats'),
				...topiary(type, r, h, v)
			];
		}
	);
}
export const parkTrees = (
	[
		'pollard',
		'terraced-cedar',
		'table-pine',
		'column-hornbeam',
		'cube-linden',
		'fan-pear',
		'coppice'
	] as const
).flatMap(specimen);
