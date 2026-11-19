import { attribute, float } from 'three/tsl';
import type { Node } from 'three/webgpu';

/** Tapered cuts through the water wash. Columns run along the surveyed valley. */
export function currentMarks(seconds: Node<'float'>) {
	const chart = attribute('chart', 'vec2');
	const along = chart.x.sub(seconds.mul(0.32));
	const stream = chart.y.mul(2.4).add(along.mul(0.67).add(chart.y).sin().mul(0.17));
	const lane = stream.floor();
	const advance = along.mul(0.39).add(lane.mul(2.39996).sin().mul(2.1));
	const taper = advance.fract().mul(Math.PI).sin().smoothstep(0.28, 0.91);
	const width = stream.fwidth().max(0.0001);
	const distance = stream.fract().sub(0.5).abs().div(width);
	const mark = float(1).sub(distance.smoothstep(0, taper.mul(0.9).add(0.45)));
	return mark.mul(taper).mul(float(1).sub(width.smoothstep(0.23, 0.55)));
}
