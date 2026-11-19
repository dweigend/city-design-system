import { block, shell } from '../assembly';
import { rod, surface } from '../parts';
import { rounded } from './kit-recipe';
import { streetSeries, lengths, lengthNames, supports } from './street-series';
import type { Vec3 } from '../../parametrik/types';

/** Sling fabric between cross-sections; both rails and fabric share the same bearings. */
function sling(stations: [number, number, number][], slot: string) {
	const points: Vec3[] = stations.flatMap(
		([x, z, w]) =>
			[
				[x, -w / 2, z],
				[x, w / 2, z]
			] as Vec3[]
	);
	const triangles = stations.slice(1).flatMap((_, i) => {
		const a = i * 2;
		return [a, a + 2, a + 1, a + 1, a + 2, a + 3];
	});
	return { ...surface(slot), kind: 'mesh' as const, points, triangles, lines: [] };
}
function washing(rack: boolean) {
	return streetSeries(
		rack ? 'drying-rack' : 'laundry-line',
		lengthNames,
		(i) => [lengths[i], 1.25],
		['frame', 'body', 'accent'],
		['two-cloths', 'three-cloths', 'four-cloths'],
		(i, v) => {
			const w = lengths[i],
				h = rack ? 1.1 : 1.85;
			const parts = [
				...[-1, 1].flatMap((s) => [
					rounded(s * (w / 2 - 0.15), 0, 0, 0.3, 0.9, 0.15, 'frame'),
					block(s * (w / 2 - 0.15), 0, 0.15, 0.12, 0.12, h - 0.15, 'frame')
				]),
				block(0, 0, h, w - 0.18, 0.12, 0.12, 'frame')
			];
			if (rack)
				for (const s of [-1, 1])
					parts.push(block(s * (w / 2 - 0.15), 0, h, 0.12, 0.9, 0.12, 'frame'));
			for (let j = 0; j < v + 2; j++) {
				const pitch = (w - 0.3) / (v + 2),
					x = (j - (v + 1) / 2) * pitch;
				parts.push(
					block(
						x,
						0.085,
						h - 0.45 - (j % 2) * 0.15,
						pitch - 0.05,
						0.05,
						0.55 + (j % 2) * 0.15,
						j % 2 ? 'body' : 'accent'
					)
				);
			}
			return parts;
		}
	);
}
export const streetTerrace = [
	...washing(false),
	...washing(true),
	...streetSeries(
		'awning',
		lengthNames,
		(i) => [lengths[i], 2.5],
		['frame', 'accent'],
		['shallow', 'standard', 'deep'],
		(i, v) => {
			const w = lengths[i],
				d = 1.25 + v * 0.5;
			return [
				...[-1, 1].flatMap((s) => [
					block(s * (w / 2 - 0.15), -d / 2 + 0.15, 0, 0.3, 0.3, 2.4, 'frame'),
					rod(
						[s * (w / 2 - 0.15), -d / 2 + 0.15, 1.5],
						[s * (w / 2 - 0.15), d / 2 - 0.15, 2.4],
						0.15,
						'frame'
					)
				]),
				rounded(0, 0, 2.4, w, d, 0.15, 'accent')
			];
		}
	),
	...streetSeries(
		'deck-chair',
		['single', 'wide', 'loveseat', 'settee'],
		(i) => [2.5, i < 2 ? 1.25 : 2.5],
		['frame', 'accent'],
		['upright', 'reading', 'reclined'],
		(i, v) => {
			const w = 0.55 + i * 0.3,
				back = -0.55 - v * 0.2;
			const stations: [number, number, number][] = [
				[back, 1.15, w],
				[-0.2, 0.45, w],
				[0.45, 0.55, w]
			];
			return [
				sling(stations, 'accent'),
				...[-1, 1].flatMap((s) => [
					rod([-0.5, (s * w) / 2, 0.06], [0.45, (s * w) / 2, 0.55], 0.06, 'frame'),
					rod([0.45, (s * w) / 2, 0.06], [back, (s * w) / 2, 1.15], 0.06, 'frame'),
					rod([-0.2, (s * w) / 2, 0.45], [back, (s * w) / 2, 1.15], 0.06, 'frame')
				])
			];
		}
	),
	...streetSeries(
		'hammock',
		['cot', 'single', 'double', 'family'],
		(i) => [3.75, i < 2 ? 1.25 : 2.5],
		['frame', 'accent'],
		['low', 'standard', 'high'],
		(i, v) => {
			const w = 0.65 + i * 0.2,
				h = 1.15 + v * 0.15;
			return [
				block(0, 0, 0, 3, 0.3, 0.15, 'frame'),
				...[-1, 1].flatMap((s) => [
					rod([s * 1.25, 0, 0.15], [s * 1.55, 0, h], 0.15, 'frame'),
					block(s * 1.25, 0, 0, 0.3, w, 0.15, 'frame')
				]),
				sling(
					[
						[-1.55, h, 0.12],
						[-1, 0.8, w],
						[0, 0.55, w],
						[1, 0.8, w],
						[1.55, h, 0.12]
					],
					'accent'
				)
			];
		}
	),
	...streetSeries(
		'garden-greenhouse',
		lengthNames,
		(i) => [lengths[i], 2.5],
		['frame', 'glass', 'planting'],
		['seedling', 'bench', 'walk-in'],
		(i, v) => {
			const l = lengths[i],
				h = 0.65 + v * 0.5;
			return [
				...supports(l, 2, h),
				rounded(0, 0, 0, l - 0.3, 1.65, 0.15, 'planting'),
				...[-1, 1].flatMap((s) => [
					block(s * (l / 2 - 0.15), 0, 0, 0.12, 1.4, h, 'glass'),
					block(0, s * 0.85, 0, l - 0.6, 0.12, h, 'glass')
				]),
				{ ...shell('vault', 0, 0, h, 2, l, 0.6, 0.12, 'glass'), rotation: Math.PI / 2 }
			];
		}
	)
];
