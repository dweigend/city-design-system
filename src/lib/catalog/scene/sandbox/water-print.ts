import { attribute, float, mix } from 'three/tsl';
import type { Node } from 'three/webgpu';

/** A tapered travelling dash, shared by the river engraving and service conduits. */
export function travellingDash(distanceM: Node<'float'>, seconds: Node<'float'>) {
	return distanceM
		.mul(0.17)
		.sub(seconds.mul(0.36))
		.fract()
		.mul(Math.PI)
		.sin()
		.smoothstep(0.44, 0.92);
}

/** A smooth valley coordinate carries bank-side marks through grid turns and dug basins.
 * A surveyed pier bends the field within its wake, on its downstream side only. */
export function riverInk(
	seconds: Node<'float'>,
	wash: Node<'color'>,
	paper: Node<'vec3'>,
	blue: Node<'color'>
) {
	const chart = attribute('chart', 'vec2'),
		swirl = attribute('wake', 'float'),
		widthM = attribute('riverWidth', 'float');
	const along = chart.x,
		across = chart.y;
	const field = across.mul(0.29).add(along.mul(0.042).sin().mul(0.23)).add(swirl.mul(0.6));
	const lane = field.floor();
	const advance = along.add(lane.mul(2.39996).sin().mul(13));
	const taper = travellingDash(advance, seconds);
	const feather = field.fwidth().max(0.001);
	const line = float(1).sub(
		field.fract().sub(0.5).abs().div(feather).smoothstep(0, taper.mul(0.8).add(0.4))
	);
	const bank = across.negate().min(across.add(widthM)).max(0);
	const sparse = float(1)
		.sub(bank.smoothstep(2, 22))
		.max(swirl.abs())
		.max(float(lane.mod(3).equal(0)).mul(0.35));
	const coverage = line
		.mul(taper)
		.mul(sparse)
		.mul(float(1).sub(feather.smoothstep(0.22, 0.54)));
	return mix(wash, mix(paper, blue, float(lane.mod(5).equal(0))), coverage);
}
