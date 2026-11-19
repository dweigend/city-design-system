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
	positionWorld,
	select,
	sin,
	step,
	vec2,
	vec3
} from 'three/tsl';
import type { Palette3D } from '../../data/city3d';
import type { ColorToken } from '../../logic/parametrik/types';
import { LICHT } from '../../data/leitstil';
import { isPathInk } from '../../logic/farbe/overprint';
import type { Node } from 'three/webgpu';
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

/** Returns the fired body colour beneath the dip in the active palette's linear colour space. */
export function firedBodyColor(palette: Palette3D, token: ColorToken) {
	return new Color(palette.paper)
		.lerp(tokenColor(palette, token), 0.36)
		.lerp(new Color(palette.ink), 0.22);
}

/** Builds an opaque sandbox print in the selected flow pigment. Close views resolve
 * aggregate. Pigmented faces use the fine, hard-edged shadow screen at every distance. */
export function printedFinish(
	aggregate: boolean,
	token: ColorToken,
	palette: Palette3D,
	close: boolean
) {
	const ink = color(new Color(palette.ink)),
		paper = color(new Color(palette.paper));
	const pigment = color(tokenColor(palette, token));
	const material = new MeshBasicNodeMaterial({ side: DoubleSide });
	if (isPathInk(token)) {
		material.colorNode = pigment;
		return material;
	}
	const base = aggregate ? mix(paper, pigment, 0.58) : paper;
	let result = base;
	if (aggregate && close) {
		const { chip, pale } = coarseChips();
		result = mix(base, mix(mix(base, ink, 0.48), paper, pale), chip);
	} else if (!aggregate) {
		// A fired clay body remains visible below the coloured dip, including on paper-white tiles.
		const clay = color(firedBodyColor(palette, token));
		result = mix(clay, pigment, step(0, dip));
		result = mix(result, ink, step(abs(dip), 0.009).mul(0.65));
	}
	if (token !== '--paper') {
		const inkCoverage = aggregate ? float(1) : step(0, dip);
		result = mix(result, ink, faceHalftone(halftoneScreen(true).pitch).mul(inkCoverage));
	}
	material.colorNode = mix(result, ink, step(abs(normalView.z), 0.055).mul(0.76));
	return material;
}
