import type { Vec2 } from '../../core/geometry';
import type { Random } from '../../core/random';
import type { RiverCourse } from './course';
import { sampleBand } from './parameters';

/** Lake defaults in meters, except for the unitless chance per unit relief. */
export const LAKE_DEFAULTS = {
	/** Chance of a seeded lake at relief 1; a basin needs relief, so a flat valley has none. */
	chancePerRelief: 0.6,
	stationM: [-600, 600],
	halfLengthM: [900, 1400],
	/** Shore margin beyond the river bank and the bend of the river inside the lake. */
	shoreMarginM: [110, 360],
	/** Greatest half-width as a share of half-length, so a lake reads long along the valley. */
	aspect: 0.5,
	depthM: [8, 14],
	depthPerReliefM: 36,
	/** Distance from the shore over which the bed falls to full depth. */
	bedRunM: 220
} as const;

/** A flat-water widening of the river, as an ellipse in world meters. */
export type Lake = Readonly<{
	center: Vec2;
	bearing: number;
	halfLength: number;
	halfWidth: number;
	/** Water surface in meters; equal at every lake point. */
	level: number;
	/** Greatest depth below the level, in meters. */
	depth: number;
	/** Ellipse area in square meters. */
	area: number;
}>;

/** Valley-axis interval in which the water stays at lake level. */
export type LakeReach = Readonly<{ fromAlongM: number; toAlongM: number }>;

function coursePointAt(course: RiverCourse, fx: number, fy: number, along: number): Vec2 {
	const { xy } = course;
	let best = 0;
	for (let i = 2; i < xy.length; i += 2) {
		if (
			Math.abs(xy[i] * fx + xy[i + 1] * fy - along) <
			Math.abs(xy[best] * fx + xy[best + 1] * fy - along)
		)
			best = i;
	}
	return [xy[best], xy[best + 1]];
}

function sagitta(course: RiverCourse, from: Vec2, to: Vec2): number {
	const dx = to[0] - from[0];
	const dy = to[1] - from[1];
	const length = Math.hypot(dx, dy);
	const minX = Math.min(from[0], to[0]) - length;
	const maxX = Math.max(from[0], to[0]) + length;
	let worst = 0;
	for (let i = 0; i < course.xy.length; i += 2) {
		const x = course.xy[i];
		const y = course.xy[i + 1];
		if (x < minX || x > maxX) continue;
		const t = ((x - from[0]) * dx + (y - from[1]) * dy) / (length * length);
		if (t <= 0 || t >= 1) continue;
		worst = Math.max(worst, Math.abs((y - from[1]) * dx - (x - from[0]) * dy) / length);
	}
	return worst;
}

/** Decides and shapes the lake. The ellipse runs along the chord between the river points where
 * it enters and leaves, so the river meets both tips. Returns null without a lake. */
export function drawLake(
	random: Random,
	course: RiverCourse,
	axisBearing: number,
	relief: number,
	mode: number
): Omit<Lake, 'level'> | null {
	const chance = mode === 2 ? 1 : mode === 1 ? LAKE_DEFAULTS.chancePerRelief * relief : 0;
	if (!(random.derive('chance').number() < chance)) return null;
	const shape = random.derive('shape');
	const fx = Math.cos(axisBearing);
	const fy = Math.sin(axisBearing);
	const station = sampleBand(LAKE_DEFAULTS.stationM, shape.number());
	const reach = sampleBand(LAKE_DEFAULTS.halfLengthM, shape.number());
	const entry = coursePointAt(course, fx, fy, station - reach);
	const exit = coursePointAt(course, fx, fy, station + reach);
	const bend = sagitta(course, entry, exit);
	const halfLength = Math.hypot(exit[0] - entry[0], exit[1] - entry[1]) / 2;
	const halfWidth = Math.min(
		LAKE_DEFAULTS.aspect * halfLength,
		course.wetWidth / 2 + bend + sampleBand(LAKE_DEFAULTS.shoreMarginM, shape.number())
	);
	const depth =
		sampleBand(LAKE_DEFAULTS.depthM, shape.number()) + LAKE_DEFAULTS.depthPerReliefM * relief;
	return Object.freeze({
		center: Object.freeze([(entry[0] + exit[0]) / 2, (entry[1] + exit[1]) / 2] as const),
		bearing: Math.atan2(exit[1] - entry[1], exit[0] - entry[0]),
		halfLength,
		halfWidth,
		depth,
		area: Math.PI * halfLength * halfWidth
	});
}

/** Axis interval covered by the ellipse, for an axis with the given bearing. */
export function lakeReach(lake: Omit<Lake, 'level'>, axisBearing: number): LakeReach {
	const fx = Math.cos(axisBearing);
	const fy = Math.sin(axisBearing);
	const along = lake.center[0] * fx + lake.center[1] * fy;
	const angle = lake.bearing - axisBearing;
	const extent = Math.hypot(lake.halfLength * Math.cos(angle), lake.halfWidth * Math.sin(angle));
	return Object.freeze({ fromAlongM: along - extent, toAlongM: along + extent });
}

/** Keeps the water flat across the lake reach and continues the fall downstream of it. */
export function flattenedAlong(reach: LakeReach | null, alongM: number): number {
	if (!reach || alongM <= reach.fromAlongM) return alongM;
	if (alongM <= reach.toAlongM) return reach.fromAlongM;
	return alongM - (reach.toAlongM - reach.fromAlongM);
}

/** Signed distance to the shore in meters, negative in the lake; first order near the shore. */
export function lakeDistance(lake: Omit<Lake, 'level'>, x: number, y: number): number {
	const c = Math.cos(lake.bearing);
	const s = Math.sin(lake.bearing);
	const dx = x - lake.center[0];
	const dy = y - lake.center[1];
	const u = (dx * c + dy * s) / lake.halfLength;
	const v = (dy * c - dx * s) / lake.halfWidth;
	const f = u * u + v * v - 1;
	const gradient = 2 * Math.hypot(u / lake.halfLength, v / lake.halfWidth);
	return f / Math.max(gradient, 2 / Math.max(lake.halfLength, lake.halfWidth));
}
