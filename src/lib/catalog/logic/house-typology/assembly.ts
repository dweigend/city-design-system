import { required } from '../required';
import { STORY } from '../../data/grid';
import { brace } from './brace';
import { bearings, tierParts } from './frame';
import { crownSpec, mounted, objectSlot, solid } from './objects';
import type { Level, Point, Solid, Plan } from './types';
import type { HouseRole } from './families';
const volume = ([w, d, h]: Point) => w * d * h;
function roof(
	plan: Plan,
	below: number,
	z: number,
	stations: number[],
	spec: ReturnType<typeof crownSpec>
) {
	const { site, seed, rear } = plan;
	const crown = objectSlot(site.id + '/crown', spec, 'energy', seed, 0);
	const [w, d] = crown.size,
		x = site.center[0],
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
	const walk = solid(
		site.id + '/roof-walk',
		'deck',
		[x, rear - plan.sign * (plan.type === 'slab-house' ? 0.3 : 0.15), walkZ - 0.12],
		[
			stations[stations.length - 1] - stations[0] + plan.bar,
			plan.type === 'slab-house' ? 0.6 : 0.24,
			0.12
		],
		site.ground,
		'deck'
	);
	const braces =
		z + crown.size[2] - site.ground >= 8
			? [brace(plan, site.id + '/roof/brace', stations, walkZ, z - 0.25, false)]
			: [];
	return {
		crown,
		parts: [
			...bearings(plan, site.id + '/walk', below, walkZ - 0.12, stations),
			walk,
			...bearings(plan, site.id + '/roof', walkZ, z - 0.25, stations),
			...braces,
			deck,
			mounted(crown, site.ground, 'crown')
		]
	};
}
function balanced(parts: Solid[], bodies: number, crown: number) {
	const total = parts.reduce((s, p) => s + volume(p.size), 0);
	const frame = (total - bodies - crown) / total;
	return bodies / total >= 0.55 && frame >= 0.2 && frame <= 0.35;
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
	const roofs = [false, true]
		.map((small) => roof(plan, below, top, stations, crownSpec(plan.type, small)))
		.filter(
			({ crown }) =>
				crown.size[0] <= plan.site.width &&
				crown.size[1] + (plan.site.compact ? 0 : 0.3) <=
					(plan.site.compact
						? Math.min(3.6, plan.site.depth)
						: plan.site.depth - plan.site.accessDepth) &&
				(role === 'high' || top + crown.size[2] <= skyline)
		);
	roofs.push(roof(plan, below, top, stations, ['charge-post', 'compact', 'lantern']));
	const bodies = levels.flatMap((l) => l.bodies).reduce((s, b) => s + volume(b.size), 0);
	for (const ratio of [0.3, 0.24, 0.36, 0.18, 0.42]) {
		const frame = levels.flatMap((l, i) => tierParts(plan, l, i, levels[i - 1], stations, ratio));
		for (const { crown, parts: cap } of roofs) {
			const parts = [...frame, ...cap];
			if (balanced(parts, bodies, volume(crown.size))) return { parts, crown };
		}
	}
	throw new RangeError('No balanced assembly for ' + plan.site.id + ' ' + plan.type);
}
