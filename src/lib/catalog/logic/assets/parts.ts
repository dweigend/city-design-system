import type { ColorToken, MaterialId, Primitive, Vec3 } from '../parametrik/types';
import { box } from '../parametrik/types';

export const white = '--paper',
	water = '--cat-health',
	energy = '--cat-mobility',
	food = '--cat-nature',
	workshop = '--cat-living',
	path = '--cat-business',
	living = '--body-living',
	pane = '--cat-health-3';
/** Shared primitive fields. The registry assigns stable local IDs in drawing order. */
export function surface(token: ColorToken = white, material: MaterialId = 'metal') {
	return { id: '', role: 'neu' as const, material, token };
}
/** Rectangular part measured from its lower, minimum corner. */
export function slab(position: Vec3, size: Vec3, token: ColorToken = white): Primitive {
	return box('', position, size, token, 'neu', 'metal');
}
/** Upright drum measured from the centre of its bottom face. */
export function drum(
	position: Vec3,
	radius: number,
	height: number,
	token: ColorToken = white
): Primitive {
	return { ...surface(token), kind: 'cylinder', position, radius, height };
}
/** Ellipsoid with its vertical radius expressed as a fraction of the plan radius. */
export function bulb(position: Vec3, radius: number, squash: number, token: ColorToken): Primitive {
	return { ...surface(token), kind: 'sphere', position, radius, squash };
}
/** Straight tube between two centre-line ends. */
export function rod(from: Vec3, to: Vec3, radius: number, token: ColorToken = white): Primitive {
	return { ...surface(token), kind: 'pipe', points: [from, to], radius };
}
/** Upright annulus or solid disc with its axis along x. */
export function ring(
	position: Vec3,
	radius: number,
	innerRadius: number,
	depth: number,
	token: ColorToken = white
): Primitive {
	return { ...surface(token), kind: 'ring', position, radius, innerRadius, depth };
}
/** Hemisphere or shallow dome on a horizontal seating plane. */
export function cap(
	position: Vec3,
	radius: number,
	height: number,
	token: ColorToken = white
): Primitive {
	return { ...surface(token), kind: 'dome', position, radius, height };
}
