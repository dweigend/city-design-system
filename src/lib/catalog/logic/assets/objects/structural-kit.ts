import { block } from '../assembly';
import { drum, rod } from '../parts';
import { pavedDeck, rounded } from './kit-recipe';
import { houseSeries, courses, spans, moduleSpan } from './house-series';

const grades = ['light', 'standard', 'heavy'];
function core(mast: boolean) {
	return houseSeries(
		mast ? 'mast-course' : 'core-course',
		courses,
		() => [2.5, 2.5],
		['frame', 'edge'],
		grades,
		(h, v) => {
			const w = 1.25 + 0.25 * v;
			const section = mast
				? [
						...[-1, 1].flatMap((i) =>
							[-1, 1].map((j) => block((i * w) / 2, (j * w) / 2, 0, 0.3, 0.3, h - 0.3, 'frame'))
						),
						...[-1, 1].flatMap((s) => [
							rod([-w / 2, (s * w) / 2, 0.15], [w / 2, (s * w) / 2, h - 0.45], 0.15, 'frame'),
							rod([(s * w) / 2, -w / 2, h - 0.45], [(s * w) / 2, w / 2, 0.15], 0.15, 'frame')
						])
					]
				: [drum([0, 0, 0], w / 2, h - 0.3, 'frame')];
			return [...section, rounded(0, 0, h - 0.3, 2.5, 2.5, 0.3, 'edge')];
		}
	);
}
function column(end: 'foot' | 'shaft' | 'head') {
	const shaft = end === 'shaft';
	return houseSeries(
		'column-' + end,
		shaft ? courses : [0.5, 0.75, 1],
		() => [1.25, 1.25],
		['frame', 'edge'],
		grades,
		(m, v) => {
			const r = shaft ? 0.25 + 0.05 * v : m / 2,
				h = shaft ? m : 0.5 + 0.1 * v;
			const flare = end === 'head';
			return [
				drum([0, 0, 0], flare ? r * 0.7 : r, h - 0.15, 'frame'),
				drum([0, 0, h - 0.15], flare ? r : r * 0.85, 0.15, 'edge')
			];
		}
	);
}
function bay(name: string, braced: boolean, double: boolean) {
	return houseSeries(
		name,
		[5, 10, 15],
		(l) => [moduleSpan(l + 0.3), double ? 2.5 : 1.25],
		['frame', 'edge'],
		grades,
		(l, v) => {
			const h = 4,
				sill = 0.15 + 0.15 * v,
				ys = double ? [-1, 1] : [0];
			const parts = ys.flatMap((y) => [
				...Array.from({ length: l / 5 + 1 }, (_, i) =>
					block(-l / 2 + i * 5, y, sill, 0.3, 0.3, h - 0.3 - sill, 'frame')
				),
				block(0, y, 0, l + 0.3, 0.3, sill, 'edge'),
				block(0, y, h - 0.3, l + 0.3, 0.3, 0.3, 'edge')
			]);
			for (let i = 0; i < l / 5; i++) {
				const start = -l / 2 + 0.15 + i * 5,
					end = start + 4.7;
				if (braced)
					for (const y of ys)
						parts.push(rod([start, y, sill + 0.15], [end, y, h - 0.45], 0.15, 'frame'));
				if (double) parts.push(block((start + end) / 2, 0, h - 0.3, 0.3, 1.7, 0.3, 'edge'));
			}

			return parts;
		}
	);
}
function wall(name: string, wing: boolean) {
	return houseSeries(
		name,
		spans,
		(w) => [w, wing ? 3.75 : 1.25],
		['frame', 'edge'],
		grades,
		(w, v) => [
			rounded(0, 0, 0, w, 0.4 + 0.1 * v, 3.7, 'frame'),
			rounded(0, 0, 3.7, w, wing ? 3.75 : 1.25, 0.3, 'edge')
		]
	);
}
function plinth(cistern: boolean) {
	return houseSeries(
		cistern ? 'cistern-plinth' : 'terrace-plinth',
		spans,
		(w) => [w, w],
		cistern ? ['channel', 'deck'] : ['frame', 'deck'],
		grades,
		(w, v) => {
			const h = 1 + v * 0.5;
			return [
				cistern ? drum([0, 0, 0], w / 2, h, 'channel') : rounded(0, 0, 0, w, w, h, 'frame', 0.45),
				rounded(0, 0, h, w, w, 0.3, 'deck', 0.45)
			];
		}
	);
}
export const structuralKit = [
	...core(false),
	...core(true),
	...column('foot'),
	...column('shaft'),
	...column('head'),
	...bay('brace-bay', true, false),
	...bay('rack-bay', false, true),
	...bay('portal-bay', true, true),
	...wall('bearing-slab', false),
	...wall('cantilever-slab', true),
	...plinth(false).map(pavedDeck),
	...plinth(true).map(pavedDeck),
	...houseSeries(
		'branch-column',
		courses,
		() => [5, 5],
		['frame', 'edge'],
		grades,
		(h, v) => {
			const reach = 1.25 + v * 0.25;
			return [
				drum([0, 0, 0], 0.45, h / 2, 'frame'),
				...[0, 1, 2].flatMap((i) => {
					const a = (i * Math.PI * 2) / 3,
						x = reach * Math.cos(a),
						y = reach * Math.sin(a);
					return [
						rod([0, 0, h / 2], [x, y, h + 2 * i], 0.15, 'frame'),
						drum([x, y, h + 2 * i], 0.35, 0.15, 'edge')
					];
				})
			];
		}
	)
];
