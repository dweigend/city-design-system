import {
	crossProduct,
	dotProduct,
	displacement,
	interpolation,
	scaled,
	sum,
	unitVector,
	type Bounds3,
	type Vec3
} from '../../core/geometry';
import { shadowReach, sun } from './tone';

// Quarry BLICK, converted from its Y-up projection to world coordinates.
const bearingRad = (32 * Math.PI) / 180;
const elevationRad = (26 * Math.PI) / 180;

export const views = {
	iso: {
		eye: [
			Math.sin(bearingRad) * Math.cos(elevationRad),
			-Math.cos(bearingRad) * Math.cos(elevationRad),
			Math.sin(elevationRad)
		],
		up: [0, 0, 1],
		fill: 0.7,
		shadowFit: false
	},
	plan: { eye: [0, 0, 1], up: [0, 1, 0], fill: 0.63, shadowFit: true }
} satisfies Record<string, { eye: Vec3; up: Vec3; fill: number; shadowFit: boolean }>;

export type View = keyof typeof views;

export function readView(view: View) {
	if (!Object.hasOwn(views, view)) throw new RangeError(`Unknown stage view "${view}"`);
	return views[view];
}

/** Optional orthographic fit with angles in radians, a fill fraction, and a positive zoom
 * multiplier about the fitted center (default 1). */
export type ViewFit = Readonly<{
	bearing?: number;
	elevation?: number;
	fill?: number;
	zoom?: number;
}>;

export function fitCamera(
	view: View,
	bounds: Bounds3,
	aspect: number,
	landscape = false,
	fit: ViewFit = {}
) {
	const { eye, up, fill, shadowFit } = readView(view);
	const elevation = fit.elevation ?? elevationRad;
	const bearing = fit.bearing ?? bearingRad;
	const direction: Vec3 =
		view === 'iso'
			? [
					Math.sin(bearing) * Math.cos(elevation),
					-Math.cos(bearing) * Math.cos(elevation),
					Math.sin(elevation)
				]
			: eye;
	const right = unitVector(crossProduct(up, direction));
	const imageUp = crossProduct(direction, right);

	const half = scaled(displacement(bounds.min, bounds.max), 0.5);
	const extent = (axis: Vec3) =>
		dotProduct(half, [Math.abs(axis[0]), Math.abs(axis[1]), Math.abs(axis[2])]);
	const shift = scaled([-sun[0], -sun[1], 0], shadowFit || landscape ? half[2] * shadowReach : 0);
	const center = sum(interpolation(bounds.min, bounds.max, 0.5), shift);
	const objectFit = Math.max(extent(imageUp), extent(right) / aspect, 0.05) / (fit.fill ?? fill);
	const shadowFitHeight =
		Math.max(
			extent(imageUp) + Math.abs(dotProduct(shift, imageUp)),
			(extent(right) + Math.abs(dotProduct(shift, right))) / aspect
		) / (landscape ? (fit.fill ?? 0.9) : 0.9);
	const halfHeight = Math.max(objectFit, shadowFitHeight) / (fit.zoom ?? 1);
	const depth = extent(direction);
	const depthMarginM = Math.max(1, half[2] * 1.2, depth * 0.01);
	return {
		center,
		eye: sum(center, scaled(direction, depth + depthMarginM)),
		up,
		halfWidth: halfHeight * aspect,
		halfHeight,
		near: depthMarginM / 2,
		far: 2 * depth + 2 * depthMarginM
	};
}
