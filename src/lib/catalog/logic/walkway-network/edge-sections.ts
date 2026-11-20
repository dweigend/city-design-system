import type { MovementEdge, MovementPort } from '../movement-network';
import type { Section } from './ribbon-curve';
import type { Vec3 } from '../parametrik/types';
type Point = MovementPort['position'];
/** Offsets a solved edge at its recorded bearings. Straight or polygonal generators
 * can omit bearings; the adjacent samples then define the transverse section. */
export function edgeSections(edge: MovementEdge, path: Point[]): Section[] {
	return path.map((p, i) => {
		const a = path[Math.max(0, i - 1)],
			b = path[Math.min(path.length - 1, i + 1)];
		const dx = b[0] - a[0],
			dy = b[1] - a[1],
			d = Math.hypot(dx, dy);
		const [nx, ny] = edge.normals?.[i] ?? [-dy / d, dx / d];
		const offset = (w: number): Vec3 => [p[0] + nx * w, p[1] + ny * w, p[2]];
		return { centre: [...p], left: offset(edge.width / 2), right: offset(-edge.width / 2) };
	});
}
