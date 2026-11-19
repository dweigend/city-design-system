import { block, slope } from '../assembly';
import { drum, cap, ring } from '../parts';
import { rounded } from './kit-recipe';
import { streetSeries, lengths, lengthNames } from './street-series';

function beacon(signal: boolean) {
	return streetSeries(
		signal ? 'signal-mast' : 'lamp',
		['path', 'landing', 'quay', 'square'],
		() => [1.25, 1.25],
		['frame', 'glass', 'edge'],
		['single', 'twin', 'triple'],
		(i, v) => {
			const h = 1.25 + i * 0.75;
			const parts = [
				drum([0, 0, 0], 0.3, 0.15, 'edge'),
				drum([0, 0, 0.15], 0.15, h - 0.15, 'frame')
			];
			if (signal)
				for (let j = 0; j <= v; j++)
					parts.push(
						drum([0, 0, h + 0.35 * j], 0.25, 0.25, 'glass'),
						drum([0, 0, h + 0.35 * j + 0.25], 0.3, 0.1, 'edge')
					);
			else {
				const length = 0.35 * v + 0.3;
				parts.push(block(0, 0, h, length, 0.3, 0.15, 'frame'));
				for (let j = 0; j <= v; j++)
					parts.push(cap([(j - v / 2) * 0.35, 0, h + 0.15], 0.15, 0.25, 'glass'));
			}
			return parts;
		}
	);
}
export const streetServices = [
	...beacon(true),
	...beacon(false),
	...streetSeries(
		'beehive',
		['nucleus', 'garden', 'apiary', 'colony'],
		() => [1.25, 1.25],
		['body', 'edge', 'accent'],
		['one-super', 'two-super', 'three-super'],
		(i, v) => {
			const w = 0.5 + i * 0.15;
			return [
				rounded(0, 0, 0, w, w, 0.25, 'edge'),
				...Array.from({ length: v + 1 }, (_, j) =>
					rounded(0, 0, j * 0.25 + 0.25, w, w, 0.25, 'body')
				),
				block(w / 2 + 0.05, 0, 0.25, 0.1, w - 0.15, 0.05, 'accent'),
				rounded(0, 0, 0.5 + v * 0.25, w + 0.1, w + 0.1, 0.1, 'edge')
			];
		}
	),
	...streetSeries(
		'bird-house',
		['wren', 'sparrow', 'starling', 'owl'],
		() => [1.25, 1.25],
		['frame', 'body', 'edge'],
		['low-post', 'garden-post', 'high-post'],
		(i, v) => {
			const w = 0.35 + i * 0.1,
				h = 1.1 + v * 0.45;
			return [
				drum([0, 0, 0], 0.15, h, 'frame'),
				rounded(0, 0, h, w, w, w, 'body'),
				ring([w / 2, 0, h + w / 2], 0.1 + i * 0.015, 0, 0.05, 'edge'),
				slope(0, 0, h + w, w + 0.15, w + 0.15, 0.15, 0, 'edge')
			];
		}
	),
	...streetSeries(
		'mailbox',
		['doorstep', 'pair', 'row', 'court'],
		(i) => [i < 2 ? 1.25 : 2.5, 1.25],
		['frame', 'body', 'edge'],
		['low-post', 'standard-post', 'high-post'],
		(i, v) => {
			const h = 0.7 + v * 0.15,
				w = (i + 1) * 0.45;
			return [
				block(0, 0, 0, 0.3, 0.3, h, 'frame'),
				rounded(0, 0, h, w, 0.55, 0.5, 'body'),
				...Array.from({ length: i + 1 }, (_, j) =>
					block((j - i / 2) * 0.45, 0.3, h + 0.3, 0.3, 0.05, 0.1, 'edge')
				)
			];
		}
	),
	...streetSeries(
		'kiosk',
		lengthNames,
		(i) => [lengths[i], 2.5],
		['body', 'frame', 'edge'],
		['low-hatch', 'counter-hatch', 'high-hatch'],
		(i, v) => {
			const w = lengths[i],
				h = 0.8 + v * 0.15;
			return [
				rounded(0, 0, 0, w, 1.9, h, 'body', 0.45),
				block(0, 0.9, h, w, 0.6, 0.15, 'edge'),
				...[-1, 1].flatMap((s) =>
					[-1, 1].map((t) =>
						block(
							s * (w / 2 - 0.2),
							t * 0.7,
							h + (t === 1 ? 0.15 : 0),
							0.12,
							0.12,
							2.25 - h - (t === 1 ? 0.15 : 0),
							'frame'
						)
					)
				),
				rounded(0, 0, 2.25, w, 2.5, 0.15, 'edge')
			];
		}
	)
];
