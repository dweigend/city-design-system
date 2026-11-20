import { STORY } from '../../data/grid';
import { storeyBand } from './bands';
import { branchLevel } from './branches';
import { clusterLevel } from './cluster';
import { ringLevel } from './ring';
import { courseIndices } from './courses';
import { blockLevel } from './block';
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
	const { type } = plan,
		use = useAt(plan, i),
		z = plan.datum + i * STORY;
	if (type === 'block') return blockLevel(plan, i, use);
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
				'kit-capsule-' +
					['ribbon', 'porthole', 'closed', 'balcony'][((site.seed + i) >>> 0) & 3] +
					'-' +
					String(length).replace('.', 'p') +
					'm',
				(i + (plan.seed & 1)) % 4 >= 2 ? 'high-waist' : 'round-shoulder',
				'capsule'
			] as const);
}
function infillLevel(plan: Plan, i: number, z: number, use: Body['use']): Level {
	const { site, type } = plan;

	const bell = type === 'bell-house' && i === site.programme.length - 1;
	const depth = site.depth - site.accessDepth - 1.55;
	const spec = infillStock(plan, i, bell, depth);
	const b = objectSlot(site.id + '/level/' + i + '/body/0', 'cantilever', spec, use, plan.seed, 0);
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

function seatUpperBlock(level: Level, lower: Body) {
	const z = lower.position[2] + lower.size[2] + 0.16;
	level.position[2] = z;
	level.landing[2] = z;
	level.bodies[0].position[2] = z;
	for (const point of level.outline) point[2] = z;
}
function shellCourse(plan: Plan, levels: Level[], k: number) {
	if (levels.length !== 2) return k % 3 === 1;
	const ratio = plan.type === 'block' ? 0.75 : 1;
	return k === 1 && levels[1].bodies[0].size[2] < levels[0].bodies[0].size[2] * ratio;
}
/** Groups the complete painted programme onto the occupied courses of this typology. */
export function occupiedLevels(plan: Plan) {
	const ordered = courseIndices(plan),
		rows = plan.site.programme;
	const levels = ordered.map((i, k) => ({
		...planLevel(plan, i, k),
		programme: rows.slice(k ? i : 0, ordered[k + 1] ?? rows.length).flat()
	}));
	if (plan.type === 'block' && levels.length > 1) seatUpperBlock(levels[1], levels[0].bodies[0]);
	for (const [k, level] of levels.entries()) {
		const band = level.bodies[0].band;
		if (band && levels[k + 1] && plan.type !== 'block')
			level.bodies[0].size[2] =
				Math.min(2 * STORY, levels[k + 1].position[2] - level.position[2]) - 0.3;
		if (band) band.shell = shellCourse(plan, levels, k);
	}
	return levels;
}
