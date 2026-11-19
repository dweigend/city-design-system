import { Color, DoubleSide, MeshBasicNodeMaterial } from 'three/webgpu';
import {
	atan,
	abs,
	attribute,
	color,
	dot,
	float,
	mix,
	normalView,
	normalWorld,
	positionLocal,
	positionWorld,
	select,
	sin,
	step,
	vec2,
	vec3
} from 'three/tsl';
import type { Palette3D } from '../data/city3d';
import type { ColorToken } from '../logic/parametrik/types';
import { LICHT, MASSSTAB } from '../data/leitstil';

import type { Node } from 'three/webgpu';
import { tokenColor } from './material';

// Coordinates are attached before batching. XYZ is metres above the part's minimum;
// W is its fraction of height. Crossing a face or UV seam never restarts the dip.
const chart = attribute('finishChart', 'vec4');
function printPlane(p: Node<'vec3'>) {
	return vec2(p.x.add(p.z.mul(0.39)), p.z.sub(p.x.mul(0.27)).add(p.y.mul(0.81)));
}
const plane = printPlane(chart.xyz);
const wave = sin(chart.x.mul(2.2).add(chart.z.mul(1.7))).mul(0.055);
const drip = sin(chart.x.mul(4.2).sub(chart.z.mul(2.6)))
	.mul(0.5)
	.add(0.5)
	.pow(8)
	.mul(0.19);
const dip = chart.w.sub(float(0.43).add(wave).sub(drip));
const sun = vec3(-LICHT[0], -LICHT[2], LICHT[1]).normalize();
const shadow = step(dot(normalWorld, sun), 0.31);

/** Detached 45 degree screen settings in radians and meters for the requested drawing distance. */
export function halftoneScreen(close: boolean) {
	const pitch = close ? 0.5 : 1.5;
	return { angle: Math.PI / 4, pitch, radius: 0.36 * pitch };
}

/** Hard-edged dot mask on the supplied meter chart, where pitch is in meters. */
export function halftoneDots(chart: Node<'vec2'>, pitch: number | Node<'float'>) {
	const { angle, radius, pitch: reference } = halftoneScreen(false);
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	const screen = vec2(chart.x.mul(c).sub(chart.y.mul(s)), chart.x.mul(s).add(chart.y.mul(c)));
	return step(screen.div(pitch).fract().sub(0.5).length(), radius / reference);
}

/** Ground uses world xz and vertical facades use the dominant horizontal axis and height. */
export function faceHalftone(pitch: number | Node<'float'>) {
	const p = positionWorld;
	const horizontal = select(abs(normalWorld.x).greaterThan(abs(normalWorld.z)), p.z, p.x);
	const chart = select(abs(normalWorld.y).greaterThan(0.65), p.xz, vec2(horizontal, p.y));
	return shadow.mul(halftoneDots(chart, pitch));
}

/** The cast silhouette moves down-light by 35% of its nonnegative height in meters, capped at 6 m. */
export function castOffset(height: number) {
	return Math.min(0.35 * height, 6);
}

/** Angular 20–40 cm aggregate on printed panels. Reveal chips only at house scale. */
export function aggregateCoverage(plane: Node<'vec2'>) {
	const cellsPerMeter = 0.8;
	const uv = plane.mul(cellsPerMeter);
	const cell = uv.floor();
	const seed = cell.dot(vec2(0.7548777, 0.5698403)).fract();
	const noise = seed.mul(31.47).fract();
	const q = uv
		.fract()
		.sub(0.5)
		.sub(vec2(noise, seed.mul(71.63).fract()).sub(0.5).mul(0.66));
	const sides = seed.mul(3).floor().add(3),
		sector = float(2 * Math.PI).div(sides);
	const theta = atan(q.y, q.x).add(noise.mul(2 * Math.PI));
	const edge = theta.div(sector).add(0.5).fract().sub(0.5).mul(sector).cos().mul(q.length());
	const radius = seed.mul(0.1).add(0.1).mul(cellsPerMeter).mul(sector.mul(0.5).cos());
	const aa = uv.fwidth().length().mul(0.42).max(0.0001);
	const density = float(1).sub(edge.smoothstep(radius.sub(aa), radius.add(aa)));
	return { chip: density, pale: float(seed.lessThanEqual(0.51)) };
}

/** Returns the fired body colour beneath the dip in the active palette's linear colour space. */
export function firedBodyColor(palette: Palette3D, token: ColorToken) {
	return new Color(palette.paper)
		.lerp(tokenColor(palette, token), 0.36)
		.lerp(new Color(palette.ink), 0.22);
}

/** Builds an opaque sandbox print in the selected flow pigment. Close views resolve
 * aggregate. Pigmented faces use the fine, hard-edged shadow screen at every distance. */
export function printedFinish(
	id: 'glaze' | 'print-terrazzo' | 'halftone',
	token: ColorToken,
	palette: Palette3D,
	close: boolean,
	inlay?: { paper: Node<'color'>; scale: Node<'float'> }
) {
	const ink = color(new Color(palette.ink)),
		paper = color(new Color(palette.paper));
	const pigment = color(tokenColor(palette, token));
	const material = new MeshBasicNodeMaterial({ side: DoubleSide });
	const screen = shadow.mul(halftoneDots(plane, halftoneScreen(true).pitch));
	if (id === 'halftone') {
		material.colorNode = mix(pigment, ink, screen.mul(0.72));
		return material;
	}
	if (id === 'print-terrazzo') {
		const base = inlay ? attribute('color', 'vec3') : mix(paper, pigment, 0.58);
		const dark = inlay ? attribute('chipColor', 'vec3') : mix(base, ink, 0.48);
		const share = inlay
			? inlay.scale
					.smoothstep(MASSSTAB.quartier, MASSSTAB.haus)
					.mul(attribute('printScreen', 'float'))
			: float(Number(close));
		const p = inlay ? positionLocal : chart.xyz;
		const { chip, pale } = aggregateCoverage(printPlane(p));
		material.colorNode = mix(base, mix(dark, inlay?.paper ?? paper, pale), chip.mul(share));
		return material;
	}
	let result = mix(color(firedBodyColor(palette, token)), pigment, step(0, dip));
	result = mix(result, ink, step(abs(dip), 0.009).mul(0.65));
	result = mix(result, ink, screen.mul(step(0, dip)));
	material.colorNode = mix(result, ink, step(abs(normalView.z), 0.055).mul(0.76));
	return material;
}
