import { dockModule, type Bounds, type ModuleKind, type DockedModule } from '../megastructure';
import type { Vec3 } from '../parametrik/types';
import type { HouseUse } from './stacks';

export type ModuleRod = { a: Vec3; b: Vec3; radius: number };
export type ModuleRecipe = 'capsule' | 'tank' | 'solar-ring' | 'garden' | 'workshop' | 'access';
const accents = {
	living: 'access',
	water: 'tank',
	energy: 'solar-ring',
	food: 'garden',
	material: 'workshop'
} as const;
const hardware: Record<Exclude<ModuleRecipe, 'capsule'>, ModuleKind> = {
	tank: 'tank',
	'solar-ring': 'solar-ring',
	garden: 'garden',
	workshop: 'garden',
	access: 'garden'
};
type Obstacles = Parameters<typeof dockModule>[2];
type Seat = { shell: DockedModule; accent?: DockedModule };

/** Scale three round-ended shells to at least the given story volume in cubic meters. */
export function capsulePitch(volume: number) {
	const nominal = Math.PI * (2 + 4 / 3);
	return Math.max(1.5, Math.ceil(Math.cbrt(volume / (3 * nominal)) * 100) / 100);
}

/** Two shells hang below a chord; the third shares its upper seat with its attached fitting. */
export function atSocket(
	rod: ModuleRod,
	share: number,
	recipe: ModuleRecipe,
	occupied: Obstacles,
	pitch = 1.5
): Seat | undefined {
	const dx = rod.b[0] - rod.a[0],
		dy = rod.b[1] - rod.a[1],
		length = Math.hypot(dx, dy);
	if (length < 1e-8) return;
	const sign = recipe === 'capsule' ? -1 : 1;
	const point: Vec3 = [rod.a[0] + dx * share, rod.a[1] + dy * share, rod.a[2] + sign * rod.radius];
	const normal: Vec3 = [0, 0, sign],
		tangent: Vec3 = [-dy / length, dx / length, 0];
	const shell = dockModule('capsule', { point, normal, tangent }, occupied, { pitch });
	if (!shell || recipe === 'capsule') return shell && { shell };
	// The fitting rests directly on the chord. Its rim seats into the adjacent round side.
	const radius = recipe === 'tank' ? 1 : 1.5;
	const offset = 2 * Math.sqrt(radius * pitch) - 0.08;
	const direction = share <= 0.5 ? 1 : -1;
	const station = length * share + direction * offset;
	if (station < 0 || station > length) return;
	const joint: Vec3 = [
		point[0] + (direction * offset * dx) / length,
		point[1] + (direction * offset * dy) / length,
		point[2]
	];
	const accent = dockModule(hardware[recipe], { point: joint, normal, tangent }, occupied);
	return accent && { shell, accent };
}

/** Occupied volumes include both the shell and its optional fitting. */
export function socketBounds(seat: Seat): Bounds[] {
	return seat.accent ? [seat.shell.bounds, seat.accent.bounds] : [seat.shell.bounds];
}

/** Returns an entire three-shell group on adjacent chord seats, or leaves all seats free. */
export function moduleGroup<R extends ModuleRod>(
	rods: R[],
	candidates: R[],
	use: HouseUse,
	stock: Bounds[],
	pitch = 1.5
) {
	const seats = candidates.flatMap((rod) =>
		[0.5, 0.32, 0.68, 0.2, 0.8].map((share) => ({ rod, share }))
	);
	const place = (s: (typeof seats)[number], recipe: ModuleRecipe, occupied: Bounds[]) => {
		const seat = atSocket(
			s.rod,
			s.share,
			recipe,
			[...occupied, ...rods.filter((r) => r !== s.rod)],
			pitch
		);
		return seat && { ...s, recipe, seat, pitch };
	};
	const fit = (
		group: NonNullable<ReturnType<typeof place>>[],
		bounds: Bounds[]
	): typeof group | undefined => {
		if (group.length === 3) return group;
		for (const seat of seats) {
			const next = place(seat, group.length === 2 ? accents[use] : 'capsule', bounds);
			if (!next) continue;
			const [x, y] = next.seat.shell.center;
			if (
				group.some(
					(g) => Math.hypot(g.seat.shell.center[0] - x, g.seat.shell.center[1] - y) > pitch * 6
				)
			)
				continue;
			const result = fit([...group, next], [...bounds, ...socketBounds(next.seat)]);
			if (result) return result;
		}
	};
	return fit([], stock);
}
