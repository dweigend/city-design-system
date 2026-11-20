import { block } from '../assembly';
import { kitRecipe } from './kit-recipe';
import { surface } from '../parts';
import type { Vec3 } from '../../parametrik/types';

/** A rolled return on a single perforated hood, carried by its two rear brackets. */
function hood(w: number, drop: number) {
	const points: Vec3[] = [],
		triangles: number[] = [];
	for (let i = 0; i <= 16; i++) {
		const a = (Math.PI * i) / 32,
			y = 0.58 - 1.16 * Math.sin(a),
			z = 2.48 - drop * (1 - Math.cos(a));
		const k = points.length;
		points.push(
			[-w / 2, y, z],
			[w / 2, y, z],
			[w / 2, y + 0.1 * Math.sin(a), z - 0.16 * Math.cos(a)],
			[-w / 2, y + 0.1 * Math.sin(a), z - 0.16 * Math.cos(a)]
		);
		if (k > 0)
			for (let j = 0; j < 4; j++) {
				const c = k + j,
					d = k + ((j + 1) % 4);
				triangles.push(c - 4, c, d, d - 4, c - 4, d);
			}
	}
	const k = points.length - 4;
	triangles.push(0, 1, 2, 0, 2, 3, k, k + 2, k + 1, k, k + 3, k + 2);
	return { ...surface('shell'), kind: 'mesh' as const, points, triangles, lines: [] };
}
export const deckAwning = {
	...kitRecipe(
		'kit-terrace-awning',
		'house-fittings',
		[2.5, 1.25],
		['shell', 'frame'],
		['short', 'standard', 'long'],
		(v) => {
			const w = 2.12 + 0.19 * v;
			return [
				hood(w, 0.59 + v * 0.06),
				...[-1, 1].map((s) => block(s * (w / 2 - 0.24), 0.38, 0, 0.3, 0.3, 2.35, 'frame'))
			];
		}
	),
	suggestions: {
		shell: { material: 'metal', finish: 'perforated-metal', token: '--paper' },
		frame: { material: 'metal', finish: 'metall-messing', token: '--cat-mobility' }
	}
} as const;
