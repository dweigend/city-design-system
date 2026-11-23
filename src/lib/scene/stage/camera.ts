import {
	crossProduct,
	dotProduct,
	displacement,
	interpolation,
	scaled,
	sum,
	unitVector,
	type Bounds3,
	type Vec2,
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
 * multiplier about the fitted center (default 1). Focus frames a subset of the scene in meters. */
export type ViewFit = Readonly<{
	bearing?: number;
	elevation?: number;
	fill?: number;
	zoom?: number;
	width?: number;
	offset?: Vec2;
	focus?: Bounds3;
	subject?: ProjectedFocus;
}>;

type ProjectedFocus = Readonly<{
	center: Vec3;
	halfWidth: number;
	halfHeight: number;
}>;

function axes(view: View, fit: ViewFit) {
	const { eye, up } = readView(view);
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
	return { direction, right, imageUp, up };
}

/** Measures a subject in the image plane once for the supplied view and camera angles. */
export function projectFocus(
	view: View,
	fit: ViewFit,
	points: Iterable<Vec3>
): ProjectedFocus | undefined {
	const { direction, right, imageUp } = axes(view, fit);
	let x0 = Infinity,
		x1 = -Infinity,
		y0 = Infinity,
		y1 = -Infinity,
		z0 = Infinity,
		z1 = -Infinity;
	for (const point of points) {
		const x = dotProduct(point, right);
		const y = dotProduct(point, imageUp);
		const z = dotProduct(point, direction);
		x0 = Math.min(x, x0);
		x1 = Math.max(x, x1);
		y0 = Math.min(y, y0);
		y1 = Math.max(y, y1);
		z0 = Math.min(z, z0);
		z1 = Math.max(z, z1);
	}
	if (x0 === Infinity) return undefined;
	return {
		center: sum(
			sum(scaled(right, (x0 + x1) / 2), scaled(imageUp, (y0 + y1) / 2)),
			scaled(direction, (z0 + z1) / 2)
		),
		halfWidth: (x1 - x0) / 2,
		halfHeight: (y1 - y0) / 2
	};
}

export function fitCamera(
	view: View,
	bounds: Bounds3,
	aspect: number,
	landscape = false,
	fit: ViewFit = {},
	clippingBounds = bounds
) {
	const { fill, shadowFit } = readView(view);
	const { direction, right, imageUp, up } = axes(view, fit);

	const frame = fit.focus ?? bounds;
	const half = scaled(displacement(frame.min, frame.max), 0.5);
	const extent = (axis: Vec3) =>
		dotProduct(half, [Math.abs(axis[0]), Math.abs(axis[1]), Math.abs(axis[2])]);
	const shift = scaled(
		[-sun[0], -sun[1], 0],
		!fit.focus && !fit.subject && (shadowFit || landscape) ? half[2] * shadowReach : 0
	);
	const offset = fit.offset ?? [0, 0];
	const pan = sum(scaled(right, offset[0]), scaled(imageUp, offset[1]));
	const center = sum(
		sum(fit.subject?.center ?? interpolation(frame.min, frame.max, 0.5), shift),
		pan
	);
	const subjectHeight = fit.subject?.halfHeight ?? extent(imageUp);
	const subjectWidth = fit.subject?.halfWidth ?? extent(right);
	const objectFit = Math.max(subjectHeight, subjectWidth / aspect, 0.05) / (fit.fill ?? fill);
	const shadowFitHeight =
		Math.max(
			subjectHeight + Math.abs(dotProduct(shift, imageUp)),
			(subjectWidth + Math.abs(dotProduct(shift, right))) / aspect
		) / (landscape ? (fit.fill ?? 0.9) : 0.9);
	const halfHeight =
		(fit.width === undefined ? Math.max(objectFit, shadowFitHeight) : fit.width / (2 * aspect)) /
		(fit.zoom ?? 1);
	const sceneHalf = scaled(displacement(clippingBounds.min, clippingBounds.max), 0.5);
	const depth = dotProduct(sceneHalf, [
		Math.abs(direction[0]),
		Math.abs(direction[1]),
		Math.abs(direction[2])
	]);
	const sceneCenter = interpolation(clippingBounds.min, clippingBounds.max, 0.5);
	const depthShift = dotProduct(displacement(center, sceneCenter), direction);
	const depthMarginM = Math.max(1, half[2] * 1.2, depth * 0.01);
	return {
		center,
		eye: sum(center, scaled(direction, depth + depthShift + depthMarginM)),
		up,
		halfWidth: halfHeight * aspect,
		halfHeight,
		near: depthMarginM / 2,
		far: 2 * depth + 2 * depthMarginM
	};
}
