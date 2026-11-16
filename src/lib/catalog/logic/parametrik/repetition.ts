import { box, clamp, count, type Primitive } from './types';
import { random } from './random';
export function repetition({
	amount,
	spread,
	seed
}: {
	amount: number;
	spread: number;
	seed: number;
}): Primitive[] {
	const n = count(amount, 3, 18),
		s = clamp(spread, 0, 1),
		rng = random(seed);
	const out: Primitive[] = [box('beam', [-n * 2, -1, 0], [n * 4, 2, 0.6], '--paper', 'bestand')];
	for (let i = 0; i < n; i++) {
		const h = 4 + (rng() - 0.5) * 5 * s;
		out.push(
			box(
				`capsule-${i}`,
				[(i - n / 2) * 4 + 0.4, -2, 0.6],
				[3.2, 4, h],
				rng() < 0.5 ? '--cat-business' : '--paper',
				'neu',
				'wood'
			)
		);
		out.push(
			box(
				`window-${i}`,
				[(i - n / 2) * 4 + 1, 2, 1.4],
				[2, 0.04, h * 0.5],
				'--paper',
				'neu',
				'metal'
			)
		);
	}
	return out;
}
