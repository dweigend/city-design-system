import type { Vec3, Primitive } from '../parametrik/types';
import { pathSurfaces } from './town-palette';
/** Public ribbon section and support dimensions in metres. */
export const ribbonProfile = {
	depth: 0.15,
	columnRadius: 0.12,
	bay: 8,
	railRadius: 0.026,
	postRadius: 0.022
} as const;
type Ground = (x: number, y: number) => number;
/** Seats a vertical column between finished terrain and the deck soffit. */
export function column(
	id: string,
	p: Vec3,
	ground: Ground,
	depth: number = ribbonProfile.depth
): Primitive[] {
	const base = ground(p[0], p[1]),
		height = p[2] - depth - base;
	if (!Number.isFinite(height) || height <= 0.04) return [];
	return [
		{
			...pathSurfaces.bearing,
			kind: 'cylinder',
			id,
			position: [p[0], p[1], base],
			height,
			radius: ribbonProfile.columnRadius
		}
	];
}
