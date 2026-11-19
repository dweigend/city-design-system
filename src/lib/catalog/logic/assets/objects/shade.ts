import { suggestions } from './suggestions';
import { family, row } from '../assembly';
import { panel, post, rail, bow, lens, bead } from './forms';
import { sail } from './fabric';

const asset = family('shade', 'deck', suggestions);
export const shade = [
	asset('button-parasol', ['foot', 'frame', 'fabric', 'body'], [4.2, 4.2], (span) => [
		post(0, 0, 0, 0.42, 0.15, 'foot'),
		post(0, 0, 0.15, 0.065, 2.15),
		lens(0, 0, 2.3, 1.95 * span, 0.43, 'fabric'),
		bead(0, 0, 2.73, 0.085, 1, 'body')
	]),
	asset('tension-square', ['frame', 'fabric'], [5, 3.1], (span) => [
		...row(2, (t) => post(t * 2.18 * span, -1.28, 0, 0.075, t < 0 ? 2.55 : 2.95)),
		...row(2, (t) => post(t * 2.18 * span, 1.28, 0, 0.075, t < 0 ? 2.95 : 2.55)),
		sail(
			[
				[-2.18 * span, -1.28, 2.55],
				[2.18 * span, -1.28, 2.95],
				[2.18 * span, 1.28, 2.55],
				[-2.18 * span, 1.28, 2.95]
			],
			0.15
		)
	]),
	asset('fan-awning', ['frame', 'fabric'], [4.3, 2.8], (span) => [
		...row(2, (t) => post(t * 1.65 * span, 0.95, 0, 0.085, 2.8)),
		...row(2, (t) =>
			rail(
				[
					[t * 1.65 * span, 0.95, 2.1],
					[t * 1.65 * span, -1.13, 2.33]
				],
				0.05
			)
		),
		sail(
			[
				[-1.65 * span, 0.95, 2.8],
				[-1.65 * span, -1.13, 2.33],
				[1.65 * span, -1.13, 2.33],
				[1.65 * span, 0.95, 2.8]
			],
			0.06
		)
	]),
	asset('vault-parasol', ['foot', 'frame', 'fabric'], [4.5, 3], (span) => [
		post(0, 0, 0, 0.52, 0.12, 'foot'),
		post(0, 0, 0.12, 0.1, 2.6),
		bow(0, 0, 2.2, 4.1 * span, 2.55, 0.45, 'fabric')
	]),
	asset('louvre-pergola', ['foot', 'slats'], [5, 3], (span, variant) => [
		...row(2, (t) => panel(t * 2.04 * span, 0, 0, 0.12, 2.5, 2.35, 'foot')),
		...row(4 + variant * 2, (t) => panel(t * 2.12 * span, 0, 2.35, 0.2, 2.7, 0.13))
	]),
	asset('paired-shade', ['frame', 'fabric'], [4.9, 3], (span) => [
		...row(2, (t) => post(t * 1.1 * span, 0, 0, 0.09, 2.2 + t * 0.16)),
		...row(2, (t) => lens(t * 1.1 * span, 0, 2.2 + t * 0.16, 1.22 * span, 0.32, 'fabric'))
	]),
	asset('ripple-canopy', ['frame', 'fabric'], [4.6, 3], (span) => [
		...row(2, (t) =>
			rail(
				[
					[t * 1.95 * span, -1.1, 0.055],
					[t * 1.95 * span, -1.1, 2.3]
				],
				0.055
			)
		),
		...row(2, (t) => post(t * 1.95 * span, 1.1, 0, 0.055, 2.3)),
		...row(2, (t) => panel(0, t * 1.1, 2.3, 4.1 * span, 0.09, 0.1, 'frame')),
		...row(3, (_, i) => bow((i - 1) * 1.31 * span, 0, 2.4, 1.33 * span, 2.53, 0.28, 'fabric'))
	]),
	asset('cantilever-sun-disc', ['foot', 'frame', 'fabric'], [4.3, 4.2], (span) => [
		post(-0.8, 0, 0, 0.48, 0.13, 'foot'),
		post(-0.8, 0, 0.13, 0.1, 2.45),
		rail(
			[
				[-0.8, 0, 2.55],
				[0.3, 0, 2.76]
			],
			0.075
		),
		lens(0.3, 0, 2.71, 1.65 * span, 0.24, 'fabric')
	]),
	asset('ridge-sail', ['frame', 'fabric'], [4.6, 3.3], (span) => [
		...row(2, (t) => post(t * 1.95 * span, 0, 0, 0.08, 2.99)),
		...row(2, (t) =>
			sail(
				[
					[-1.95 * span, 0, 2.99],
					[1.95 * span, 0, 2.99],
					[1.95 * span, t * 1.38, 2.12],
					[-1.95 * span, t * 1.38, 2.12]
				],
				0.08
			)
		),
		...row(2, (t) =>
			rail(
				[
					[-1.95 * span, t * 1.38, 2.12],
					[-1.95 * span, 0, 2.96],
					[-1.95 * span, -t * 1.38, 2.12]
				],
				0.035
			)
		)
	]),
	asset('tier-parasol', ['foot', 'frame', 'fabric', 'shell'], [4.1, 4.1], (span) => [
		post(0, 0, 0, 0.4, 0.14, 'foot'),
		post(0, 0, 0.14, 0.07, 2.65),
		lens(0, 0, 2.14, 1.85 * span, 0.32, 'fabric'),
		lens(0, 0, 2.49, 1.23 * span, 0.28, 'shell')
	])
];
