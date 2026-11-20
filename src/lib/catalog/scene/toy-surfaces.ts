import type { Node } from 'three/webgpu';
import {
	normalViewGeometry,
	positionViewDirection,
	mx_noise_float,
	positionWorld,
	vec3
} from 'three/tsl';
import { grainVisibility, townPattern } from './pattern-density';
import type { Muster } from './materialMuster';

/** Open circular punches, 0.6 m across on a 1.25 m grid. */
export function perforatedSheet() {
	const distance = townPattern(
		positionWorld,
		1.25,
		(uv) => uv.add(0.5).fract().sub(0.5).length(),
		'grid'
	);
	return distance.greaterThanEqual(0.3 / 1.25);
}

/** A half-metre corrugation with 95 mm crest-to-trough relief. */
export function corrugation(base: Node<'vec3'>, p: Node<'vec3'>): Muster {
	const ridge = townPattern(
		p,
		0.5,
		(uv) => uv.x.fract().sub(0.5).abs().sub(0.12).mul(8).clamp(0, 2).sub(1),
		'grid'
	);
	return { farbe: base.mul(ridge.mul(0.21).add(0.92)), hoehe: ridge, relief: 0.0475 };
}

/** Crossed 65 × 24 mm flakes. Unresolved faces return to the pressed binder colour. */
export function pressedFlakes(base: Node<'vec3'>, p: Node<'vec3'>): Muster {
	const pitch = vec3(0.065, 0.024, 0.024);
	const layer = (point: Node<'vec3'>) => {
		const chart = point.div(pitch);
		const height = mx_noise_float(chart).smoothstep(0.04, 0.28);
		return { height, tint: height.mul(grainVisibility(chart)) };
	};
	const bias = vec3(p.x.add(p.z), p.y.mul(Math.SQRT2), p.z.sub(p.x)).mul(Math.SQRT1_2);
	const first = layer(p),
		second = layer(bias);
	return {
		farbe: base.mul(first.tint.sub(second.tint).mul(0.065).add(1)),
		hoehe: first.height.sub(second.height),
		relief: 0.00023
	};
}

/** The frosted shell catches grazing light around its lightly tinted transmitting face. */
export function frostedAcrylic(base: Node<'vec3'>, p: Node<'vec3'>): Muster {
	const rim = normalViewGeometry.dot(positionViewDirection).abs().oneMinus().pow(2);
	const flute = townPattern(p, 0.045, (uv) => uv.x.mul(2 * Math.PI).cos(), 'fixed');
	return { farbe: base.mul(rim.mul(0.075).add(1)), hoehe: flute, relief: 0.00032 };
}
