import { required } from '../required';
import { STORY } from '../../data/grid';
import { terraceGuards } from './terrace-guards';
import { roofExit } from './roof-exit';
import { brace } from './brace';
import { bearings, tierParts } from './frame';
import { crownSpec, mounted, objectSlot, solid } from './objects';
import type { Level, Point, Solid, Plan } from './types';
import type { HouseRole } from './families';
const volume = ([w, d, h]: Point) => w * d * h;
function parapet(plan: Plan, plate: ReturnType<typeof solid>) {
	if (plan.site.compact) return [];
	const [w, d, h] = plate.size,
		[x, y, z] = plate.position;
	const n = Math.floor(w / 2.5);
	return Array.from({ length: n }, (_, i) => {
		const rail = objectSlot(
			plate.id + '/rail/' + i,
			['kit-parapet-rail-2p5m', 'two-post', 'workshop'],
			'material',
			plan.seed,
			0
		);
		rail.position = [
			x + w / 2 + (i - (n - 1) / 2) * 2.5,
			y + (plan.sign > 0 ? 0.06 : d - 0.06),
			z + h
		];
		return mounted(rail, plan.site.ground, 'beam');
	});
}
function roof(
	plan: Plan,
	level: Level,
	z: number,
	stations: number[],
	use: Level['use'],
	spec: ReturnType<typeof crownSpec>
) {
	const { site, seed, rear } = plan;
	const below = level.position[2];
	const crown = objectSlot(site.id + '/crown', spec, use, seed, 0);
	const [w, d] = crown.size,
		x = (stations[0] + stations[stations.length - 1]) / 2,
		y = rear - (plan.sign * d) / 2;
	crown.position = [x, y, z];
	crown.anchor = 'roof';
	const deck = solid(
		site.id + '/roof',
		'deck',
		[x, y, z - 0.25],
		[
			Math.min(
				site.width,
				Math.max(w + 0.6, required(stations.at(-1), 'bearing station') - stations[0] + 0.4)
			),
			Math.min(site.depth, d + (site.compact ? 0 : 0.6)),
			0.25
		],
		site.ground,
		'deck'
	);
	const walkZ = site.base + site.programme.length * STORY;
	const walk = roofExit(plan, level, stations, walkZ);
	const braces =
		z + crown.size[2] - site.ground >= 8
			? [brace(plan, site.id + '/roof/brace', stations, walkZ, z - 0.25, false)]
			: [];
	return {
		crown,
		parts: [
			...bearings(plan, site.id + '/walk', below, walkZ - 0.3, stations),
			walk,
			...(site.programme.length > 8
				? [brace(plan, site.id + '/walk/brace', stations, below, walkZ - 0.3, true)]
				: []),
			...bearings(plan, site.id + '/roof', walkZ, z - 0.25, stations),
			...braces,
			deck,
			...parapet(plan, deck),
			mounted(crown, site.ground, 'crown')
		]
	};
}
function entryLanding(plan: Plan, stations: number[]) {
	const y = plan.rear - plan.sign * 0.625;
	const width = stations[stations.length - 1] - stations[0] + 0.6;
	const plate = solid(
		plan.site.id + '/entry',
		'deck',
		[(stations[0] + stations[stations.length - 1]) / 2, y, plan.datum - 0.25],
		[width, 1.25, 0.25],
		plan.site.ground,
		'deck'
	);
	return [
		...bearings(plan, plan.site.id + '/entry', plan.site.ground, plan.datum - 0.25, stations),
		plate
	];
}
function balanced(parts: Solid[], bodies: number, crown: number, compact: boolean) {
	const total = parts.reduce((s, p) => s + volume(p.size), 0);
	const frame = (total - bodies - crown) / total;
	return bodies / total >= 0.55 && (!compact || frame >= 0.2) && frame <= 0.35;
}
/** Selects a stock crown and a slab section satisfying the mass budget with every joint included. */
export function assemble(
	plan: Plan,
	levels: Level[],
	role: HouseRole,
	stations: number[],
	skyline: number
) {
	const below = required(levels.at(-1), 'upper datum').position[2],
		top = below + STORY + (role === 'high' ? STORY / 2 : 0);
	const upper = levels[levels.length - 1];
	if (upper.bodies[0].band) upper.bodies[0].size[2] = top - below - 0.25;
	const use = upper.use;
	const roofs = [false, true]
		.map((small) => roof(plan, upper, top, stations, use, crownSpec(use, small)))
		.filter(
			({ crown }) =>
				crown.size[0] <= plan.site.width &&
				crown.size[1] + (plan.site.compact ? 0 : 0.3) <=
					(plan.site.compact
						? Math.min(3.6, plan.site.depth)
						: plan.site.depth - plan.site.accessDepth) &&
				(role === 'high' || top + crown.size[2] <= skyline)
		);
	roofs.push(roof(plan, upper, top, stations, use, ['primitive-dome', 'short', 'dome']));
	const bodies = levels.flatMap((l) => l.bodies).reduce((s, b) => s + volume(b.size), 0);
	const fittings = terraceGuards(plan, levels);
	const guards = fittings.map((b) => mounted(b, plan.site.ground, 'service'));

	for (const prefabricated of [true, false])
		for (const ratio of [0.3, 0.24, 0.36, 0.18, 0.42, 0.1, 0.5, 0.04]) {
			const entry = levels[0].position[2] > plan.datum ? entryLanding(plan, stations) : [];
			const frame = levels.flatMap((l, i) =>
				tierParts(plan, l, i, levels[i - 1], stations, ratio, prefabricated)
			);
			for (const { crown, parts: cap } of roofs) {
				const parts = [...entry, ...frame, ...cap, ...guards];
				if (balanced(parts, bodies, volume(crown.size), plan.site.compact))
					return { parts, crown, fittings };
			}
		}
	throw new RangeError('No balanced assembly for ' + plan.site.id + ' ' + plan.type);
}
