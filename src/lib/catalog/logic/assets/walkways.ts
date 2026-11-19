import { family, block, legs, row, crescent, cage, shell } from './assembly';
import { rod, ring } from './parts';
const asset = family('access', 'deck');
export const walkways = [
	asset('beam-bridge', ['body', 'deck', 'glass'], [10, 3], (factor) => [
		...row(2, (t) => block(0, t * 0.98, 0, 9.8 * factor, 0.28, 0.52 * factor)),
		block(0, 0, 0.52 * factor, 9.8 * factor, 2.7, 0.22, 'deck'),
		...row(2, (t) => block(0, t * 1.27, 0.52 * factor + 0.22, 9.8 * factor, 0.12, 0.96, 'glass'))
	]),
	asset('viaduct-deck', ['body', 'deck', 'glass'], [9, 3], (factor) => [
		...legs(3.8, 1.15, 4.6 * factor),
		block(0, 0, 4.6 * factor, 8.8, 2.8, 0.32, 'deck'),
		...row(2, (t) => block(0, t * 1.32, 4.6 * factor + 0.32, 8.8, 0.1, 0.95, 'glass'))
	]),
	asset('turnback-walk', ['deck', 'glass'], [7, 7], (factor) => [
		crescent(3.3, 1.7, 0, 0.26, Math.PI, 'deck'),
		...row(2, (t) => block(t * 2.5, -1.6, 0, 1.6, 3.2, 0.26, 'deck')),
		crescent(3.3, 3.19, 0.26, 1.05 * factor, Math.PI, 'glass'),
		crescent(1.81, 1.7, 0.26, 1.05 * factor, Math.PI, 'glass')
	]),
	asset('covered-bridge', ['deck', 'body', 'glass'], [4, 9], (factor, variant) => [
		block(0, 0, 0, 3.6, 8.6, 0.25, 'deck'),
		...row(5 + variant, (t) => shell('vault', 0, t * 4.1, 0.25, 3.5, 0.15, 2.9 * factor, 0.18)),
		shell('vault', 0, 0, 0.25, 3.42, 8.4, 2.85 * factor, 0.07, 'glass')
	]),
	asset('bowstring-bridge', ['deck', 'body'], [9, 3], (factor) => [
		block(0, 0, 0, 8.8, 2.8, 0.26, 'deck'),
		...row(2, (t) => shell('vault', 0, t * 1.28, 0.26, 8.5, 0.14, 2.8 * factor, 0.14)),
		...row(5, (t) =>
			rod(
				[t * 3.8, -1.28, 0.26],
				[t * 3.8, -1.28, 0.26 + 2.8 * factor * Math.sqrt(1 - ((t * 3.8) / 4.25) ** 2)],
				0.045
			)
		)
	]),
	asset('truss-bridge', ['deck', 'body'], [9, 3], (factor) => [
		block(0, 0, 0, 8.8, 2.8, 0.28, 'deck'),
		...row(2, (t) => cage(0, t * 1.27, 0.28, 8.5, 0.12, 1.6 * factor, [5, 1, 1]))
	]),
	asset('stair-tower', ['body', 'deck'], [5, 5], (factor) => [
		cage(0, 0, 0, 4.6, 4.6, 6 * factor, [1, 1, 3], false),
		...Array.from({ length: 3 }, (_, j) =>
			row(11, (_, i) =>
				block(
					(j % 2 ? -1 : 1) * (i - 5) * 0.32,
					j % 2 ? 1 : -1,
					(j * 2 + i * 0.2) * factor,
					0.34,
					1.55,
					0.22 * factor,
					'deck'
				)
			)
		).flat(),
		...row(3, (_, i) =>
			block(i % 2 ? -1.95 : 1.95, 0, (i + 1) * 2 * factor, 0.7, 3.6, 0.22 * factor)
		)
	]),
	asset('lift-tower', ['body', 'glass'], [4, 4], (factor) => [
		cage(0, 0, 0, 2.8, 2.8, 7.6 * factor, [1, 1, 4], false),
		block(0, 0, 2.5 * factor, 2.5, 2.5, 2.2, 'glass'),
		block(0, 0, 7.6 * factor + 0.08, 3.4, 3.4, 0.3)
	]),
	asset('stop-platform', ['body', 'highlight', 'glass'], [8, 3], (factor) => [
		block(0, 0, 0, 7.8 * factor, 2.8, 0.5 * factor),
		block(0, -1.24, 0.5 * factor, 7.8 * factor, 0.24, 0.04, 'highlight'),
		block(0, 1.28, 0.5 * factor, 7.8 * factor, 0.14, 0.92, 'glass')
	]),
	asset('cycle-hoops', ['body'], [5, 2], (factor, variant) => [
		...row(3 + variant, (t) =>
			ring([t * 2.15, 0, 0.8 * factor + 0.16], 0.8 * factor, 0.72 * factor, 0.1)
		),
		...row(3 + variant, (t) => block(t * 2.15, 0, 0, 0.22, 0.6, 0.32))
	]),
	asset('vault-shelter', ['body', 'highlight'], [4, 5], (factor) => [
		shell('vault', 0, 0, 0, 3.8, 4.8 * factor, 2.7, 0.14),
		block(-1.25, 0, 0.46, 0.5, 4 * factor, 0.13, 'highlight'),
		...row(2, (t) => block(-1.25, t * 1.5 * factor, 0, 0.35, 0.18, 0.46))
	]),
	asset('cable-terminal', ['body', 'accent'], [6, 4], (factor, variant) => [
		...row(2 + variant, (t) => shell('arch', 0, t * 1.65, 0, 5.8, 0.32, 2.9 + 1.6 * factor, 0.38)),
		block(0, 0, 2.9 + 1.6 * factor, 5.6, 3.6, 0.25),
		block(0, 0, 0.55, 2.7, 2.5, 1.9, 'accent'),
		rod([0, 0, 2.45], [0, 0, 2.9 + 1.6 * factor], 0.15)
	])
];
