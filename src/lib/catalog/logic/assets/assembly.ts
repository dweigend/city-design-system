import type { AssetCategory, AssetRecipe, Attachment } from './definition';
import { mount } from './definition';
import { drum, slab, surface, white } from './parts';
import type { ColorToken, Primitive, Vec3 } from '../parametrik/types';

/** Defines three dimensional settings and a small seeded tolerance on the tuned dimension. */
export function family(category: AssetCategory, attachment: Attachment) {
	return (
		id: string,
		footprint: [number, number],
		draw: (factor: number, variant: number) => Primitive[]
	): AssetRecipe => ({
		id,
		category,
		footprint,
		anchors: [mount(attachment)],
		variants: ['compact', 'standard', 'extended'],
		draw: (variant, sample) => draw(0.72 + variant * 0.12 + sample * 0.04, variant)
	});
}

/** Rectangular solid centred in plan, resting on z. */
export function block(
	x: number,
	y: number,
	z: number,
	w: number,
	d: number,
	h: number,
	token: ColorToken = white
) {
	return slab([x - w / 2, y - d / 2, z], [w, d, h], token);
}

/** Four columns inset from the specified corner axes. */
export function legs(x: number, y: number, h: number, r = 0.12) {
	return [-x, x].flatMap((a) => [-y, y].map((b) => drum([a, b, 0], r, h)));
}

/** Repeats a detail in stable left-to-right order; t spans −1 to 1. */
export function row(count: number, draw: (t: number, i: number) => Primitive) {
	return Array.from({ length: count }, (_, i) => draw((2 * i) / (count - 1) - 1, i));
}

/** Extrudes a footprint, optionally around one courtyard. */
export function plate(
	polygon: [number, number][],
	z: number,
	height: number,
	token: ColorToken = white,
	hole?: [number, number][]
): Primitive {
	return {
		...surface(token),
		kind: 'prism',
		polygon,
		z,
		height,
		...(hole ? { holes: [hole] } : {})
	};
}

/** Returns equally spaced points on a horizontal circle. */
export function circle(radius: number, count = 32): [number, number][] {
	return Array.from({ length: count }, (_, i) => [
		radius * Math.cos((2 * Math.PI * i) / count),
		radius * Math.sin((2 * Math.PI * i) / count)
	]);
}

/** Extruded circular sector with two radial ends. */
export function crescent(
	outer: number,
	inner: number,
	z: number,
	h: number,
	angle: number,
	token: ColorToken = white
) {
	const edge = (r: number) =>
		Array.from({ length: 33 }, (_, i): [number, number] => [
			r * Math.cos((angle * i) / 32),
			r * Math.sin((angle * i) / 32)
		]);
	return plate([...edge(outer), ...edge(inner).reverse()], z, h, token);
}

/** Space frame with outer members set above the mounting plane. */
export function cage(
	x: number,
	y: number,
	z: number,
	w: number,
	d: number,
	h: number,
	cells: Vec3,
	braced = true
): Primitive {
	return {
		...surface(),
		kind: 'frame',
		position: [x - w / 2, y - d / 2, z + 0.08],
		size: [w, d, h],
		cells,
		bar: 0.12,
		braced
	};
}

/** Arched cross section across x with a clear opening along y. */
export function shell(
	kind: 'arch' | 'vault' | 'halfpipe',
	x: number,
	y: number,
	z: number,
	width: number,
	length: number,
	rise: number,
	thickness: number,
	token: ColorToken = white
): Primitive {
	return { ...surface(token), kind, position: [x, y, z], width, length, rise, thickness };
}

/** Mono-pitched roof or ramp running down the x axis. */
export function slope(
	x: number,
	y: number,
	z: number,
	w: number,
	d: number,
	h: number,
	rotation = 0,
	token: ColorToken = white
): Primitive {
	return {
		...surface(token),
		kind: 'wedge',
		position: [x - w / 2, y - d / 2, z],
		size: [w, d, h],
		low: 0.04,
		rotation
	};
}

/** Continuous pipe through a series of centre-line points. */
export function pipe(points: Vec3[], radius: number, token: ColorToken = white): Primitive {
	return { ...surface(token), kind: 'pipe', points, radius };
}
