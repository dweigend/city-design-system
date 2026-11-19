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
	'lattice-head': 0.6
};
function bearingAxes(plan: Plan, levels: Level[]) {
	const x =
		plan.type === 'terrace-house' ? levels[levels.length - 1].position[0] : plan.site.center[0];
	const free = Math.min(...levels.map((l) => l.width / 2 - Math.abs(l.position[0] - x) - plan.bar));
	const target = spread[plan.type];
	const mast = plan.type === 'cluster-mast' && !plan.site.compact;
	const arm = target ? Math.max(0.35, free * target) : mast ? 0.3 : 0.625;
	return [x - arm, x + arm];
}
function bridgePorts(levels: Level[]): Port[] {
	return levels.flatMap((l, level) => {
		const reach = l.round
			? Math.sqrt((l.width / 2) ** 2 - (l.landing[1] - l.position[1]) ** 2)
			: l.width / 2;
		return [-1, 1].map((side) => ({
			level,
			position: [l.position[0] + side * reach, l.landing[1], l.landing[2]] as Point
		}));
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
		const spacing = plan.site.compact ? 0.52 : 0.35;
		return [-spacing, spacing].map((dx) => ({
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
	if (levels[0].court) plan.rear = levels[0].landing[1];
	const stations = bearingAxes(plan, levels);
	const { parts, crown, fittings } = assemble(plan, levels, role, stations, context.skyline);
	const supports = parts.filter((p) =>
		['foot', 'shaft', 'head', 'brace', 'beam'].includes(p.joint)
	);
	return {
		id: site.id,
		compact: site.compact,
		path: housePath(type, site.compact && context.houses.size === 1),
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
