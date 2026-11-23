import { hash, uniform, screenCoordinate, screenDPR, vec3 } from 'three/tsl';
import { Color, type Node } from 'three/webgpu';
import type { Vec3 } from '../../core/geometry';

export function drawingPalette() {
	return {
		dark: uniform(0),
		hull: uniform(0),
		ink: uniform(new Color())
	};
}

export const sun = [-0.6, -0.8] as const;
/** A level roof whose normal leans less than this toward the sun still reads as lit from above. */
export const flatTolerance = 1e-3;
export const shadowReach = 0.6;
export const shadowDirection = Object.freeze([-sun[0], -sun[1]] as const);
export const levels = { top: 0.028, lit: -0.055, shadow: -0.145 };
export const grain = { top: 0.014, lit: 0.008, shadow: 0.026 };

// Linear sRGB and Oklab conversion matrices by Björn Ottosson, in row order.
function transform(value: Node<'vec3'>, [x, y, z]: readonly [Vec3, Vec3, Vec3]) {
	return vec3(value.dot(vec3(...x)), value.dot(vec3(...y)), value.dot(vec3(...z)));
}

export function graphite(rgb: Node<'vec3'>, offset: Node<'float'>, pressure: Node<'float'>) {
	const pixel = screenCoordinate.div(screenDPR).floor();
	const sample = hash(pixel.x.add(pixel.y.mul(4093))).sub(0.5);
	const roots = transform(rgb, [
		[0.41222147, 0.53633254, 0.05144599],
		[0.2119035, 0.68069955, 0.10739696],
		[0.08830246, 0.28171884, 0.6299787]
	])
		.max(vec3(0))
		.pow(vec3(1 / 3));
	const lab = transform(roots, [
		[0.21045426, 0.79361779, -0.00407205],
		[1.9779985, -2.42859221, 0.45059371],
		[0.02590404, 0.78277177, -0.80867577]
	]);
	const light = lab.x.add(offset).clamp(0, 1).mul(sample.mul(pressure).add(1));
	const lms = transform(vec3(light, lab.yz), [
		[1, 0.39633778, 0.21580376],
		[1, -0.10556135, -0.06385417],
		[1, -0.08948418, -1.29148555]
	]);
	return transform(lms.mul(lms).mul(lms), [
		[4.07674166, -3.30771159, 0.23096993],
		[-1.268438, 2.6097574, -0.3413194],
		[-0.00419609, -0.70341861, 1.7076147]
	]).clamp(vec3(0), vec3(1));
}
