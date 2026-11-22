import { ribbonDimensions, ribbonPierGeometry } from '../assets';
import type { Vec3, Primitive } from '../parametrik/types';
import { pathSurfaces } from './town-palette';
/** Public ribbon section and support dimensions in metres (delegates shared deck and pier dimensions to assets). */
export const ribbonProfile = {
	width: ribbonDimensions.width,
	depth: ribbonDimensions.depth,
	guardDrop: 1.15,
	columnRadius: ribbonDimensions.columnRadius,
	bay: ribbonDimensions.bay,
	railRadius: 0.019,
	postRadius: 0.016
} as const;
type Ground = (x: number, y: number) => number;
/** Seats a vertical column between finished terrain and the deck soffit using the shared pier rule. */
export function column(
	id: string,
	p: Vec3,
	ground: Ground,
	depth: number = ribbonProfile.depth
): Primitive[] {
	return ribbonPierGeometry(id, p, ground, depth).map((pier) => ({
		...pathSurfaces.bearing,
		kind: 'cylinder' as const,
		id: pier.id,
		position: pier.kind === 'cylinder' ? pier.position : p,
		height: pier.kind === 'cylinder' ? pier.height : 0,
		radius: pier.kind === 'cylinder' ? pier.radius : ribbonProfile.columnRadius
	}));
}
