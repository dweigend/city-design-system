import { block } from '../assembly';
import { drum, rod, ring } from '../parts';
import { rounded } from './kit-recipe';
import { houseSeries, moduleSpan } from './house-series';

function fitting(kind: 'elbow' | 'tee' | 'valve' | 'outlet' | 'manifold') {
	return houseSeries(
		'pipe-' + kind,
		[0.5, 1, 1.5],
		(l) => [moduleSpan(2 * l + 0.3), 1.25],
		['channel', 'frame'],
		['short-neck', 'raised-neck', 'tall-neck'],
		(l, v) => {
			const h = 0.35 + 0.15 * v;
			const parts = [
				drum([0, 0, 0], 0.3, 0.15, 'frame'),
				drum([0, 0, 0.15], 0.15, h - 0.15, 'channel')
			];
			parts.push(
				rod([kind === 'elbow' || kind === 'outlet' ? 0 : -l, 0, h], [l, 0, h], 0.15, 'channel')
			);
			if (kind === 'valve')
				parts.push(
					drum([0, 0, h], 0.15, 0.45, 'frame'),
					ring([0, 0, h + 0.65], 0.3, 0.18, 0.12, 'frame')
				);
			if (kind === 'manifold')
				for (const x of [-l, 0, l]) parts.push(drum([x, 0, h], 0.15, 0.4, 'channel'));
			if (kind === 'outlet') parts.push(ring([l, 0, h], 0.25, 0.15, 0.12, 'frame'));
			return parts;
		}
	);
}
export const serviceKit = [
	...(['elbow', 'tee', 'valve', 'outlet', 'manifold'] as const).flatMap(fitting),
	...houseSeries(
		'service-box',
		[1.25, 2.5, 3.75],
		(w) => [w, 1.25],
		['body', 'edge'],
		['one-door', 'two-door', 'three-door'],
		(w, v) => [
			rounded(0, 0, 0, w, 1, 1.25, 'body'),
			...Array.from({ length: v + 1 }, (_, i) =>
				block(
					((i + 0.5) / (v + 1) - 0.5) * (w - 0.3),
					0.525,
					0.15,
					(w - 0.3) / (v + 1) - 0.05,
					0.05,
					0.95,
					'edge'
				)
			)
		]
	)
];
