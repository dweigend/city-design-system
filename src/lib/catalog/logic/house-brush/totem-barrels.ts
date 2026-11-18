import { STORY } from '../../data/grid';
import type { Vec3 } from '../parametrik/types';
import { inradius, type QuadCell } from '../quad-grid';
import type { Form } from './form';

/** Fuse adjacent seats only when a tube between their centers fits through the shared side. */
export function joinedBarrel(
	cell: QuadCell,
	side: number,
	neighbor: QuadCell,
	z: number,
	portal: boolean
): Form | undefined {
	const [x, y] = cell.center;
	const dx = neighbor.center[0] - x,
		dy = neighbor.center[1] - y;
	const length = Math.hypot(dx, dy);
	if (!length) return;
	const clearance = (p: Vec3) => (dx * (p[1] - y) - dy * (p[0] - x)) / length;
	const a = clearance(cell.corners[side]),
		b = clearance(cell.corners[(side + 1) % 4]);
	if (a * b >= 0) return;
	const radius =
		Math.min(inradius(cell), inradius(neighbor), Math.abs(a), Math.abs(b), STORY * 0.48) * 0.93;
	if (radius < 0.5 * Math.min(inradius(cell), inradius(neighbor))) return;
	if (portal)
		return {
			kind: 'arch',
			position: [x + dx / 2, y + dy / 2, z],
			width: length,
			length: radius * 1.8,
			rise: Math.max(length * 0.52, STORY + radius),
			thickness: length * 0.19,
			rotation: Math.atan2(dy, dx)
		};
	return {
		kind: 'capsule',
		from: [x, y, z + radius],
		to: [neighbor.center[0], neighbor.center[1], z + radius],
		radius
	};
}
