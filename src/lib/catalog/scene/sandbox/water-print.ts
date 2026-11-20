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
	const time = seconds.mul(0.045);
	const drift = chart.x.mul(0.032).add(time).sin();
	const across = chart.y.mul(0.058).add(drift.mul(1.8)).add(bend.mul(0.22)).sin();
	const along = chart.x.mul(0.047).add(chart.y.mul(0.026)).sub(time).sin();
	const sky = across.mul(along).mul(0.5).add(0.5);
	const pool = attribute('poolDepth', 'float').smoothstep(0, 1.1);
	const depth = mix(wash, blue, bank.smoothstep(0, 15).mul(0.28).max(pool.mul(0.68)));
	return mix(depth, paper, sky.mul(0.105));
}
