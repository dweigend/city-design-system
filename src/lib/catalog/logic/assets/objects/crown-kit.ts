import { block, shell } from '../assembly';
import { drum, cap, rod } from '../parts';
import { rounded } from './kit-recipe';
import { houseSeries } from './house-series';

const widths = [2.5, 3.75, 5],
	styles = ['low', 'standard', 'tall'];
function enclosure(kind: 'watch-cabin' | 'greenhouse' | 'pergola' | 'lattice') {
	const glass = kind === 'watch-cabin' || kind === 'greenhouse';
	return houseSeries(
		'crown-' + kind,
		widths,
		(w) => [w, w],
		glass ? ['frame', 'glass', 'edge'] : ['frame', 'edge'],
		styles,
		(w, v) => {
			const h = 2.1 + 0.3 * v,
				r = w / 2 - 0.15;
			const parts = [
				rounded(0, 0, 0, w, w, 0.15, 'edge'),
				...[-r, r].flatMap((x) => [-r, r].map((y) => block(x, y, 0.15, 0.3, 0.3, h, 'frame')))
			];
			if (glass)
				for (const s of [-1, 1]) {
					parts.push(
						block(s * r, 0, 0.15, 0.12, w - 0.6, h, 'glass'),
						block(0, s * r, 0.15, w - 0.6, 0.12, h, 'glass')
					);
				}
			if (kind === 'lattice')
				for (const s of [-r, r]) {
					parts.push(
						rod([-r, s, 0.3], [r, s, h], 0.15, 'frame'),
						rod([s, r, 0.3], [s, -r, h], 0.15, 'frame')
					);
				}
			if (kind === 'pergola') {
				for (const s of [-r, r]) parts.push(block(0, s, h + 0.15, w, 0.3, 0.3, 'edge'));
				for (let i = 0; i < 5; i++)
					parts.push(block((i / 4 - 0.5) * (w - 0.3), 0, h + 0.45, 0.3, w, 0.15, 'frame'));
			} else if (kind === 'greenhouse')
				parts.push(shell('vault', 0, 0, h + 0.15, w, w, 0.75, 0.12, 'glass'));
			else parts.push(rounded(0, 0, h + 0.15, w, w, 0.15, 'edge'));
			return parts;
		}
	);
}
export const crownKit = [
	...(['watch-cabin', 'greenhouse', 'pergola', 'lattice'] as const).flatMap(enclosure),
	...houseSeries(
		'crown-tank',
		widths,
		(w) => [w, w],
		['channel', 'edge'],
		styles,
		(w, v) => [
			drum([0, 0, 0], w / 2 - 0.3, 0.3, 'edge'),
			drum([0, 0, 0.3], w / 2, 1 + v * 0.5, 'channel'),
			cap([0, 0, 1.3 + v * 0.5], w / 2, 0.45, 'channel')
		]
	),
	...houseSeries(
		'crown-lantern',
		widths,
		(w) => [w, w],
		['frame', 'glass'],
		styles,
		(w, v) => [
			drum([0, 0, 0], w / 2, 0.3, 'frame'),
			drum([0, 0, 0.3], w / 2 - 0.15, 1.25 + v * 0.25, 'glass'),
			cap([0, 0, 1.55 + v * 0.25], w / 2, 0.45, 'frame')
		]
	),
	...houseSeries(
		'crown-antenna',
		widths,
		(w) => [w, w],
		['frame', 'accent'],
		['single', 'double', 'triple'],
		(w, v) => [
			drum([0, 0, 0], 0.45, 0.3, 'frame'),
			drum([0, 0, 0.3], 0.15, w, 'frame'),
			...Array.from({ length: v + 1 }, (_, i) =>
				block(0, 0, w - 0.4 * i, w / (i + 1), 0.12, 0.12, 'accent')
			)
		]
	),
	...houseSeries(
		'crown-wind-rotor',
		widths,
		(w) => [w, 1.25],
		['frame', 'accent'],
		['two-blade', 'three-blade', 'four-blade'],
		(w, v) => [
			drum([0, 0, 0], 0.35, 0.3, 'frame'),
			drum([0, 0, 0.3], 0.15, w / 2 + 0.15, 'frame'),
			rod([0, 0, w / 2 + 0.45], [0, 0.3, w / 2 + 0.45], 0.15, 'frame'),
			...Array.from({ length: v + 2 }, (_, i) => {
				const a = (i * 2 * Math.PI) / (v + 2),
					r = w / 2 - 0.15;
				return rod(
					[0, 0.3, w / 2 + 0.45],
					[Math.cos(a) * r, 0.3, w / 2 + 0.45 + Math.sin(a) * r],
					0.15,
					'accent'
				);
			})
		]
	),
	...houseSeries(
		'crown-solar-sail',
		widths,
		(w) => [w, 2.5],
		['frame', 'glass'],
		['two-panel', 'three-panel', 'four-panel'],
		(w, v) => [
			drum([0, 0, 0], 0.3, 1.5, 'frame'),
			block(0, 0, 1.5, w, 0.3, 0.15, 'frame'),
			...Array.from({ length: v + 2 }, (_, i) =>
				block(((i + 0.5) / (v + 2) - 0.5) * w, 0, 1.65, w / (v + 2) - 0.05, 2.5, 0.15, 'glass')
			)
		]
	)
];
