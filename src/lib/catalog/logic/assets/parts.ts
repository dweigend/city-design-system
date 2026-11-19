import type { Vec3 } from '../parametrik/types';
import type { ObjectGeometry } from './object-geometry';
/** Shared primitive fields. The registry assigns stable local IDs in drawing order. */
export function surface(slot = 'body') {
	return { id: '', role: 'neu' as const, slot };
}
/** Rectangular part measured from its lower, minimum corner. */
export function slab(position: Vec3, size: Vec3, slot = 'body'): ObjectGeometry {
	return { ...surface(slot), kind: 'box', position, size };
}
/** Upright drum measured from the centre of its bottom face. */
export function drum(
	position: Vec3,
	radius: number,
	height: number,
	slot = 'body'
): ObjectGeometry {
	return { ...surface(slot), kind: 'cylinder', position, radius, height };
}
/** Ellipsoid with its vertical radius expressed as a fraction of the plan radius. */
export function bulb(position: Vec3, radius: number, squash: number, slot: string): ObjectGeometry {
	return { ...surface(slot), kind: 'sphere', position, radius, squash };
}
/** Straight tube between two centre-line ends. */
export function rod(from: Vec3, to: Vec3, radius: number, slot = 'body'): ObjectGeometry {
	return { ...surface(slot), kind: 'pipe', points: [from, to], radius };
}
/** Upright annulus or solid disc with its axis along x. */
export function ring(
	position: Vec3,
	radius: number,
	innerRadius: number,
	depth: number,
	slot = 'body'
): Extract<ObjectGeometry, { kind: 'ring' }> {
	return { ...surface(slot), kind: 'ring', position, radius, innerRadius, depth };
}
/** Hemisphere or shallow dome on a horizontal seating plane. */
export function cap(position: Vec3, radius: number, height: number, slot = 'body'): ObjectGeometry {
	return { ...surface(slot), kind: 'dome', position, radius, height };
}
