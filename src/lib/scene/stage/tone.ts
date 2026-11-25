import { defaults } from '../../../config/stage';
import { hash, uniform, screenCoordinate, screenDPR, vec3 } from 'three/tsl';
import { Color, type Node } from 'three/webgpu';
import type { Vec3 } from '../../core/geometry';

export function drawingPalette() {
	return {
		dark: uniform(/* Exact arithmetic: zero initially disables the palette adjustment. */ 0),
		hull: uniform(/* Exact arithmetic: zero initially disables the palette adjustment. */ 0),
		ink: uniform(new Color())
	};
}

export const sun = defaults.stageSunXY;
/** A level roof whose normal leans less than this toward the sun still reads as lit from above. */
export const flatTolerance = defaults.stageFlatFacingTolerance;
export const shadowReach = defaults.stageShadowReachPerM;
export const shadowDirection = Object.freeze([-sun[0], -sun[1]] as const);

/** Direction of the stage light in world axes, per meter of descent. */
// Exact arithmetic: light descends one meter per meter of shadow reach.
export const surfaceLight = Object.freeze([
	shadowDirection[0] * shadowReach,
	shadowDirection[1] * shadowReach,
	/* Exact arithmetic: light descends one unit along Z. */ -1
] as const);
export const levels = {
	top: defaults.stageFaceLightness[0],
	lit: defaults.stageFaceLightness[1],
	shadow: defaults.stageFaceLightness[2]
};
export const grain = {
	top: defaults.stageFaceGrain[0],
	lit: defaults.stageFaceGrain[1],
	shadow: defaults.stageFaceGrain[2]
};

// Linear sRGB and Oklab conversion matrices by Björn Ottosson, in row order.
function transform(value: Node<'vec3'>, [x, y, z]: readonly [Vec3, Vec3, Vec3]) {
	return vec3(value.dot(vec3(...x)), value.dot(vec3(...y)), value.dot(vec3(...z)));
}

export function graphite(rgb: Node<'vec3'>, offset: Node<'float'>, pressure: Node<'float'>) {
	const pixel = screenCoordinate.div(screenDPR).floor();
	const sample = hash(pixel.x.add(pixel.y.mul(defaults.stageGraphiteHashStride))).sub(
		/* Exact arithmetic: center unit hash output around zero. */ 0.5
	);
	const roots = transform(
		rgb,
		/* Exact arithmetic: published linear sRGB to LMS matrix. */ [
			[0.41222147, 0.53633254, 0.05144599],
			[0.2119035, 0.68069955, 0.10739696],
			[0.08830246, 0.28171884, 0.6299787]
		]
	)
		.max(vec3(/* Exact arithmetic: minimum normalized channel. */ 0))
		.pow(vec3(/* Exact arithmetic: cube root exponent. */ 1 / 3));
	const lab = transform(
		roots,
		/* Exact arithmetic: published LMS cube root to Oklab matrix. */ [
			[0.21045426, 0.79361779, -0.00407205],
			[1.9779985, -2.42859221, 0.45059371],
			[0.02590404, 0.78277177, -0.80867577]
		]
	);
	const light = lab.x
		.add(offset)
		.clamp(
			/* Exact arithmetic: minimum lightness. */ 0,
			/* Exact arithmetic: maximum lightness. */ 1
		)
		.mul(sample.mul(pressure).add(/* Exact arithmetic: unit factor is neutral pressure. */ 1));
	const lms = transform(
		vec3(light, lab.yz),
		/* Exact arithmetic: published Oklab to LMS cube root matrix. */ [
			[1, 0.39633778, 0.21580376],
			[1, -0.10556135, -0.06385417],
			[1, -0.08948418, -1.29148555]
		]
	);
	return transform(
		lms.mul(lms).mul(lms),
		/* Exact arithmetic: published LMS to linear sRGB matrix. */ [
			[4.07674166, -3.30771159, 0.23096993],
			[-1.268438, 2.6097574, -0.3413194],
			[-0.00419609, -0.70341861, 1.7076147]
		]
	).clamp(
		vec3(/* Exact arithmetic: minimum normalized channel. */ 0),
		vec3(/* Exact arithmetic: maximum normalized channel. */ 1)
	);
}
