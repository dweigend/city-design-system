import { compatibleGroup } from './socket-neighbors';
import { ceramicContact, castingSeed } from './ceramic-fitting';
import { roundPairContact, roundProfileContact } from '../profile-fit';
import { required } from '../required';
import { kanal } from '../traeger';
import { dockModule, type Bounds, type ModuleKind, type DockedModule } from '../megastructure';
import type { Vec3 } from '../parametrik/types';
import type { HouseUse } from './stacks';

export type ModuleRod = { a: Vec3; b: Vec3; radius: number };
export type SocketFit = 'profile-v1' | 'round-v0';
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
function waterFitting(seed: number, cellId: string) {
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
	profileSeed = 0,
	fit: SocketFit = 'profile-v1'
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
	const offset =
		fit === 'round-v0'
			? roundPairContact(pitch, recipe === 'tank' ? 1 : 1.5) - 0.08
			: (contact?.offset ?? fittingOffset(recipe, pitch));
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
	if (recipe === 'tank') return roundPairContact(pitch, 1) - 0.08;
	if (recipe === 'solar-ring') return 1.25 + roundPairContact(pitch, 0.25) - 0.008;
	return (
		required(
			roundProfileContact(pitch, [
				{ height: 0, reach: 1.5 },
				{ height: 0.5, reach: 1.5 }
			]),
			'side of docked tray'
		).offset - 0.008
	);
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
	const stations = [0.5, 0.32, 0.68, 0.2, 0.8];
	// Survey geometry once per station and recipe. The matching step only compares saved bounds.
	// Five stations cost at most 25 K2 calls per rod, including a ceramic-to-tank fallback.
	const entries = candidates.map((rod) => {
		const cell = site.cell(rod);
		return {
			rod,
			seed: castingSeed(site.seed, cell),
			preferred: use === 'water' ? waterFitting(site.seed, cell) : accents[use]
		};
	});
	function survey(mode: 'shell' | 'preferred' | 'fallback') {
		return entries.flatMap(({ rod, seed, preferred }) => {
			if (mode === 'fallback' && preferred !== 'ceramic') return [];
			const recipe: ModuleRecipe =
				mode === 'shell' ? 'capsule' : mode === 'preferred' ? preferred : 'tank';
			const obstacles = [...stock, ...rods.filter((other) => other !== rod)];
			return stations.flatMap((share) => {
				const seat = atSocket(rod, share, recipe, obstacles, pitch, seed);
				return seat ? [{ rod, share, pitch, recipe, seat, bounds: socketBounds(seat) }] : [];
			});
		});
	}
	const shells = survey('shell');
	if (shells.length < 2) return;
	return (
		compatibleGroup(shells, survey('preferred'), pitch) ??
		(use === 'water' ? compatibleGroup(shells, survey('fallback'), pitch) : undefined)
	);
}
