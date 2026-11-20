import { fitPlinthStock } from './plinth-stock';
import { solid, worldSize } from './objects';
import type { Level, Plan, Point, Solid } from './types';

/** Cuts the four corners of a ground-bearing plinth to its surveyed footprint. */
function plinth(
	plan: Plan,
	center: Point,
	width: number,
	depth: number,
	height: number
): Extract<Solid, { kind: 'prism' }> {
	const p = solid(
		plan.site.id + '/plinth',
		'bearing',
		'deck',
		center,
		[width, depth, height],
		plan.site.ground,
		'base'
	);
	const [x, y, z] = p.position;
	const r = Math.min(0.3, width / 8, depth / 8);
	return {
		...p,
		kind: 'prism' as const,
		z,
		height,
		polygon: [
			[x + r, y],
			[x + width - r, y],
			[x + width, y + r],
			[x + width, y + depth - r],
			[x + width - r, y + depth],
			[x + r, y + depth],
			[x, y + depth - r],
			[x, y + r]
		]
	};
}

/** The base is bearing ground and ends at the surveyed bay; bodies above may cantilever over it. */
function bayClamp(plan: Plan, axis: 0 | 1, low: number, high: number): [number, number] {
	const { center, width, depth } = plan.site;
	const half = [width, depth][axis] / 2;
	const lo = Math.max(low, center[axis] - half),
		hi = Math.min(high, center[axis] + half);
	return [lo, hi];
}
function chamberEdges(plan: Plan, cy: number, front: number, rear: number) {
	if (plan.type === 'tree-house') return [Math.max(front, cy - 0.4), rear];
	if (plan.type !== 'cluster-mast') return [front, rear];
	return plan.sign > 0 ? [front, Math.min(rear, cy + 0.15)] : [Math.max(front, cy - 0.15), rear];
}
/** Seats the first floor or entry on a solid core rising from a chamfered base. */
export function foundation(plan: Plan, level: Level, parts: Solid[], stations: number[]) {
	const { ground, id } = plan.site;
	const first = parts.find(
		(p) => p.joint === 'deck' && (p.id === id + '/entry' || p.id.startsWith(id + '/level/0/'))
	);
	if (!first) throw Error('Missing lowest bearing plate');
	const top = first.kind === 'prism' ? first.z : 'position' in first ? first.position[2] : ground;
	const width = Math.max(...level.bodies.map((b) => worldSize(b)[0]));
	const cx = (stations[0] + stations[1]) / 2,
		cy = plan.rear - plan.sign * 0.15;
	const coreWidth = Math.max(width / 4, stations[1] - stations[0] + plan.bar);
	const baseHeight = top - ground < 0.72 ? top - ground : 0.6;
	const hasEntry = first.id === id + '/entry';
	const members = parts.filter(
		(p) =>
			!(
				p.joint !== 'deck' &&
				(p.id.startsWith(id + '/entry/post/') ||
					(p.id.startsWith(id + '/level/0/') &&
						!hasEntry &&
						['foot', 'shaft', 'head', 'brace'].includes(p.joint)))
			)
	);
	const edges = (k: 0 | 1, sign: number) =>
		Math.max(
			sign * [cx, cy][k] + [coreWidth, 0.3][k] / 2,
			...level.bodies.map((b) => sign * b.position[k] + worldSize(b)[k] / 2)
		);
	const [left, right] = bayClamp(plan, 0, -edges(0, -1), edges(0, 1)),
		[front, rear] = bayClamp(plan, 1, -edges(1, -1), edges(1, 1));
	const base = plinth(
		plan,
		[(left + right) / 2, (front + rear) / 2, ground],
		right - left,
		rear - front,
		baseHeight
	);
	const [chamberFront, chamberRear] = chamberEdges(plan, cy, front, rear);
	const rise = top - ground - baseHeight;
	const core =
		rise > 1e-8
			? [
					solid(
						id + '/socle/body/0',
						'bearing',
						'body',
						[(left + right) / 2, (chamberFront + chamberRear) / 2, ground + baseHeight],
						[(right - left) * 0.97, (chamberRear - chamberFront) * 0.97, rise],
						ground,
						level.use
					)
				]
			: [];
	const holes = first.kind === 'prism' ? first.holes : undefined;
	if (!holes?.length) return [fitPlinthStock(base), ...core, ...members];
	return [
		{ ...base, holes },
		...core.map((p) => ({
			...p,
			kind: 'prism' as const,
			z: p.position[2],
			height: p.size[2],
			polygon: base.polygon,
			holes
		})),
		...members
	];
}
