import { block } from '../assembly';
import { ring } from '../parts';
import { rounded } from './kit-recipe';
import { houseSeries, lengths, spans } from './house-series';

const profiles = ['square-shoulder', 'round-shoulder', 'high-waist'];
type End = 'closed' | 'porthole' | 'ribbon' | 'door' | 'balcony';
function cabin(end: End) {
	const slots =
		end === 'closed' ? (['shell', 'edge'] as const) : (['shell', 'edge', 'glass'] as const);
	return houseSeries(
		'capsule-' + end,
		lengths,
		(l) => [l, 2.5],
		slots,
		profiles,
		(l, v) => {
			const radius = v === 1 ? 0.45 : 0.15;
			const balcony = end === 'balcony' ? 1.25 : 0;
			const nose = end === 'door' || end === 'porthole' ? 0.1 : 0;
			const w = l - balcony - nose,
				x = -(balcony + nose) / 2,
				waist = v === 2 ? 1.25 : 1;
			const parts = [
				rounded(x, 0, 0, w, 2.5, waist, 'shell', radius),
				rounded(
					x,
					0,
					waist,
					w,
					end === 'ribbon' ? 2.4 : 2.5,
					0.6,
					end === 'ribbon' ? 'glass' : 'shell',
					radius
				),
				rounded(x, 0, waist + 0.6, w, 2.5, 2.35 - waist - 0.6, 'shell', radius),
				rounded(x, 0, 2.35, w, 2.5, 0.15, 'edge', radius)
			];
			return [...parts, ...fittings(end, l, waist, balcony)];
		}
	);
}

function fittings(end: End, l: number, waist: number, balcony: number) {
	const parts = [];
	if (end === 'ribbon')
		for (const side of [-1, 1])
			for (let i = 1; i < l / 1.25; i++)
				parts.push(block(i * 1.25 - l / 2, side * 1.225, waist, 0.12, 0.05, 0.6, 'edge'));
	if (end === 'porthole')
		parts.push(
			ring([l / 2 - 0.05, 0, 1.35], 0.55, 0.4, 0.1, 'edge'),
			ring([l / 2 - 0.05, 0, 1.35], 0.4, 0, 0.1, 'glass')
		);
	if (end === 'door') parts.push(block(l / 2 - 0.05, 0, 0, 0.1, 1, 2.1, 'glass'));
	if (end === 'balcony')
		parts.push(
			block(l / 2 - balcony / 2, 0, 0, balcony, 2.5, 0.15, 'edge'),
			block(l / 2 - 0.06, 0, 0.15, 0.12, 2.5, 1.1, 'glass'),
			...[-1, 1].map((s) =>
				block(l / 2 - balcony / 2 - 0.06, s * 1.19, 0.15, balcony - 0.12, 0.12, 1.1, 'glass')
			)
		);
	return parts;
}

function socket(consoleMount: boolean) {
	return houseSeries(
		consoleMount ? 'capsule-console' : 'capsule-cradle',
		spans,
		(l) => [l, 3.75],
		['frame', 'edge'],
		['shallow', 'standard', 'deep'],
		(l, v) => {
			const h = 0.3 + 0.15 * v;
			return [
				rounded(0, 0, 0, l, 3.1, h, 'frame'),
				...[-1, 1].map((s) =>
					block(0, s * 1.4, h, l, 0.3, consoleMount && s === -1 ? 1.25 : 0.3, 'edge')
				)
			];
		}
	);
}

/** Continuous capsule passage with open ends at both mating planes. */
export function passage(l: number, v: number) {
	const h = 2.5,
		width = 2.5;
	return [
		rounded(0, 0, 0, l, width, 0.15, 'access'),
		rounded(0, 0, h - 0.15, l, width, 0.15, 'shell'),
		...[-1, 1].flatMap((s) => [
			block(0, s * 1.19, 0.15, l, 0.12, 0.8, 'shell'),
			block(0, s * 1.19, 0.95, l, 0.12, h - 1.1, 'glass'),
			...Array.from({ length: v + 2 }, (_, i) =>
				block((i / (v + 1) - 0.5) * (l - 0.3), s * 1.05, 0.15, 0.3, 0.16, h - 0.3, 'shell')
			)
		])
	];
}
export const capsuleKit = [
	...(['closed', 'porthole', 'ribbon', 'door', 'balcony'] as const).flatMap(cabin),
	...socket(false),
	...socket(true),
	...houseSeries(
		'capsule-passage',
		spans,
		(l) => [l, 2.5],
		['shell', 'access', 'glass'],
		['two-rib', 'three-rib', 'four-rib'],
		passage
	)
];
