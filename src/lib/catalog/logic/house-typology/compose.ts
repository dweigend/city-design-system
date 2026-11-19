import { silhouette } from './signature';
import { housePath } from './routes';
import { layout } from './layout';
import { assemble } from './assembly';
import type { HouseSite } from './site';
import { planEnsemble, type EnsembleContext } from './ensemble';
import { survey } from './survey';
import { collapse } from './collapse';
import { occupiedLevels } from './levels';
import type { HouseComposition, Point, Port, Plan, Level } from './types';
const spread: Partial<Record<Plan['type'], number>> = {
	'portal-house': 0.72,
	'bridge-house': 0.65,
	rack: 0.82,
	'deck-tower': 0.58,
	'bell-house': 0.72,
	'twin-stack': 0.58,
	'slab-house': 0.48,
	'lattice-head': 0.6
};
function commonAxis(levels: Level[]) {
	const left = Math.max(...levels.map((l) => l.position[0] - l.width / 2));
	const right = Math.min(...levels.map((l) => l.position[0] + l.width / 2));
	return (left + right) / 2;
}
function bearingAxes(plan: Plan, levels: Level[]) {
	const x = plan.site.compact
		? levels[0].position[0]
		: plan.type === 'terrace-house'
			? commonAxis(levels)
			: plan.site.center[0];
	const free = Math.min(...levels.map((l) => l.width / 2 - Math.abs(l.position[0] - x) - plan.bar));
	const target = spread[plan.type];
	const mast = plan.type === 'cluster-mast' && !plan.site.compact;
	const arm =
		plan.site.programme.length > 8 &&
		!['portal-house', 'bridge-house', 'twin-stack', 'slab-house'].includes(plan.type)
			? Math.max(0.4, Math.min(0.8, free))
			: target
				? Math.max(0.35, free * target)
				: mast
					? 0.3
					: 0.625;
	const span = Math.min(arm, 6.5);
	return [x - span, x + span];
}
function bridgePorts(levels: Level[]): Port[] {
	return levels.flatMap((l, level) => {
		const reach = l.round
			? Math.sqrt((l.width / 2) ** 2 - (l.landing[1] - l.position[1]) ** 2)
			: l.width / 2;
		const flanks = [-1, 1].map((side) => ({
			level,
			position: [l.position[0] + side * reach, l.landing[1], l.landing[2]] as Point
		}));
		const outside = l.bodies[0].band;
		if (!outside) return [...flanks, { level, position: l.landing }];
		const edge =
			l.position[0] + Math.sign(l.position[0] - l.bodies[0].position[0]) * (l.width / 2 - 0.25);
		return [
			...flanks,
			...[-1, 1].map((side) => ({
				level,
				position: [edge, l.position[1] + (side * l.depth) / 2, l.landing[2]] as Point
			}))
		];
	});
}
function peopleOnLandings(plan: Plan, levels: Level[]) {
	const groups = Number(
		collapse('part/people/' + plan.site.id, plan.seed, plan.type, [
			['1', 1],
			['2', levels.length >= 2 ? 1 : 0]
		])
	);
	return Array.from({ length: groups }, (_, i) => {
		const level = Math.floor((i * levels.length) / groups),
			[x, y, z] = levels[level].landing;
		const spacing = plan.site.compact ? 0.3 : 0.45;
		return [-spacing, 0, spacing].map((dx) => ({
			position: [x + dx, y, z] as Point,
			height: 1.75,
			level
		}));
	}).flat();
}
/** Composes one painted site against the frozen ensemble; a singleton uses the same three layers. */
export function composeHouse(
	input: HouseSite,
	context: EnsembleContext = planEnsemble([input])
): HouseComposition {
	const site = survey(input);
	const { plan, role, accessSide } = layout(site, context);
	const { type, sign, bar } = plan;
	const levels = occupiedLevels(plan);
	if (levels[0].court) plan.rear = levels[0].landing[1] + plan.sign * 0.15;

	const stations = bearingAxes(plan, levels);
	const { parts, crown, fittings } = assemble(plan, levels, role, stations, context.skyline);
	const path =
		Math.min(site.width, site.depth) < 3.5
			? 'ladder'
			: housePath(type, site.compact && context.houses.size === 1);
	const supports = parts.filter((p) =>
		['foot', 'shaft', 'head', 'brace', 'beam'].includes(p.joint)
	);
	return {
		id: site.id,
		flightWidth: plan.site.accessDepth > 4 || (levels[0].court?.width ?? 0) >= 5 ? 2.5 : 1.25,
		compact: site.compact,
		path,
		signature: silhouette(type, path, site.compact, site.programme.length > 8),
		bay: { x: site.center[0], y: site.center[1], width: site.width, depth: site.depth },
		start: site.start,
		stories: site.programme.length,
		role,
		typology: type,
		cells: site.cells,
		datum: context.datum,
		ground: site.ground,
		accessSide,
		people: peopleOnLandings(plan, levels),
		family: { bar, radius: bar === 0.3 ? 0.45 : 0.15, parapet: bar === 0.3 ? 'panel' : 'rail' },
		core: {
			position: [(stations[0] + stations[1]) / 2, plan.rear - sign * 0.15, site.ground],
			width: 1.25 + bar
		},
		levels,
		parts,
		supports,
		fittings,
		ports: bridgePorts(levels).concat(
			levels[0].position[2] > plan.datum
				? [{ level: -1, position: [site.center[0], plan.rear - sign * 0.625, plan.datum] }]
				: []
		),
		crown
	};
}
