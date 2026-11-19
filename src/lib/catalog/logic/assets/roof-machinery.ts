import { family, circle } from './assembly';
import { panel, collar } from './objects/forms';
import { drum } from './parts';

const asset = family('house-fittings', 'roof');
export const roofMachinery = [
	asset('fan-bank', ['highlight', 'deck', 'body'], [4, 2], (factor, variant) => {
		const count = 1 + variant,
			pitch = 3.6 / count;
		const radius = Math.min(0.63, pitch * 0.39),
			height = 0.48 + factor * 0.56;
		const centres = Array.from({ length: count }, (_, i) => (i + 0.5 - count / 2) * pitch);
		const openings = centres.map((x) =>
			circle(radius, 48)
				.map(([a, b]): [number, number] => [x + a, b])
				.reverse()
		);
		return [
			panel(0, 0, 0, 3.8, 1.78, height - 0.18, 'highlight'),
			{ ...panel(0, 0, height - 0.18, 3.8, 1.78, 0.18, 'highlight'), holes: openings },
			...centres.flatMap((x) => [
				drum([x, 0, height - 0.17], radius, 0.035, 'deck'),
				collar(x, 0, height, radius + 0.09, 0.09, 0.11, 'body'),
				drum([x, 0, height - 0.14], radius / 3, 0.12, 'body')
			])
		];
	})
];
