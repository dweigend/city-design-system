import { shell, circle } from '../assembly';
import { bulb, drum } from '../parts';
import { panel, collar } from '../objects/forms';
import { series, tubeRing } from './series';

const pool = series('water-terraces', 'deck', [5, 7.5, 10], ['shallow', 'stepped', 'raised']);
function lagoon(shape: 'ring' | 'island' | 'cascade' | 'jet') {
	return pool(
		shape + '-water-court',
		['foot', 'liquid', shape === 'island' ? 'planting' : 'body'],
		(w) => w,
		(w, v) => {
			const r = w * 0.48,
				h = 0.42 + 0.26 * v;
			const parts = [
				drum([0, 0, 0], r, 0.2, 'foot'),
				collar(0, 0, 0.2, r, 0.28, h, 'foot'),
				drum([0, 0, 0.2], r - 0.28, h - 0.15, 'liquid')
			];
			if (shape === 'island')
				parts.push(
					drum([0, 0, h], 0.3 * r, 0.42, 'foot'),
					bulb([0, 0, h + 0.58], r * 0.3, 0.5, 'planting')
				);
			if (shape === 'cascade')
				for (let i = 0; i < 2; i++)
					parts.push(
						drum([0, 0, h + i * 0.45], r * (0.67 - i * 0.29), 0.48, 'body'),
						drum([0, 0, h + 0.48 + i * 0.45], r * (0.66 - i * 0.29), 0.055, 'liquid')
					);
			if (shape === 'jet')
				parts.push(
					...circle(r * 0.44, 3 + v).map(([x, y]) => bulb([x, y, h + 0.38], 0.19, 2.5, 'body'))
				);
			if (shape === 'ring') parts.push(tubeRing([0, 0, h + 0.14], r * 0.5, 0.21, 'z', 'body'));
			return parts;
		}
	);
}
function skate(shape: 'cradle' | 'twin' | 'arch') {
	return pool(
		shape + '-skate-court',
		['foot', 'slats', 'brass'],
		(w) => w,
		(w, v) => {
			const n = shape === 'twin' ? 2 : 1,
				span = w / n - 0.32,
				h = span * (0.22 + v * 0.08),
				d = w - 0.4;
			return [
				panel(0, 0, 0, w, w, 0.25, 'foot'),
				...Array.from({ length: n }, (_, i) => {
					const x = ((i - (n - 1) / 2) * w) / n;
					return [
						shell(shape === 'arch' ? 'arch' : 'halfpipe', x, 0, 0.25, span, d, h, 0.26, 'slats'),
						...[-1, 1].map((s) =>
							panel(
								x + s * (span / 2 - 0.09),
								0,
								shape === 'arch' ? 0.25 : 0.25 + h - 0.08,
								0.18,
								d,
								0.16,
								'brass'
							)
						)
					];
				}).flat()
			];
		}
	);
}
export const pools = [
	...lagoon('ring'),
	...lagoon('island'),
	...lagoon('cascade'),
	...lagoon('jet'),
	...skate('cradle'),
	...skate('twin'),
	...skate('arch')
];
