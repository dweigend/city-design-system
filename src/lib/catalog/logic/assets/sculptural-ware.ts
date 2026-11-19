import { family, block, row, shell, pipe } from './assembly';
import { drum, bulb, ring } from './parts';
import { vessel } from './pottery';
const asset = family('ceramics', 'deck');
export const sculpturalWare = [
	asset('orb-finial', ['body', 'highlight'], [2, 2], (factor) => [
		drum([0, 0, 0], 0.62, 0.3),
		bulb([0, 0, 0.3 + 1.15 * factor], 0.88, (1.15 * factor) / 0.88, 'highlight')
	]),
	asset('memphis-portal', ['accent', 'highlight'], [5, 2], (factor) => [
		shell('arch', 0, 0, 0, 4.4, 1.3, 1 + 3 * factor, 0.42, 'accent'),
		bulb([1.6, 0, 1 + 3 * factor + 0.4], 0.42, 1, 'highlight')
	]),
	asset('offset-totem', ['body', 'trim', 'channel', 'highlight'], [3, 3], (factor, variant) => [
		drum([0, 0, 0], 1, 0.3),
		block(-0.36, 0, 0.3, 1.25, 1.4, 1.7 * factor, 'trim'),
		ring([0.1, 0, 0.3 + 1.7 * factor + 0.74], 0.84, 0.36, 0.6, 'channel'),
		...Array.from({ length: 1 + variant }, (_, i) =>
			bulb([0.18, 0, 0.3 + 1.7 * factor + 1.93 + i * 0.72], 0.43, 1, 'highlight')
		)
	]),
	asset('disc-capital', ['body', 'accent', 'deck'], [3, 3], (factor, variant) => [
		drum([0, 0, 0], 0.52, 0.48),
		...row(2 + variant, (_, i) =>
			drum([0, 0, 0.48 + i * 0.18], (0.68 + i * 0.22) * factor, 0.18, i % 2 ? 'deck' : 'accent')
		)
	]),
	asset('loop-handle-vase', ['accent', 'highlight'], [3, 3], (factor) => [
		vessel(
			[
				[0.55, 0],
				[0.95, 0.6],
				[0.85, 1.4],
				[0.45, 1.7],
				[0.45, 2.1]
			],
			24,
			factor,
			'accent'
		),
		...row(2, (t) => ({
			...ring([0, t * 0.9, 1.05 * factor], 0.48 * factor, 0.33 * factor, 0.16, 'highlight')
		}))
	]),
	asset('zigzag-column', ['body', 'trim', 'highlight'], [3, 2], (factor) => [
		block(0, 0, 0, 2.7, 1.4, 0.3),
		pipe(
			[
				[-0.6, 0, 0.29],
				[0.82, 0, 1.42 * factor],
				[-0.8, 0, 2.6 * factor],
				[0.8, 0, 3.9 * factor + 0.12]
			],
			0.27,
			'trim'
		),
		drum([0.8, 0, 3.9 * factor], 0.58, 0.24, 'highlight')
	])
];
