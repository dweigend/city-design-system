import { block } from '../assembly';
import { drum, rod } from '../parts';
import { rounded } from './kit-recipe';
import { streetSeries, lengths, lengthNames, supports } from './street-series';

const binWidths = [0.55, 0.75, 0.95, 1.15],
	bins = ['hand', 'porter', 'yard', 'bulk'];
function crate(basket: boolean) {
	return streetSeries(
		basket ? 'harvest-basket' : 'crate',
		bins,
		() => [1.25, 1.25],
		['body', 'edge'],
		['shallow', 'standard', 'deep'],
		(i, v) => {
			const w = binWidths[i],
				d = w - 0.15,
				h = 0.2 + v * 0.1;
			const parts = [
				rounded(0, 0, 0, w, d, 0.05, 'body'),
				...[-1, 1].flatMap((s) => [
					block(s * (w / 2 - 0.025), 0, 0.05, 0.05, d, h, 'body'),
					block(0, s * (d / 2 - 0.025), 0.05, w - 0.1, 0.05, h, 'body')
				])
			];
			if (basket)
				parts.push(
					...[-1, 1].map((s) => block(0, s * (d / 2 - 0.025), 0.05 + h, 0.12, 0.12, 0.25, 'edge')),
					block(0, 0, h + 0.3, 0.12, d + 0.05, 0.12, 'edge')
				);
			else
				for (const s of [-1, 1])
					parts.push(block(0, s * (d / 2 - 0.05), 0.05 + h, w, 0.1, 0.1, 'edge'));
			return parts;
		}
	);
}
function barrel(rain: boolean) {
	return streetSeries(
		rain ? 'rain-barrel' : 'barrel',
		bins,
		() => [1.25, 1.25],
		rain ? ['channel', 'edge'] : ['body', 'edge'],
		['low', 'medium', 'tall'],
		(i, v) => {
			const r = 0.25 + i * 0.1,
				h = 0.55 + v * 0.2,
				slot = rain ? 'channel' : 'body';
			const parts = [
				drum([0, 0, 0], r, h * 0.25, slot),
				drum([0, 0, h * 0.25], r + 0.05, 0.1, 'edge'),
				drum([0, 0, h * 0.25 + 0.1], r, h * 0.5, slot),
				drum([0, 0, h * 0.75 + 0.1], r + 0.05, 0.1, 'edge'),
				drum([0, 0, h * 0.75 + 0.2], r, h * 0.25, slot)
			];
			if (rain)
				parts.push(
					rod([r - 0.05, 0, 0.2], [r + 0.05, 0, 0.2], 0.06, 'edge'),
					drum([0, 0, h + 0.2], 0.15, 0.2, 'channel')
				);
			return parts;
		}
	);
}
function bench(kind: 'workbench' | 'table' | 'market-counter') {
	const workplace = kind === 'workbench',
		counter = kind === 'market-counter';
	return streetSeries(
		kind,
		lengthNames,
		(i) => [lengths[i], 1.25],
		['frame', 'body', 'edge'],
		['low', 'standard', 'raised'],
		(i, v) => {
			const w = lengths[i],
				h = (counter ? 0.9 : workplace ? 0.8 : 0.65) + v * 0.1;
			const parts = [...supports(w, 1, h), rounded(0, 0, h, w, 1, 0.15, 'body')];
			if (workplace) parts.push(block(w / 2 - 0.3, 0.2, h + 0.15, 0.45, 0.3, 0.2, 'edge'));
			else if (counter) parts.push(block(0, 0.4, 0, w - 0.6, 0.12, h, 'edge'));
			else
				parts.push(
					block(0, 0, 0.35, w - 0.3, 0.3, 0.12, 'edge'),
					...[-1, 1].map((s) => block(s * (w / 2 - 0.15), 0, 0.35, 0.3, 0.7, 0.12, 'frame'))
				);
			return parts;
		}
	);
}
export const streetWorkshop = [
	...crate(false),
	...crate(true),
	...barrel(false),
	...barrel(true),
	...bench('workbench'),
	...bench('table'),
	...bench('market-counter'),
	...streetSeries(
		'tool-rack',
		lengthNames,
		(i) => [lengths[i], 1.25],
		['frame', 'body', 'trim'],
		['two-tools', 'three-tools', 'four-tools'],
		(i, v) => {
			const w = lengths[i];
			return [
				...[-1, 1].flatMap((s) => [
					rounded(s * (w / 2 - 0.2), 0, 0, 0.4, 0.8, 0.15, 'frame'),
					block(s * (w / 2 - 0.2), 0, 0.15, 0.12, 0.12, 1.35, 'frame')
				]),
				block(0, 0, 1.5, w, 0.15, 0.15, 'frame'),
				...Array.from({ length: v + 2 }, (_, j) => {
					const x = ((j + 0.5) / (v + 2) - 0.5) * (w - 0.3);
					return [
						block(x, 0.15, 0.5, 0.12, 0.12, 1.1, 'body'),
						block(x, 0.15, 0.25, 0.25, 0.12, 0.25, 'trim')
					];
				}).flat()
			];
		}
	),
	...streetSeries(
		'compost-bin',
		bins,
		() => [1.25, 1.25],
		['body', 'edge', 'planting'],
		['low-fill', 'half-fill', 'full'],
		(i, v) => {
			const w = binWidths[i],
				h = 0.75;
			return [
				rounded(0, 0, 0, w, w, 0.15, 'edge'),
				...[-1, 1].flatMap((s) => [
					block(0, s * (w / 2 - 0.05), 0.15, w, 0.1, h, 'body'),
					block(s * (w / 2 - 0.05), 0, 0.15, 0.1, w - 0.2, h, 'body')
				]),
				block(0, 0, 0.15, w - 0.2, w - 0.2, 0.2 + v * 0.25, 'planting')
			];
		}
	)
];
