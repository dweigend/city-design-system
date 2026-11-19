import { STORY } from '../../data/grid';
import { storeyBand } from './bands';
import { branchLevel } from './branches';
import { clusterLevel } from './cluster';
import { ringLevel } from './ring';
import { courseIndices } from './courses';
import { podLevel } from './pod';
import { collapse } from './collapse';
import { objectSlot, worldSize } from './objects';
import type { Body, Level, Plan, Point } from './types';

function useAt({ site, type, seed }: Plan, i: number) {
	const paint = site.programme[i];
	const domain = site.living.has(i) ? ['living' as const] : [...new Set(paint)];
	return collapse(
		site.id + '/part/use/' + i,
		seed,
		type,
		domain.map((u) => [u, paint.filter((p) => p === u).length])
	);
}
const kinds: Partial<Record<Body['kind'], Level['kind']>> = {
	reservoir: 'rack',
	capsule: 'capsule',
	solar: 'solar',
	grove: 'grove',
	dome: 'dome',
	lookout: 'lookout'
};
function rectangular(plan: Plan, row: Body[], i: number, z: number): Level {
	const { site, sign, rear } = plan;
	const edges = (axis: 0 | 1, side: number) =>
		row.map((b) => b.position[axis] + (side * worldSize(b)[axis]) / 2);
	const left = Math.min(...edges(0, -1)),
		right = Math.max(...edges(0, 1));
	const inner = sign > 0 ? Math.min(...edges(1, -1)) : Math.max(...edges(1, 1));
	const width = right - left + 0.6,
		depth = Math.abs(rear - inner) + 0.3;
	const x = (left + right) / 2,
		y = rear - (sign * depth) / 2;
	const outline: Point[] = [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1]
	].map(([u, v]) => [x + (u * width) / 2, y + (v * depth) / 2, z]);
	return {
		position: [x, y, z],
		width,
		depth,
		round: false,
		deckArea: width * depth,
		outline,
		programme: site.programme[i],
		use: row[0].use,
		kind: kinds[row[0].kind] ?? 'workshop',
		bodies: row,
		landing: [x, rear - sign * 0.625, z]
	};
}
const special: Partial<Record<Plan['type'], typeof ringLevel>> = {
	'cluster-mast': clusterLevel,
	'round-tower': ringLevel
};
function planLevel(plan: Plan, i: number, course: number): Level {
	const { site, type } = plan,
		use = useAt(plan, i),
		z = plan.datum + i * STORY;
	if (site.compact) return podLevel(plan, i, use);
	const band = storeyBand(plan, i, course, use);
	if (band) return band;
	if (type === 'tree-house') return branchLevel(plan, i, use);
	const build = special[type];
	if (build) return build(plan, i, z, use);
	return infillLevel(plan, i, z, use);
}
function infillStock(plan: Plan, i: number, bell: boolean, depth: number) {
	const { site, type } = plan;
	const length = type === 'bell-house' ? 5 : site.width >= 12 ? 10 : site.width >= 8.5 ? 7.5 : 5;

	return bell
		? ([
				'glass-bell',
				depth >= 5.6 && plan.site.programme.length === 1 ? 'winter-garden' : 'hothouse',
				'dome'
			] as const)
		: ([
				'kit-capsule-ribbon-' + String(length).replace('.', 'p') + 'm',
				i % 8 >= 4 ? 'high-waist' : 'round-shoulder',
				'capsule'
			] as const);
}
function infillLevel(plan: Plan, i: number, z: number, use: Body['use']): Level {
	const { site, type } = plan;

	const bell = type === 'bell-house' && i === site.programme.length - 1;
	const depth = site.depth - site.accessDepth - 1.55;
	const spec = infillStock(plan, i, bell, depth);
	const b = objectSlot(site.id + '/level/' + i + '/body/0', spec, use, plan.seed, 0);
	b.scale = Math.max(
		0.85,
		Math.min(
			1.15,
			(site.width - 1.1) / b.nativeSize[0],
			depth / b.nativeSize[1],
			(bell ? 3.45 : 2.78) / b.nativeSize[2]
		)
	);
	b.size = b.nativeSize.map((v) => v * b.scale) as Point;
	b.position = [
		site.center[0] + (-1) ** i * 0.25,
		plan.rear - plan.sign * (1.25 + b.size[1] / 2),
		z + 0.3
	];
	return rectangular(plan, [b], i, z);
}

/** Groups the complete painted programme onto the occupied courses of this typology. */
export function occupiedLevels(plan: Plan) {
	const ordered = courseIndices(plan),
		rows = plan.site.programme;
	const levels = ordered.map((i, k) => ({
		...planLevel(plan, i, k),
		programme: rows.slice(k ? i : 0, ordered[k + 1] ?? rows.length).flat()
	}));
	for (const [k, level] of levels.entries()) {
		const band = level.bodies[0].band,
			previous = levels[k - 1];
		if (band && levels[k + 1])
			level.bodies[0].size[2] =
				Math.min(2 * STORY, levels[k + 1].position[2] - level.position[2]) - 0.3;
		if (band) band.shell = Boolean(previous && !previous.bodies[0].band?.shell);
	}
	return levels;
}
