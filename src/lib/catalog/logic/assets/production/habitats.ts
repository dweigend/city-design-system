import { bulb, ring, drum } from '../parts';
import { panel } from '../objects/forms';
import { series, pillow } from './series';

const habitat = series(
	'habitat-pods',
	'deck',
	[5, 7.5, 10],
	['low-slung', 'raised-brow', 'high-waist']
);
const noses = ['visor', 'bubble', 'port'] as const;
function cabin(nose: (typeof noses)[number], twin: boolean) {
	const width = twin ? 6 : 3;
	return habitat(
		(twin ? 'twin' : 'single') + '-' + nose + '-habitat',
		['body', 'glass', 'foot'],
		() => width,
		(span, v, s) => {
			const radius = [0.96, 1.18, 1.32][v],
				z = radius + 0.19 + v * 0.22,
				half = span / 2 - radius - 0.22;
			const centres = twin ? [-0.82, 0.82] : [0];
			const bed = panel(0, 0, 0, span - 1.4, twin ? 2.85 : 1.8, z - radius + 0.3, 'foot');
			return [
				bed,
				...centres.flatMap((y) => {
					const rearY = y * 0.75,
						frontY = y * 1.18,
						front = half - (y < 0 ? 0.6 : 0);
					const frontZ = z + 0.26 * v;
					const skin = pillow([-half, rearY, z], [front, frontY, frontZ], radius, 'body');
					if (nose === 'port')
						return [
							skin,
							{
								...ring([front + radius + 0.035, frontY, frontZ], radius * 0.69, 0, 0.14, 'glass'),
								curvature: radius
							},
							{
								...ring(
									[front + radius + 0.042, frontY, frontZ],
									radius * 0.78,
									radius * 0.69,
									0.16,
									'foot'
								),
								curvature: radius
							}
						];
					const glazing =
						nose === 'bubble'
							? bulb([front + 0.2, frontY, frontZ + radius * 0.43], radius * 0.95, 0.88, 'glass')
							: pillow(
									[-half * 0.7, rearY, z + 0.64],
									[front * 0.9, frontY, frontZ + 0.64],
									radius * (0.77 + 0.04 * s),
									'glass'
								);
					return [skin, glazing];
				})
			];
		}
	);
}
export const habitats = [
	...noses.flatMap((n) => [...cabin(n, false), ...cabin(n, true)]),
	...habitat(
		'clover-habitat',
		['foot', 'body', 'glass'],
		(w) => w,
		(span, v) => {
			const r = span * 0.225,
				n = v + 3;
			return [
				drum([0, 0, 0], span * 0.31, 0.48, 'foot'),
				...Array.from({ length: n }, (_, i) =>
					bulb(
						[r * Math.cos((i * 2 * Math.PI) / n), r * Math.sin((i * 2 * Math.PI) / n), r + 0.3],
						r,
						1,
						'body'
					)
				),
				bulb([0, 0, 1.55 * r], 1.08 * r, 0.84, 'glass')
			];
		}
	)
];
