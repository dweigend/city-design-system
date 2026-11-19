import { drum, cap, surface } from '../parts';
import { cage, shell } from '../assembly';
import { panel, collar } from '../objects/forms';
import { series } from './series';
import type { ObjectGeometry } from '../object-geometry';

const roof = series(
	'rooftop-equipment',
	'roof',
	[3.75, 5, 7.5],
	['one-bank', 'two-bank', 'three-bank']
);
type Unit = 'extractor' | 'condenser' | 'solar' | 'skylight' | 'venturi' | 'scaffold' | 'gantry';
function fitting(type: Unit, x: number, w: number, d: number, v: number): ObjectGeometry[] {
	const r = Math.min(w, d) * 0.44,
		z = 0.32;
	switch (type) {
		case 'extractor':
			return [
				drum([x, 0, z], r, 0.72, 'ribbed'),
				collar(x, 0, z + 0.72, r, 0.14, 0.25, 'frame'),
				...[-1, 0, 1].map((s) =>
					panel(x + s * r * 0.43, 0, z + 0.82, 0.13, r * (s ? 1.45 : 1.8), 0.12, 'frame')
				)
			];
		case 'condenser':
			return [
				panel(x, 0, z, w * 0.92, d * 0.8, 1.15, 'ribbed'),
				cap([x, 0, z + 1.15], r, 0.24, 'frame')
			];
		case 'solar':
			return [
				drum([x, 0, z], 0.18, 0.84, 'frame'),
				{
					...surface('glass'),
					kind: 'wedge',
					position: [x - w * 0.47, -d * 0.46, 1.16],
					size: [w * 0.94, d * 0.92, 0.42],
					low: 0.18
				}
			];
		case 'skylight':
			return [
				shell('vault', x, 0, z, w * 0.94, d * 0.86, 0.8, 0.13, 'glass'),
				...[-1, 1].map((s) =>
					shell('vault', x, s * d * 0.39, z, w * 0.98, 0.18, 0.85, 0.16, 'frame')
				)
			];
		case 'venturi':
			return [
				collar(x, 0, z, r, 0.15, 1.12, 'ribbed'),
				collar(x, 0, z + 1.12, r * 1.02, 0.18, 0.24, 'frame')
			];
		case 'scaffold':
			return [
				{ ...cage(x, 0, z, w * 0.85, d * 0.85, 2.4 + v, [1, 1, 2]), slot: 'frame' },
				panel(x, 0, z + 2.46 + v, w * 0.92, d * 0.92, 0.24, 'slats')
			];
		case 'gantry':
			return [
				shell('arch', x, 0, z, w * 0.92, d * 0.6, 1.8, 0.3, 'frame'),
				panel(x, 0, z + 1.8, w * 0.92, d * 0.86, 0.32, 'slats')
			];
	}
}
function bank(type: Unit) {
	const skin =
		type === 'scaffold' || type === 'gantry'
			? 'slats'
			: type === 'skylight' || type === 'solar'
				? 'glass'
				: 'ribbed';
	return roof(
		type + '-roof-bank',
		['foot', 'frame', skin],
		() => 3.5,
		(w, v) => {
			const n = v + 1;
			return [
				panel(0, 0, 0, w, 3.45, 0.32, 'foot'),
				...Array.from({ length: n }, (_, i) =>
					fitting(type, ((i + 0.5) / n - 0.5) * w, w / n, 3.35, v)
				).flat()
			];
		}
	);
}
export const rooftops = (
	['extractor', 'condenser', 'solar', 'skylight', 'venturi', 'scaffold', 'gantry'] as const
).flatMap(bank);
