import { tensionPatch } from '../membrane';
import type { Membrane } from '../membrane';
import type { HouseEnvelope } from '../house-typology';
import type { Vec3 } from '../parametrik/types';

type Frame = NonNullable<HouseEnvelope['frame']>;
type Triangle = [Vec3, Vec3, Vec3];
type Quad = [Vec3, Vec3, Vec3, Vec3];
type Rod = [Vec3, Vec3];
type Bay = { rods: Rod[]; sails: (Triangle | Quad)[] };

// Coordinates describe a bay in its survey plane. Depth runs from the inner frame to the parcel.
function carrier(frame: Frame): Bay {
	const p = (u: number, d: number, h: number): Vec3 => [u, d, h];
	const foot = p(0.5, 0, 0),
		shoulder = p(0.5, 0, 0.48),
		tip = p(0.5, 0.9, 1);
	const l = p(0.04, 0.2, 0),
		r = p(0.96, 0.2, 0);
	const a = p(0.03, 0.95, 0.76),
		b = p(0.97, 0.85, 0.84);
	const c = p(0.03, 0.2, 0.42),
		d = p(0.97, 0.2, 0.48);
	switch (frame) {
		case 'mast':
			return {
				rods: [
					[foot, tip],
					[l, a],
					[r, b]
				],
				sails: [
					[l, tip, a],
					[tip, r, b],
					[l, r, tip]
				]
			};
		case 'fan-truss':
			return {
				rods: [
					[foot, shoulder],
					[shoulder, a],
					[shoulder, tip],
					[shoulder, b],
					[a, tip],
					[tip, b]
				],
				sails: [
					[a, tip, shoulder],
					[shoulder, tip, b],
					[l, shoulder, a],
					[shoulder, r, b]
				]
			};
		case 'scissor':
			return {
				rods: [
					[l, b],
					[r, a],
					[a, tip],
					[b, tip]
				],
				sails: [
					[l, r, b, a],
					[a, b, tip]
				]
			};
		case 'ring':
			return {
				rods: [
					[l, a],
					[r, b],
					[a, b],
					[l, r]
				],
				sails: [
					[l, p(0.54, 0.2, 0), b],
					[p(0.46, 0.2, 0), r, a]
				]
			};
		case 'outrigger':
			return {
				rods: [
					[l, c],
					[c, a],
					[r, d],
					[d, b],
					[a, tip],
					[b, tip],
					[c, d],
					[c, p(0.04, 0.98, 0.5)],
					[d, p(0.96, 0.94, 0.55)]
				],
				sails: [
					[l, r, p(0.96, 0.94, 0.55), p(0.04, 0.98, 0.5)],
					[c, d, b, a],
					[a, b, tip]
				]
			};
	}
}

type Place = (u: number, depth: number, height: number) => Vec3;

/** Fits the frame and each independently tensioned sail to the same surveyed bay and fittings. */
export function textileBay(
	frame: Frame,
	fabric: Membrane,
	place: Place,
	confine: (point: Vec3) => Vec3
) {
	const bay = carrier(frame);
	const world = ([x, y, z]: Vec3) => place(x, y, z);
	const points: Vec3[] = [],
		triangles: number[] = [];
	for (const grips of bay.sails) {
		const fixed = grips.map(world) as Triangle | Quad;
		const patch = tensionPatch(fixed, fabric, frame === 'ring' ? 72 : 40);
		const base = points.length;
		points.push(...patch.positions.map(confine));
		triangles.push(...patch.faces.map((i) => i + base));
	}
	return { points, triangles, rods: bay.rods.map(([a, b]): Rod => [world(a), world(b)]) };
}
