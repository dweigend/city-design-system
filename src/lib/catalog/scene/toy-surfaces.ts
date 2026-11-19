import type { Node } from 'three/webgpu';
import { mix, mx_noise_float, normalWorldGeometry, positionWorld, vec3 } from 'three/tsl';
import type { Muster } from './materialMuster';

// Use the nearest face plane on curved shells as well as unwrapped sheet stock.
function sheetCoordinates(p: Node<'vec3'>) {
	const n = normalWorldGeometry.abs();
	return n.y.greaterThanEqual(n.x.max(n.z)).select(p.xz, n.x.greaterThan(n.z).select(p.zy, p.xy));
}

/** Open circular punches, 0.6 m across on a 1.25 m grid. */
export function perforatedSheet() {
	const tile = sheetCoordinates(positionWorld).div(1.25).fract().sub(0.5);
	return tile.length().greaterThanEqual(0.3 / 1.25);
}

/** A half-metre corrugation with 95 mm crest-to-trough relief. */
export function corrugation(base: Node<'vec3'>, p: Node<'vec3'>): Muster {
	const phase = sheetCoordinates(p).x.mul(4 * Math.PI);
	const resolved = phase.fwidth().smoothstep(1, Math.PI).oneMinus();
	const ridge = phase.cos().mul(resolved);
	return { farbe: base, hoehe: ridge, relief: 0.0475, rauheitVersatz: ridge.mul(-0.045) };
}

/** Two crossing layers of pressed timber flakes in a continuous metre-scale volume. */
export function pressedFlakes(base: Node<'vec3'>, p: Node<'vec3'>): Muster {
	const first = mx_noise_float(p.mul(vec3(1.75, 9, 5))).smoothstep(-0.1, 0.22);
	const rotated = vec3(p.x.add(p.z).mul(0.707), p.y, p.z.sub(p.x).mul(0.707));
	const second = mx_noise_float(rotated.mul(vec3(7, 3, 1.5))).smoothstep(0.04, 0.24);
	const chip = mix(first.mul(0.55), second, second.mul(0.72));
	return { farbe: base.mul(chip.mul(0.8).add(0.65)), hoehe: chip, relief: 0.004 };
}
