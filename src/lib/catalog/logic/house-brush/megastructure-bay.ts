import { STORY } from '../../data/grid';
import type { ColorToken, Vec3 } from '../parametrik/types';
import { inradius, type QuadCell } from '../quad-grid';
import { accentOf, part, type Form } from './form';
import type { Mass, Story } from './massing';

/** Draw the perimeter joints inward, preserving one common joint between adjoining bays. */
export function mountingGrid(mass: Mass) {
	const joints = new Map<string, { x: number; y: number; count: number }>();
	for (const { cell } of mass.stories)
		cell.vertexIds.forEach((id, i) => {
			const joint = joints.get(id) ?? { x: 0, y: 0, count: 0 };
			joint.x += cell.center[0] - cell.corners[i][0];
			joint.y += cell.center[1] - cell.corners[i][1];
			joint.count++;
			joints.set(id, joint);
		});
	return (cell: QuadCell) =>
		cell.corners.map(([x, y, z], i): Vec3 => {
			const joint = joints.get(cell.vertexIds[i]);
			return joint
				? [x + (0.14 * joint.x) / joint.count, y + (0.14 * joint.y) / joint.count, z]
				: [x, y, z];
		});
}

/** Local coordinates follow the carrier quad in plan and the painted story vertically. */
export function bayOf(mass: Mass, { cell, level }: Story, corners: Vec3[]) {
	const point = (u: number, v: number, h: number): Vec3 => {
		const [a, b, c, d] = corners;
		const mix = (i: number) =>
			(1 - v) * ((1 - u) * a[i] + u * b[i]) + v * ((1 - u) * d[i] + u * c[i]);
		return [mix(0), mix(1), mass.floor + h * STORY];
	};
	const piece = <F extends Form>(name: string, token: ColorToken, form: F) => ({
		...part(`${mass.id}/${cell.id}/${name}`, token, form),
		...form,
		material: 'glaze' as const,
		edges: false
	});
	const radius = inradius(cell);
	return {
		cell,
		level,
		point,
		piece,
		radius,
		gauge: Math.min(radius, STORY / 2),
		token: accentOf(mass.use) ?? ('--paper' as const)
	};
}
export type Bay = ReturnType<typeof bayOf>;

/** Projects a point along a counterclockwise side, with a signed inset in bay coordinates. */
export function along(bay: Bay, side: number, t: number, inset: number, height: number) {
	const uv = [
		[t, inset],
		[1 - inset, t],
		[1 - t, 1 - inset],
		[inset, 1 - t]
	][side];
	return bay.point(uv[0], uv[1], height);
}
