import { Color, DoubleSide, MeshBasicNodeMaterial } from 'three/webgpu';
import {
	abs,
	attribute,
	color,
	dot,
	float,
	floor,
	fract,
	mix,
	normalView,
	normalWorld,
	sin,
	step,
	vec2,
	vec3
} from 'three/tsl';
import type { Palette3D } from '../../data/city3d';
import type { ColorToken } from '../../logic/parametrik/types';
import { tokenColor } from '../material';

// Coordinates are attached before batching. XYZ is metres above the part's minimum;
// W is its fraction of height. Crossing a face or UV seam never restarts the dip.
const chart = attribute('finishChart', 'vec4');
const plane = vec2(
	chart.x.add(chart.z.mul(0.39)),
	chart.z.sub(chart.x.mul(0.27)).add(chart.y.mul(0.81))
);
const wave = sin(chart.x.mul(2.2).add(chart.z.mul(1.7))).mul(0.055);
const drip = sin(chart.x.mul(4.2).sub(chart.z.mul(2.6)))
	.mul(0.5)
	.add(0.5)
	.pow(8)
	.mul(0.19);
const dip = chart.w.sub(float(0.43).add(wave).sub(drip));
const shadow = step(dot(normalWorld, vec3(-0.46, 0.78, 0.43)), 0.31);

function coarseChips() {
	// One candidate per 0.86 m cell. Its angular section spans 0.20–0.40 m.
	const cell = floor(plane.div(0.86));
	const random = fract(sin(dot(cell, vec2(127.1, 311.7))).mul(43758.5453));
	const p = fract(plane.div(0.86))
		.sub(vec2(random.mul(0.32).add(0.34), fract(random.mul(13.7)).mul(0.38).add(0.31)))
		.mul(0.86);
	const angle = random.mul(6.28318);
	const x = p.x.mul(angle.cos()).add(p.y.mul(angle.sin()));
	const y = p.y.mul(angle.cos()).sub(p.x.mul(angle.sin()));
	const radius = random.mul(0.1).add(0.1);
	const chip = step(abs(x).add(abs(y.add(x.mul(0.43))).mul(1.45)), radius);
	return { chip, pale: step(0.46, fract(random.mul(7.1))) };
}

/** Builds an opaque sandbox print in the selected flow pigment. Close views resolve
 * aggregate and screen dots in metres. Distant views use the same cap with flat shadow ink. */
export function printedFinish(
	aggregate: boolean,
	token: ColorToken,
	palette: Palette3D,
	close: boolean
) {
	const ink = color(new Color(palette.ink)),
		paper = color(new Color(palette.paper));
	const pigment = color(tokenColor(palette, token));
	const base = aggregate ? mix(paper, pigment, 0.58) : paper;
	let result = base;
	if (aggregate && close) {
		const { chip, pale } = coarseChips();
		result = mix(base, mix(mix(base, ink, 0.48), paper, pale), chip);
	} else if (!aggregate) {
		result = mix(paper, pigment, step(0, dip));
		result = mix(result, ink, step(abs(dip), 0.009).mul(0.65));
	}
	let shading = shadow.mul(0.18);
	if (close) {
		const dotField = fract(plane.mul(12)).sub(0.5).length();
		shading = shadow.mul(step(dotField, 0.22)).mul(0.55);
	}
	result = mix(result, ink, shading);
	const material = new MeshBasicNodeMaterial({ side: DoubleSide });
	material.colorNode = mix(result, ink, step(abs(normalView.z), 0.055).mul(0.76));
	return material;
}
