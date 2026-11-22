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

// Quarry BLICK, converted from its Y-up projection to world coordinates.
const bearingRad = (32 * Math.PI) / 180;
const elevationRad = (26 * Math.PI) / 180;
const margin = 1.22;
const depthMarginM = 1;

export const views = {
	iso: {
		eye: [
			Math.sin(bearingRad) * Math.cos(elevationRad),
			-Math.cos(bearingRad) * Math.cos(elevationRad),
			Math.sin(elevationRad)
		],
		up: [0, 0, 1]
	},
	plan: { eye: [0, 0, 1], up: [0, 1, 0] }
} satisfies Record<string, { eye: Vec3; up: Vec3 }>;

export type View = keyof typeof views;

export function readView(view: View) {
	if (!Object.hasOwn(views, view)) throw new RangeError(`Unknown stage view "${view}"`);
	return views[view];
}

export function fitCamera(view: View, bounds: Bounds3, aspect: number) {
	const { eye, up } = readView(view);
	const right = unitVector(crossProduct(up, eye));
	const imageUp = crossProduct(eye, right);
	const center = interpolation(bounds.min, bounds.max, 0.5);
	const half = scaled(displacement(bounds.min, bounds.max), 0.5);
	const extent = (axis: Vec3) =>
		dotProduct(half, [Math.abs(axis[0]), Math.abs(axis[1]), Math.abs(axis[2])]);
	const halfHeight = Math.max(extent(imageUp), extent(right) / aspect, 0.05) * margin;
	const depth = extent(eye);
	return {
		center,
		eye: sum(center, scaled(eye, depth + depthMarginM)),
		up,
		halfWidth: halfHeight * aspect,
		halfHeight,
		near: depthMarginM / 2,
		far: 2 * depth + 2 * depthMarginM
	};
}
