import { block } from '../assembly';
import { rod, drum } from '../parts';
import { rounded } from './kit-recipe';
import { spans, houseSeries, courses } from './house-series';
import { passage } from './capsule-kit';

const bays = ['two-post', 'three-post', 'four-post'];
function barrier(l: number, y: number, z: number, v: number) {
	return [
		...Array.from({ length: 2 + v }, (_, i) =>
			block((i / (v + 1) - 0.5) * (l - 0.12), y, z, 0.12, 0.12, 0.98, 'frame')
		),
		block(0, y, z + 0.98, l, 0.12, 0.12, 'frame')
	];
}
function parapet(type: 'solid' | 'rail' | 'mesh' | 'glass') {
	const solid = type === 'solid';
	return houseSeries(
		'parapet-' + type,
		spans,
		(l) => [l, 1.25],
		solid ? ['deck', 'edge'] : type === 'glass' ? ['glass', 'frame'] : ['frame'],
		solid ? ['narrow', 'medium', 'wide'] : bays,
		(l, v) => {
			if (solid)
				return [
					rounded(0, 0, 0, l, 0.3 + 0.1 * v, 0.95, 'deck'),
					rounded(0, 0, 0.95, l, 0.4 + 0.1 * v, 0.15, 'edge')
				];
			const parts = barrier(l, 0, 0, v);
			if (type === 'glass')
				for (let i = 0; i < v + 1; i++) {
					const bay = (l - 0.12) / (v + 1);
					parts.push(
						block(-l / 2 + 0.06 + (i + 0.5) * bay, 0, 0.1, bay - 0.12, 0.05, 0.88, 'glass')
					);
				}
			if (type === 'mesh') {
				for (let i = 0; i < v + 1; i++) {
					const pitch = (l - 0.12) / (v + 1),
						x = -l / 2 + 0.12 + i * pitch;
					parts.push(
						rod([x, 0, 0.1], [x + pitch - 0.12, 0, 0.9], 0.06, 'frame'),
						rod([x, 0, 0.9], [x + pitch - 0.12, 0, 0.1], 0.06, 'frame')
					);
				}
			}
			return parts;
		}
	);
}
function walk(type: 'gallery' | 'plank' | 'truss') {
	return houseSeries(
		type === 'gallery' ? 'gallery-walk' : 'bridge-' + type,
		spans,
		(l) => [l, type === 'gallery' ? 1.25 : 2.5],
		type === 'gallery' ? ['deck', 'frame'] : ['access', 'frame'],
		bays,
		(l, v) => {
			const w = type === 'gallery' ? 1.25 : 2.5;
			const parts = [
				block(0, 0, 0, l, w, 0.3, type === 'gallery' ? 'deck' : 'access'),
				...barrier(l, w / 2 - 0.06, 0.3, v)
			];
			if (type !== 'gallery') parts.push(...barrier(l, -w / 2 + 0.06, 0.3, v));
			if (type === 'truss')
				for (const side of [-1, 1])
					for (let i = 0; i <= v; i++) {
						const step = (l - 0.12) / (v + 1),
							x = -l / 2 + 0.06 + i * step,
							y = side * (w / 2 - 0.06);
						parts.push(rod([x, y, 0.4], [x + step, y, 1.25], 0.06, 'frame'));
					}
			return parts;
		}
	);
}
function garden(overhang: boolean) {
	return houseSeries(
		overhang ? 'garden-cantilever' : 'garden-planter',
		spans,
		(l) => [l, 2.5],
		['frame', 'edge', 'planting'],
		['low', 'raised', 'deep'],
		(l, v) => {
			const h = 0.3 + 0.15 * v;
			return [
				rounded(0, overhang ? -0.65 : 0, 0, l - 0.3, overhang ? 0.6 : 2, 0.3, 'frame'),
				rounded(0, 0, 0.3, l, 2.5, h, 'edge', 0.45),
				rounded(0, 0, h + 0.3, l - 0.3, 2.2, 0.05, 'planting', 0.45)
			];
		}
	);
}
export const deckKit = [
	...(['solid', 'rail', 'mesh', 'glass'] as const).flatMap(parapet),
	...walk('gallery'),
	...walk('plank'),
	...walk('truss'),
	...houseSeries(
		'bridge-tube',
		[5, 7.5, 10],
		(l) => [l, 2.5],
		['access', 'shell', 'glass'],
		bays,
		(l, v) => [...passage(l, v), block(0, 0, 2.5, l, 0.3, 0.15, 'shell')]
	),
	...houseSeries(
		'bridge-pier',
		courses,
		() => [2.5, 2.5],
		['frame', 'edge'],
		['single', 'twin', 'triple'],
		(h, v) => [
			...Array.from({ length: v + 1 }, (_, i) =>
				drum([0, (i - v / 2) * 0.7, 0], 0.3, h - 0.3, 'frame')
			),
			rounded(0, 0, h - 0.3, 1.25, 2.5, 0.3, 'edge')
		]
	),
	...houseSeries(
		'stair-landing',
		spans,
		(l) => [l, 1.25],
		['deck', 'frame'],
		bays,
		(l, v) => [rounded(0, 0, 0, l, 1.25, 0.15, 'deck'), ...barrier(l, 0.55, 0.15, v)]
	),
	...garden(true),
	...garden(false)
];
