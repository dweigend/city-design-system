import { random } from './random';
import { box, clamp, count, type Primitive } from './types';
/** Split grammar; rectangular subtraction leaves four non-overlapping courtyard wings. */
export function split({
	depth,
	ratio,
	courtyard,
	seed
}: {
	depth: number;
	ratio: number;
	courtyard: number;
	seed: number;
}): Primitive[] {
	const d = count(depth, 0, 4),
		r = clamp(ratio, 0.25, 0.75),
		c = Math.sqrt(clamp(courtyard, 0, 0.65)) * 24;
	const out: Primitive[] = [];
	const rng = random(seed);
	function divide(x: number, y: number, w: number, h: number, level: number, path: string) {
		if (level === d) {
			const gap = Math.min(0.08, w * 0.1, h * 0.1);
			out.push(
				box(
					path,
					[x + gap, y + gap, 0],
					[w - 2 * gap, h - 2 * gap, 4 + Math.floor(rng() * 3) * 2],
					'--paper'
				)
			);
		} else if (w >= h) {
			divide(x, y, w * r, h, level + 1, path + 'a');
			divide(x + w * r, y, w * (1 - r), h, level + 1, path + 'b');
		} else {
			divide(x, y, w, h * r, level + 1, path + 'a');
			divide(x, y + h * r, w, h * (1 - r), level + 1, path + 'b');
		}
	}
	if (c === 0) divide(-12, -12, 24, 24, 0, 'block');
	else {
		const wing = (24 - c) / 2;
		divide(-12, -12, 24, wing, 0, 'south');
		divide(-12, c / 2, 24, wing, 0, 'north');
		divide(-12, -c / 2, wing, c, 0, 'west');
		divide(c / 2, -c / 2, wing, c, 0, 'east');
	}
	return out;
}
