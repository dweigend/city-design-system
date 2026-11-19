import { ceramicContact, castingSeed } from './ceramic-fitting';
import { kanal } from '../traeger';
import { dockModule, type Bounds, type ModuleKind, type DockedModule } from '../megastructure';
import type { Vec3 } from '../parametrik/types';
import type { HouseUse } from './stacks';

export type ModuleRod = { a: Vec3; b: Vec3; radius: number };
export type ModuleRecipe =
	'capsule' | 'ceramic' | 'tank' | 'solar-ring' | 'garden' | 'workshop' | 'access';
const accents = {
	living: 'access',
	water: 'tank',
	energy: 'solar-ring',
	food: 'garden',
	material: 'workshop'
} as const;
const hardware: Record<Exclude<ModuleRecipe, 'capsule'>, ModuleKind> = {
	tank: 'tank',
	ceramic: 'ceramic',
	'solar-ring': 'solar-ring',
	garden: 'garden',
	workshop: 'garden',
	access: 'garden'
};
type Obstacles = Parameters<typeof dockModule>[2];
type Seat = {
	shell: DockedModule;
	accent?: DockedModule;
	profileSeed?: number;
	contactRing?: number;
};

/** A carrier site keeps the same water fitting across previews and rebuilds. */
export function waterFitting(seed: number, cellId: string) {
	return kanal(seed, 'raumfachwerk', cellId, 'water-fitting/v1') % 2 ? 'tank' : 'ceramic';
}

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
	pitch = 1.5,
	profileSeed = 0
): Seat | undefined {
	const dx = rod.b[0] - rod.a[0],
		dy = rod.b[1] - rod.a[1],
		dz = rod.b[2] - rod.a[2],
		run = Math.hypot(dx, dy),
		length = Math.hypot(run, dz);
	if (run < 1e-8) return;
	const sign = recipe === 'capsule' ? -1 : 1;
	const tangent: Vec3 = [-dy / run, dx / run, 0];
	const normal: Vec3 = [
		(-sign * dx * dz) / (run * length),
		(-sign * dy * dz) / (run * length),
		(sign * run) / length
	];
	const point: Vec3 = [
		rod.a[0] + dx * share + normal[0] * rod.radius,
		rod.a[1] + dy * share + normal[1] * rod.radius,
		rod.a[2] + dz * share + normal[2] * rod.radius
	];

	const shell = dockModule('capsule', { point, normal, tangent }, occupied, { pitch });
	if (!shell || recipe === 'capsule') return shell && { shell };
	// The fitting rests directly on the chord. Its rim seats into the adjacent round side.
	const direction = share <= 0.5 ? 1 : -1;
	const contact = recipe === 'ceramic' ? ceramicContact(profileSeed, pitch, direction) : undefined;
	const offset = contact?.offset ?? fittingOffset(recipe, pitch);
	const station = length * share + direction * offset;
	if (station < 0 || station > length) return;
	const joint: Vec3 = [
		point[0] + (direction * offset * dx) / length,
		point[1] + (direction * offset * dy) / length,
		point[2] + (direction * offset * dz) / length
	];
	const accent = dockModule(hardware[recipe], { point: joint, normal, tangent }, occupied);
	return accent && { shell, accent, profileSeed, contactRing: contact?.ring };
}

function fittingOffset(recipe: Exclude<ModuleRecipe, 'capsule'>, pitch: number) {
	if (recipe === 'tank') return 2 * Math.sqrt(pitch) - 0.08;
	if (recipe === 'solar-ring') return 1.25 + 2 * Math.sqrt(0.25 * pitch) - 0.008;
	return 1.5 + Math.sqrt(0.5 * (2 * pitch - 0.5)) - 0.008;
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
	pitch: number,
	site: { seed: number; cell: (rod: R) => string }
) {
	let attempts = 0;
	const seats = candidates.flatMap((rod) =>
		[0.5, 0.32, 0.68, 0.2, 0.8].map((share) => ({ rod, share }))
	);
	const accentFor = (rod: R, tankFallback: boolean) =>
		use === 'water' && !tankFallback ? waterFitting(site.seed, site.cell(rod)) : accents[use];
	const place = (s: (typeof seats)[number], recipe: ModuleRecipe, occupied: Bounds[]) => {
		const seat = atSocket(
			s.rod,
			s.share,
			recipe,
			[...occupied, ...rods.filter((r) => r !== s.rod)],
			pitch,
			castingSeed(site.seed, site.cell(s.rod))
		);
		return seat && { ...s, recipe, seat, pitch };
	};
	const fit = (
		group: NonNullable<ReturnType<typeof place>>[],
		bounds: Bounds[],
		tankFallback: boolean
	): typeof group | undefined => {
		if (group.length === 3) return group;
		for (const seat of seats) {
			if (++attempts > 512) return;
			const next = place(
				seat,
				group.length === 2 ? accentFor(seat.rod, tankFallback) : 'capsule',
				bounds
			);
			if (!next) continue;
			const [x, y] = next.seat.shell.center;
			if (
				group.some(
					(g) => Math.hypot(g.seat.shell.center[0] - x, g.seat.shell.center[1] - y) > pitch * 6
				)
			)
				continue;
			const result = fit([...group, next], [...bounds, ...socketBounds(next.seat)], tankFallback);
			if (result) return result;
		}
	};
	return fit([], stock, false) ?? (use === 'water' ? fit([], stock, true) : undefined);
}
