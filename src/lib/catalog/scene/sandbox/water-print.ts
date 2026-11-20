import { attribute, mix } from 'three/tsl';
import type { Node } from 'three/webgpu';

/** Shared world-metre phase for river marks and hard-edged conduit strokes. */
export function flowPhase(distanceM: Node<'float'>, seconds: Node<'float'>) {
	return distanceM.mul(0.17).sub(seconds.mul(0.36)).fract();
}

/** Broad sky reflections follow continuous metre coordinates and soften toward the shallow banks. */
export function riverInk(
	seconds: Node<'float'>,
	wash: Node<'color'>,
	paper: Node<'vec3'>,
	blue: Node<'color'>
) {
	const chart = attribute('chart', 'vec2'),
		bend = attribute('wake', 'float');
	const width = attribute('riverWidth', 'float');
	const bank = chart.y.negate().min(chart.y.add(width)).max(0);
	const drift = chart.x.mul(0.046).add(seconds.mul(0.075)).sin();
	const reflection = chart.y.mul(0.19).add(drift).add(bend.mul(0.22)).sin().mul(0.5).add(0.5);
	const depth = mix(wash, blue, bank.smoothstep(0, 15).mul(0.28));
	return mix(depth, paper, reflection.smoothstep(0.28, 0.91).mul(0.14));
}
