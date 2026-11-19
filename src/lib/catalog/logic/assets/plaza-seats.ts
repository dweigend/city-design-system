import { family, block, row, circle, crescent, shell, pipe } from './assembly';
import { drum, rod, cap, surface } from './parts';
const asset = family('street-furniture', 'deck');
export const plazaSeats = [
	asset('backrest-bench', ['body', 'accent'], [3, 1.2], (factor) => [
		...row(2, (t) => block(t * 0.95 * factor, 0, 0, 0.22, 0.68, 0.45)),
		block(0, 0, 0.45, 2.9 * factor, 0.88, 0.13, 'accent'),
		block(0, 0.39, 0.55, 2.9 * factor, 0.13, 0.5, 'accent')
	]),
	asset('seat-steps', ['accent'], [5, 5], (factor) => [
		...row(3, (_, i) =>
			crescent(
				2.4 - i * 0.48,
				1.94 - i * 0.48,
				0,
				(i + 1) * 0.31 * factor,
				Math.PI * 0.91,
				'accent'
			)
		)
	]),
	asset('wavy-lounger', ['highlight', 'body'], [3, 1.3], (factor) => [
		...row(7, (t) =>
			pipe(
				[
					[-1.2, t * 0.52, 0.36],
					[-0.8, t * 0.52, 0.55],
					[0, t * 0.52, 0.42],
					[0.64, t * 0.52, 0.57],
					[1.22, t * 0.52, 1.1 * factor]
				],
				0.085,
				'highlight'
			)
		),
		...row(2, (t) => block(t * 0.88, 0, 0, 0.18, 1.11, 0.45))
	]),
	asset('cone-stools', ['highlight'], [3, 2], (factor) => [
		...row(3, (t, i) => ({
			...surface('highlight'),
			kind: 'cone',
			position: [t * 0.9, 0, 0],
			radius: 0.42,
			height: (0.52 + i * 0.1) * factor
		})),
		...row(3, (t, i) =>
			drum([t * 0.9, 0, (0.28 + i * 0.1) * factor], 0.27, (0.25 + i * 0.01) * factor, 'highlight')
		)
	]),
	asset('tree-seat', ['accent', 'body'], [4, 4], (factor, variant) => [
		crescent(1.88, 1.27, 0.38, 0.17, Math.PI * (0.8 + variant * 0.5), 'accent'),
		...circle(1.6, 6)
			.slice(0, 3 + variant)
			.map(([x, y]) => drum([x, y, 0], 0.13 * factor, 0.38))
	]),
	asset('picnic-set', ['body', 'accent'], [3, 2.6], (factor) => [
		block(0, 0, 0.82, 2.8 * factor, 0.84, 0.12),
		...row(2, (t) => block(0, t * 0.92, 0.46, 2.8 * factor, 0.44, 0.13, 'accent')),
		...row(2, (t) => block(t * 0.88 * factor, 0, 0, 0.16, 2.3, 0.46)),
		...row(2, (t) => block(t * 0.88 * factor, 0, 0.46, 0.18, 0.65, 0.36))
	]),
	asset('swing-seat', ['body', 'accent'], [4, 2], (factor) => [
		shell('vault', 0, 0, 0, 3.8, 0.32, 3 * factor, 0.21),
		...row(2, (t) => rod([t * 0.78, 0, 0.64], [t * 0.78, 0, 2.59 * factor], 0.06)),
		block(0, 0, 0.49, 1.88, 0.85, 0.18, 'accent')
	]),
	asset('crescent-seat', ['highlight'], [4, 4], (factor) => [
		crescent(1.92, 1.2, 0, 0.52 * factor, Math.PI * 1.55, 'highlight')
	]),
	asset('alcove-seat', ['highlight', 'accent'], [3, 2], (factor) => [
		block(-1.2, 0, 0, 0.2, 1.7, 2.2 * factor, 'highlight'),
		block(1.2, 0, 0, 0.2, 1.7, 2.2 * factor, 'highlight'),
		block(0, 0, 2.2 * factor, 2.6, 1.7, 0.16, 'highlight'),
		block(-0.75, 0, 0.48, 0.91, 1.65, 0.14, 'accent')
	]),
	asset('parasol-seat', ['accent', 'body', 'highlight'], [4, 4], (factor) => [
		drum([0, 0, 0], 1.6, 0.42, 'accent'),
		drum([0, 0, 0.42], 0.065, 2.1 * factor),
		cap([0, 0, 0.42 + 2.1 * factor], 1.85, 0.44, 'highlight')
	])
];
