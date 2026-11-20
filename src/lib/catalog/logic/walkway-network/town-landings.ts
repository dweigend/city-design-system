import { landingBase } from './retaining-foot';
import { publicPaving } from './town-floor';
import { houseSurfaces } from '../composed-house';
import { bounds, union } from '../ansicht/geometrie';
import { required } from '../required';
import type { Primitive, Vec3 } from '../parametrik/types';
import { available, fitting, mountFitting, type Reservation } from './town-scatter';
import type { TownSpan } from './town-stations';

const apart = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** Horizontal space occupied by a projected fitting, in metres. */
export function reservations(parts: Primitive[]): Reservation[] {
	const groups = new Map<string, Primitive[]>();
	for (const p of parts) {
		const key = p.id.slice(0, p.id.lastIndexOf('/'));
		const list = groups.get(key) ?? [];
		list.push(p);
		groups.set(key, list);
	}
	return [...groups.values()].map((list) => {
		const { min, max } = union(list.map(bounds));
		return {
			x: (min[0] + max[0]) / 2,
			y: (min[1] + max[1]) / 2,
			w: max[0] - min[0],
			d: max[1] - min[1]
		};
	});
}
type Site = { id: string; position: Vec3; radius?: number };
/** Coalesces coincident stair landings and leaves terminal meetings on their terraces. */
export function meetingSites(spans: TownSpan[], ends: Vec3[]) {
	const sites: Site[] = [];
	for (const { id, a, b } of spans.filter(({ a, b }) => a[2] !== b[2])) {
		for (const [i, p] of [a, b].entries()) {
			if (ends.some((q) => apart(p, q) < 1e-6 && p[2] === q[2])) continue;
			if (sites.some((s) => p[2] === s.position[2] && apart(p, s.position) <= 0.02)) continue;
			sites.push({ id: id + '/end/' + i, position: p });
		}
	}
	return sites;
}
function seat(p: Vec3, taken: Reservation[]) {
	const [w, d] = fitting('kit-scatter-group-3').footprint;
	for (const r of [0, 0.45, 0.9, 1.35, 1.8, 2.25, 2.7])
		for (let i = 0; i < 16; i++) {
			const x = p[0] + r * Math.cos((i * Math.PI) / 8),
				y = p[1] + r * Math.sin((i * Math.PI) / 8);
			const box = { x, y, w, d };
			if (available(box, taken)) return { box, r };
		}
}
/** Seats a rigid graphite group at each stair landing on a ground-supported platform. */
export function meetingPlatforms(
	sites: Site[],
	taken: Reservation[],
	seed: number,
	ground: (x: number, y: number) => number
) {
	return sites.flatMap(({ id, position: p, radius = 0 }) => {
		const { box, r } = required(seat(p, taken), 'clear meeting platform at ' + id);
		taken.push(box);
		const [x, y, z] = p;
		const key = 'town-walk/platform/' + id;
		const reach = Math.max(radius, r + Math.hypot(box.w, box.d) / 2 + 0.06);
		const foot = landingBase(p, reach, ground);
		const bottom = foot ?? z - 0.2;
		const plate: Primitive = {
			kind: 'cylinder',
			id: key,
			role: 'neu',
			...publicPaving,
			position: [x, y, bottom],
			height: z - bottom,
			radius: reach
		};
		const base = ground(x, y);
		const pier: Primitive[] =
			foot === undefined && base < z - 0.2
				? [
						{
							kind: 'cylinder',
							id: key + '/pier',
							role: 'neu',
							material: 'metal',
							...houseSurfaces.frame,
							position: [x, y, base],
							height: z - 0.2 - base,
							radius: 0.23
						}
					]
				: [];
		return [
			plate,
			...pier,
			...mountFitting(
				'kit-scatter-group-3',
				'loose-knot',
				[box.x, box.y, z],
				key + '/meeting',
				seed
			)
		];
	});
}
