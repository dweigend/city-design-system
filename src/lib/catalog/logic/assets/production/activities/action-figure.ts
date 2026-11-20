import type { Vec3 } from '../../../parametrik/types';
import { bulb, surface } from '../../parts';
import type { ObjectGeometry } from '../../object-geometry';
export type Pose = 'stand' | 'walk' | 'sit' | 'carry' | 'lean' | 'cycle' | 'climb';
type Level = [number, number, number, number];
export const graphiteFigure = {
	material: 'metal',
	finish: 'metall-graphit',
	token: '--ink'
} as const;
// Elliptical sections describe one continuous piece of cut model stock.
function tapered(levels: Level[], place: (p: Vec3) => Vec3, slot: string): ObjectGeometry {
	const n = 12,
		points = levels.flatMap(([x, z, depth, width]) =>
			Array.from({ length: n }, (_, i) =>
				place([
					x + depth * Math.cos((i * 2 * Math.PI) / n),
					width * Math.sin((i * 2 * Math.PI) / n),
					z
				])
			)
		);
	const triangles: number[] = [];
	for (let k = 1; k < levels.length; k++)
		for (let i = 0; i < n; i++) {
			const a = (k - 1) * n + i,
				b = (k - 1) * n + ((i + 1) % n);
			triangles.push(a, b, b + n, a, b + n, a + n);
		}
	const top = points.length - n;
	for (let i = 1; i < n - 1; i++) triangles.push(0, i + 1, i, top, top + i, top + i + 1);
	return { ...surface(slot), kind: 'mesh', points, triangles, lines: [] };
}
type FigureOptions = {
	child?: boolean;
	sample?: number;
	heading?: number;
	slot?: string;
	phase?: number;
};
type Place = (p: Vec3) => Vec3;
function placement([x, y, z]: Vec3, heading: number): Place {
	const c = Math.cos(heading),
		s = Math.sin(heading);
	return ([a, b, h]) => [x + a * c - b * s, y + a * s + b * c, z + h];
}
function legs(
	pose: Pose,
	hip: number,
	width: number,
	phase: number,
	place: Place,
	slot: string
): ObjectGeometry[] {
	if (pose === 'walk' || pose === 'cycle' || pose === 'climb')
		return [-1, 1].map((sign) => {
			const lift = pose === 'climb' && sign > 0 ? 0.18 : 0;
			const ankle = pose === 'cycle' ? 0.29 + sign * 0.045 * phase : 0.055;
			return {
				...surface(slot),
				kind: 'capsule',
				from: place([0, sign * width * 0.4, hip]),
				to: place([sign * (0.15 + 0.035 * phase), sign * width * 0.4, ankle + lift]),
				radius: 0.055
			};
		});
	const knee = pose === 'sit' ? 0.25 : 0;
	return [
		tapered(
			[
				[knee, 0, 0.075, 0.1],
				[knee, hip * 0.8, 0.08, width * 0.55],
				[0, hip + 0.035, 0.09, width * 0.69]
			],
			place,
			slot
		)
	];
}
const hipFraction: Partial<Record<Pose, number>> = { cycle: 0.47 };
const armPoses = new Set<Pose>(['carry', 'cycle', 'lean']);
/** Builds a rigid, monochrome architectural scale figure in metres, facing along local x. */
export function actionFigure(
	pose: Pose,
	origin: Vec3,
	{ child = false, sample = 0.5, heading = 0, slot = 'coat', phase = 0 }: FigureOptions = {}
): ObjectGeometry[] {
	const stature = (child ? 1.1 : 1.6) + 0.2 * sample,
		width = stature * 0.112;
	const legShare = child ? 0.42 : 0.49;
	const hip = pose === 'sit' ? 0.45 : stature * (hipFraction[pose] ?? legShare);
	const h = hip + stature * (1 - legShare);
	const head = (pose === 'cycle' ? h - 0.235 + phase * 0.045 : h) * (child ? 0.16 : 0.13);
	const lean = pose === 'stand' ? 0 : 0.06,
		place = placement(origin, heading);
	const torso = tapered(
		[
			[0, hip, 0.085, width * 0.69],
			[lean, h - head - 0.115, 0.11, width],
			[lean, h - head + 0.012, 0.069, width * 0.64]
		],
		place,
		slot
	);
	const parts = [
		bulb(place([lean, 0, h - head / 2]), head / 2, 1, slot),
		torso,
		...legs(pose, hip, width, phase, place, slot)
	];
	if (armPoses.has(pose))
		parts.push({
			...surface(slot),
			kind: 'capsule',
			from: place([lean, 0, h - head - 0.18]),
			to: place([0.25, 0, hip + 0.13]),
			radius: 0.058
		});
	return parts;
}
