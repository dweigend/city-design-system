import { dockModule, type Bounds, type ModuleKind } from '../megastructure';
import type { Vec3 } from '../parametrik/types';
import type { HouseUse } from './stacks';
export type ModuleRod = { a: Vec3; b: Vec3; radius: number };
export type ModuleRecipe = 'capsule' | 'tank' | 'solar-ring' | 'garden' | 'workshop' | 'access';
const accent = {
	living: 'access',
	water: 'tank',
	energy: 'solar-ring',
	food: 'garden',
	material: 'workshop'
} as const;
const shapes: Record<ModuleRecipe, ModuleKind> = {
	capsule: 'capsule',
	tank: 'tank',
	'solar-ring': 'solar-ring',
	garden: 'garden',
	workshop: 'garden',
	access: 'garden'
};

/** Resolves a stored socket on the surface of a horizontal chord. */
export function atSocket(
	rod: ModuleRod,
	share: number,
	recipe: ModuleRecipe,
	occupied: Parameters<typeof dockModule>[2]
) {
	const sign = recipe === 'capsule' ? -1 : 1;
	const [x, y, z] = rod.a,
		[X, Y] = rod.b;
	return dockModule(
		shapes[recipe],
		{
			point: [x + (X - x) * share, y + (Y - y) * share, z + sign * rod.radius],
			normal: [0, 0, sign],
			tangent: [X - x, Y - y, 0]
		},
		occupied
	);
}

/** Finds three clear sockets within one bay of each other. The group is all or nothing. */
export function moduleGroup<R extends ModuleRod>(
	rods: R[],
	candidates: R[],
	use: HouseUse,
	stock: Bounds[]
) {
	const seats = candidates.flatMap((rod) => [0.5, 0.25, 0.75].map((share) => ({ rod, share })));
	const place = (seat: (typeof seats)[number], recipe: ModuleRecipe, bounds: Bounds[]) => {
		const m = atSocket(seat.rod, seat.share, recipe, [
			...bounds,
			...rods.filter((r) => r !== seat.rod)
		]);
		return m && { ...seat, recipe, m };
	};
	const nearby = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= 6;
	type Placement = NonNullable<ReturnType<typeof place>>;
	const complete = (first: Placement) => {
		const local = seats.filter((s) =>
			nearby(first.m.center, [
				s.rod.a[0] + (s.rod.b[0] - s.rod.a[0]) * s.share,
				s.rod.a[1] + (s.rod.b[1] - s.rod.a[1]) * s.share,
				0
			])
		);
		const bounds = [...stock, first.m.bounds];
		for (const next of local) {
			const second = place(next, 'capsule', bounds);
			if (!second) continue;
			for (const top of local) {
				const third = place(top, accent[use], [...bounds, second.m.bounds]);
				if (third && nearby(second.m.center, third.m.center)) return [first, second, third];
			}
		}
	};
	for (const seat of seats) {
		const first = place(seat, 'capsule', stock);
		const group = first && complete(first);
		if (group) return group;
	}
}
