import { family, block, legs, row, shell, slope } from './assembly';
import { ring, surface } from './parts';
const asset = family('neighbourhood-services', 'deck');
export const exchangeStations = [
	asset('market-stall', ['body', 'accent', 'glass', 'planting'], [4, 3], (factor) => [
		...legs(1.65, 1.08, 2.5 * factor, 0.07),
		block(0, 0, 0.82, 3.7, 2.4, 0.15, 'accent'),
		slope(0, 0, 2.5 * factor, 2.7, 3.85, 0.4, Math.PI / 2, 'glass'),
		...row(3, (t) => block(t * 1.1, 0, 0.97, 0.91, 1.2, 0.25, 'planting'))
	]),
	asset('sort-station', ['planting', 'highlight', 'channel', 'body', 'deck'], [4, 2], (factor) => [
		...row(3, (t, i) =>
			block(
				t * 1.2,
				0,
				0,
				1.12,
				1.5,
				1.15 * factor,
				(['planting', 'highlight', 'channel'] as const)[i]
			)
		),
		...row(3, (t) => block(t * 1.2, 0, 1.15 * factor, 1.17, 1.56, 0.14)),
		...row(3, (t) => block(t * 1.2, 0, 1.15 * factor + 0.14, 0.63, 0.42, 0.02, 'deck'))
	]),
	asset('food-locker', ['body', 'glass', 'accent'], [3, 2], (factor) => [
		block(0, 0, 0, 2.6, 1.7, 2.1 * factor),
		...Array.from({ length: 3 }, (_, i) =>
			row(3, (t) =>
				block(t * 0.8, -0.88, 0.12 + i * 0.64 * factor, 0.74, 0.08, 0.57 * factor, 'glass')
			)
		).flat(),
		shell('vault', 0, 0, 2.1 * factor, 2.75, 1.89, 0.36, 0.09, 'accent')
	]),
	asset('dome-cart', ['body', 'highlight', 'accent'], [3, 3], (factor) => [
		...row(2, (t) => ring([t * 1.16, 0, 0.44], 0.44, 0.22, 0.16)),
		block(0, 0, 0.48, 2.28, 2.33, 0.21),
		{
			...surface('highlight'),
			kind: 'dome',
			position: [0, 0, 0.69],
			radius: 1.29,
			height: 1.7 * factor,
			facets: 1
		},
		block(0, -1.11, 0.81, 1.22, 0.44, 0.14, 'accent')
	])
];
