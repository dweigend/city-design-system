import { worldSize } from './objects';
import type { Body, Level, Point } from './types';
import type { Plan } from './levels';

function court(plan: Plan, row: Body[]) {
	const first = row[0],
		[w, d] = worldSize(first);
	const length = Math.max(w, d),
		width = Math.min(w, d),
		center = plan.site.center[0];
	const y = plan.rear - plan.sign * (1.25 + (length + width) / 2);
	return [
		[-width / 2, -length / 2],
		[length / 2, -width / 2],
		[width / 2, length / 2],
		[-length / 2, width / 2]
	].map(([u, v], i): Body => ({
		...first,
		id: first.id + '/wing/' + i,
		rotation: ((i % 2) * Math.PI) / 2 + (first.size[0] < first.size[1] ? Math.PI / 2 : 0),
		position: [center + u, y + v, first.position[2]]
	}));
}
/** Places four wings around an open court or alternating branches around the mast. */
export function arrange(plan: Plan, row: Body[]) {
	if (plan.type === 'courtyard-house') return court(plan, row);
	return row;
}
/** The smallest circular deck that clears an occupied rectangle and its rear landing. */
export function disc(plan: Plan, level: Level): Level {
	const row = level.bodies,
		w = Math.max(...row.map((b) => worldSize(b)[0])),
		d = level.depth - 1.55;
	const [x, , z] = level.position,
		r = Math.max(Math.hypot(w / 2, d / 2) + 0.1, d / 2 + 1.25);
	const y = plan.rear - plan.sign * r;
	for (const b of row) b.position[1] += y - (level.position[1] - 0.475 * plan.sign);
	const outline: Point[] = Array.from({ length: 64 }, (_, i) => [
		x + r * Math.cos((i * Math.PI) / 32),
		y + r * Math.sin((i * Math.PI) / 32),
		z
	]);
	return {
		...level,
		position: [x, y, z],
		width: 2 * r,
		depth: 2 * r,
		round: true,
		deckArea: Math.PI * r * r,
		outline,
		landing: [x, plan.rear - plan.sign * 0.625, z]
	};
}
