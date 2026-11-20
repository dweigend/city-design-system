import type { Node } from 'three/webgpu';
import {
	normalViewGeometry,
	positionViewDirection,
	mx_noise_float,
	positionWorld,
	vec3
} from 'three/tsl';
import { faceChart, grainVisibility, townPattern } from './pattern-density';
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
	const phase = faceChart(p).x.div(0.5);
	const ridge = phase.mul(2 * Math.PI).cos();
	// Fade the physical repeat to its mean before the projected ridges become subpixel.
	const coverage = phase.fwidth().smoothstep(0.12, 0.45).oneMinus();
	return {
		farbe: base.mul(ridge.mul(coverage).mul(0.09).add(0.96)),
		hoehe: ridge,
		rauheitVersatz: ridge.mul(coverage).mul(-0.025),
		relief: 0.0475,
		reliefCoverage: coverage
	};
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
	const chart = faceChart(p).div(0.045);
	const flute = chart.x.mul(2 * Math.PI).cos();
	return {
		farbe: base.mul(rim.mul(0.075).add(1)),
		hoehe: flute,
		relief: 0.00032,
		reliefCoverage: chart.fwidth().length().smoothstep(0.16, 0.5).oneMinus()
	};
}
