import type { Node } from 'three/webgpu';
import { mix, mx_noise_float, positionWorld, vec3 } from 'three/tsl';
import { townPattern } from './pattern-density';
import type { Muster } from './materialMuster';

/** Open circular punches, 0.6 m across on a 1.25 m grid. */
export function perforatedSheet() {
	const distance = townPattern(positionWorld, 1.25, (uv) => uv.add(0.5).fract().sub(0.5).length());
	return distance.greaterThanEqual(0.3 / 1.25);
}

/** A half-metre corrugation with 95 mm crest-to-trough relief. */
export function corrugation(base: Node<'vec3'>, p: Node<'vec3'>): Muster {
	const ridge = townPattern(p, 0.5, (uv) => uv.x.mul(2 * Math.PI).cos());
	return { farbe: base.mul(ridge.mul(0.21).add(0.92)), hoehe: ridge, relief: 0.0475 };
}

/** Two crossing layers of pressed timber flakes in a continuous metre-scale volume. */
export function pressedFlakes(base: Node<'vec3'>, p: Node<'vec3'>): Muster {
	const first = mx_noise_float(p.mul(vec3(1.75, 9, 5))).smoothstep(-0.1, 0.22);
	const rotated = vec3(p.x.add(p.z).mul(0.707), p.y, p.z.sub(p.x).mul(0.707));
	const second = mx_noise_float(rotated.mul(vec3(7, 3, 1.5))).smoothstep(0.04, 0.24);
	const chip = mix(first.mul(0.55), second, second.mul(0.72));
	return { farbe: base.mul(chip.mul(0.8).add(0.65)), hoehe: chip, relief: 0.004 };
}
