import { assemble } from './assembly';
import type { HouseSite } from '../composed-house';
import { planEnsemble, type EnsembleContext } from './ensemble';
import { survey } from './survey';
import { collapse } from './collapse';
import { occupiedLevels } from './levels';
import type { HouseComposition, Point, Port } from './types';
/** Composes one painted site against the frozen ensemble; a singleton uses the same three layers. */
export function composeHouse(
	input: HouseSite,
	context: EnsembleContext = planEnsemble([input])
): HouseComposition {
	const site = survey(input),
		fixed = context.houses.get(site.id);
	if (!fixed) throw new RangeError('Site outside ensemble: ' + site.id);
	const { role, typology: type } = fixed;
	const accessSide = collapse('part/side/' + site.id, context.seed, type, [
		['north', 1],
		['south', 1]
	] as const);
	const sign = accessSide === 'north' ? 1 : -1,
		bar = type === 'lattice-head' || type === 'portal-house' ? 0.3 : 0.12;
	const plan = {
		site,
		type,
		seed: context.seed,
		sign,
		datum: context.datum,
		rear: site.center[1] + sign * 3,
		bar
	};
	const levels = occupiedLevels(plan);
	const x = site.center[0],
		wide = [
			'portal-house',
			'bridge-house',
			'rack',
			'deck-tower',
			'bell-house',
			'twin-stack'
		].includes(type);
	const axis =
		wide &&
		levels.every(
			(l) => Math.min(x - (l.position[0] - l.width / 2), l.position[0] + l.width / 2 - x) > 2.7
		)
			? 2.5
			: 0.625;
	const stations = [x - axis, x + axis];
	const { parts, crown } = assemble(plan, levels, role, stations, context.skyline);
	const supports = parts.filter((p) => ['foot', 'shaft', 'head', 'brace'].includes(p.joint));
	const ports: Port[] = levels.flatMap((l, level) => {
		const reach = l.round
			? Math.sqrt((l.width / 2) ** 2 - (l.landing[1] - l.position[1]) ** 2)
			: l.width / 2;
		return [-1, 1].map((side) => ({
			level,
			position: [l.position[0] + side * reach, l.landing[1], l.landing[2]] as Point
		}));
	});
	const groups = Number(
		collapse('part/people/' + site.id, context.seed, type, [
			['1', 1],
			['2', levels.length >= 2 ? 1 : 0],
			['3', levels.length >= 3 ? 1 : 0]
		])
	);
	const people = Array.from({ length: groups }, (_, i) => {
		const level = Math.floor((i * levels.length) / groups),
			[x, y, z] = levels[level].landing;
		return [-0.35, 0.35].map((dx) => ({ position: [x + dx, y, z] as Point, height: 1.75, level }));
	}).flat();
	return {
		id: site.id,
		role,
		typology: type,
		cells: site.cells,
		datum: context.datum,
		ground: site.ground,
		accessSide,
		people,
		family: { bar, radius: bar === 0.3 ? 0.45 : 0.15, parapet: bar === 0.3 ? 'panel' : 'rail' },
		core: { position: [x, plan.rear - sign * 0.15, site.ground], width: 1.25 + bar },
		levels,
		parts,
		supports,
		ports,
		crown
	};
}
