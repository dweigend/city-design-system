import type { Vec3 } from '../parametrik/types';
import { circulation } from './circulation';
import { houseObject, type HousePart } from './house-object';
import type { Section } from './types';
import type { HouseSurfaces } from './surfaces';

type Leg = ReturnType<typeof circulation>['legs'][number];

function projectLeg(
	leg: Leg,
	id: string,
	width: number,
	seed: number,
	surfaces: HouseSurfaces
): HousePart[] {
	const [a, b] = leg.from[2] >= leg.to[2] ? [leg.from, leg.to] : [leg.to, leg.from];
	const dx = b[0] - a[0],
		dy = b[1] - a[1],
		dz = b[2] - a[2],
		length = Math.hypot(dx, dy);
	if (length < 1e-8) return [];
	const angle = Math.atan2(dy, dx);
	const point = (t: number, offset = 0, up = 0): Vec3 => [
		a[0] + dx * t - (dy * offset) / length,
		a[1] + dy * t + (dx * offset) / length,
		a[2] + dz * t + up
	];
	const slots = { deck: surfaces.access, frame: surfaces.frame, body: surfaces.frame };
	const object = (name: string, variant = 'standard') =>
		houseObject(name, variant, seed, {
			instanceId: id + '/' + name,
			slots: Object.fromEntries(
				(name === 'stairs' ? ['deck', 'body'] : name === 'railing' ? ['frame'] : ['deck']).map(
					(k) => [k, slots[k as keyof typeof slots]]
				)
			)
		}).parts;
	if (leg.kind === 'landing' || (leg.kind === 'ramp' && Math.abs(dz) < 1e-8)) {
		const p = object('landing')[0];
		if (p.kind !== 'prism') throw new Error('Expected landing plate');
		return [
			{
				...p,
				polygon: p.polygon.map(([x, y]) => {
					const [u, v] = point(x + 0.5, y * width);
					return [u, v];
				}),
				z: a[2] - p.height
			}
		];
	}
	const rails = [-1, 1].flatMap((side) =>
		object('railing').map((p) => {
			if (p.kind !== 'pipe') throw new Error('Expected rail');
			return {
				...p,
				id: p.id + '/' + side,
				points: p.points.map(([t, , h]) => point(t, side * width * 0.46, h))
			};
		})
	);
	if (leg.kind === 'ramp') {
		const p = object('ramp')[0];
		if (p.kind !== 'wedge') throw new Error('Expected ramp');
		const [x, y] = point(0.5);
		return [
			{
				...p,
				position: [x - length / 2, y - width / 2, b[2]],
				size: [length, width, -dz],
				rotation: angle
			},
			...rails
		];
	}
	const p = object('stairs', 'single-tread')[0];
	if (p.kind !== 'box') throw new Error('Expected stair tread');
	const run = length / leg.steps,
		rise = -dz / leg.steps;
	const steps = Array.from({ length: leg.steps }, (_, i): HousePart => {
		const [x, y] = point((i + 0.5) / leg.steps);
		return {
			...p,
			id: p.id + '/' + i,
			position: [x - run / 2, y - width / 2, a[2] - (i + 1) * rise],
			size: [run, width, rise],
			rotation: angle
		};
	});
	return [...steps, ...rails];
}

/** Fits registered circulation members to each segment of the surveyed route. */
export function access(s: Section, surfaces: HouseSurfaces) {
	const { legs, width } = circulation(s);
	return legs.flatMap((leg, i) => projectLeg(leg, s.id + '/stair/' + i, width, s.seed, surfaces));
}
