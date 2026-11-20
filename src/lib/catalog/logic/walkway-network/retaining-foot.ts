import type { Primitive, Vec3 } from '../parametrik/types';
import { shoelaceArea } from '../parametrik/raster/geometry';
import { publicPaving } from './town-floor';

/** Maximum exposed retaining face before a public walk crosses on separate piers, in metres. */
export const retainingHeight = 1.2;

type Plate = Extract<Primitive, { kind: 'prism' }>;
type Ground = (x: number, y: number) => number;

/** Closes the exposed retaining faces under a tread down to its surveyed ground corners. */
export function retainingFoot(p: Plate, ground: Ground): Primitive {
	const polygon = shoelaceArea(p.polygon) > 0 ? p.polygon : [...p.polygon].reverse();
	const top = polygon.map(([x, y]): Vec3 => [x, y, p.z]);
	const bottom = polygon.map(([x, y]): Vec3 => {
		const soil = ground(x, y);
		// At the survey boundary the retaining face terminates at the slab soffit.
		return [x, y, Number.isFinite(soil) ? Math.min(p.z, soil - 0.04) : p.z];
	});
	const n = top.length;
	return {
		kind: 'mesh',
		role: 'neu',
		...publicPaving,
		id: p.id + '/pier/foot',
		points: [...bottom, ...top],
		triangles: polygon.flatMap((_, i) => {
			const j = (i + 1) % n;
			return [i, j, j + n, i, j + n, i + n];
		}),
		lines: [top.map((_, i) => i + n).concat(n)]
	};
}

/** Extends a low circular landing into the bank down to the lowest perimeter sample. */
export function landingBase(position: Vec3, radius: number, ground: Ground) {
	const [x, y, z] = position;
	const levels = Array.from({ length: 16 }, (_, i) => {
		const a = (i * Math.PI) / 8;
		return ground(x + radius * Math.cos(a), y + radius * Math.sin(a));
	});
	const base = Math.min(...levels, ground(x, y)) - 0.04;
	return z - base <= retainingHeight ? Math.min(z - 0.2, base) : undefined;
}
