import { plantingClearance } from './planting-clearance';
import { courtReservations } from './court-reservations';
import { hashUnit } from '../../core/random';
import { type TerrainCell, type TerrainGrid } from '../terrain-grid';
import { inradius } from '../quad-grid';
import { bankCanopy, meadowTuft, type BankPlant } from './bank-flora';
import { walkingHeight } from './network-terrain';
import type { World } from './world-contract';

const candidates = new WeakMap<TerrainGrid, TerrainCell[]>();

function plantedEdge(cell: TerrainCell) {
	const slots = cell.landform;
	if (cell.bank?.lawn?.some((weight) => weight > 0.5)) return true;
	if (!slots || cell.zone === 'water') return false;
	if (slots.some((p) => p[0] > 0.32 && p[2] < 0.45)) return true;
	if (slots.some((p) => p[1] > 0.3)) return true;
	// The shoulders of a drainage channel can carry a grove even where a court
	// approach keeps the soil low. Leave the channel bottom open.
	const bed = slots.map((p) => p[2]);
	return Math.min(...bed) < 0.3 && Math.max(...bed) > 0.5;
}

function shoulders(grid: TerrainGrid) {
	const saved = candidates.get(grid);
	if (saved) return saved;
	const beds = grid.cells.filter(plantedEdge);
	candidates.set(grid, beds);
	return beds;
}

function occupied({ state }: World) {
	const city = state.city;
	return new Set([
		...(city?.walk.flat() ?? []),
		...courtReservations(city),
		...state.stacks.keys(),
		...state.lines.flatMap((l) => l.cellIds),
		...[...state.parts.values()].map((p) => p.anchor.cellId),
		...(state.spongeWorks ?? []).map((w) => w.cellId)
	]);
}

function rootLevel(grid: TerrainGrid, x: number, y: number, radius: number, ground: number) {
	const samples = [
		[x - radius, y],
		[x + radius, y],
		[x, y - radius],
		[x, y + radius]
	];
	return (
		Math.min(
			ground,
			...samples.map(([u, v]) => walkingHeight(grid, u, v)).filter(Number.isFinite)
		) - 0.12
	);
}

function groundHabit(world: World, cell: TerrainCell) {
	const lawn = world.state.cover.get(cell.id) === 'meadow' || cell.bank?.lawn?.some((w) => w > 0.5);
	const grass = hashUnit(world.seed, cell.id, 'bank-grass');
	const cover = hashUnit(world.seed, cell.id, 'coppice-height');
	return {
		tuft: (side: number) => (lawn && grass > 0.38) || (side === 1 && grass < 0.32),
		rise: (side: number) => {
			if (lawn) return 0.2 + 0.16 * cover;
			return side === 0 ? 0.72 + 0.56 * cover ** 2 : 0.64 + cover * 0.2;
		},
		slot: cover < 0.45 ? ('willow' as const) : ('foliage' as const)
	};
}

// The meadow alternates low shrubs with tussocks on the same planted shoulder.
function coppice(world: World, cell: TerrainCell): BankPlant[] {
	const r = Math.min(2.8, inradius(cell)) * 0.94;
	if (r < 0.85) return [];
	const [x, y] = cell.center;
	const theta = 2 * Math.PI * hashUnit(world.seed, cell.id, 'coppice-bearing');
	const habit = groundHabit(world, cell);
	const parts: BankPlant[] = [];
	for (const side of [0, 1]) {
		const dx = side * 0.5 * r * Math.cos(theta),
			dy = side * 0.5 * r * Math.sin(theta);
		const cx = x + dx,
			cy = y + dy,
			ground = walkingHeight(world.grid, cx, cy);
		const radius = r * (side === 0 ? 0.9 : 0.43);
		const id = 'bank-coppice/' + cell.id + '/' + side;
		if (!Number.isFinite(ground)) continue;
		if (habit.tuft(side)) {
			parts.push(meadowTuft(id, [cx, cy, ground - 0.08], Math.min(0.85, radius), theta + side));
			continue;
		}
		const height = radius * habit.rise(side);
		const base = rootLevel(world.grid, cx, cy, radius, ground);
		parts.push({
			kind: 'dome',
			slot: habit.slot,
			edges: false,
			id,
			position: [cx, cy, base],
			radius,
			height: height + ground - base
		});
	}
	return parts;
}

// Grove density follows the terrace in broad patches; individual trees vary within it.
function grove(world: World, cell: TerrainCell, r: number): BankPlant[] {
	const [x, y] = cell.center;
	const phase = hashUnit(world.seed, 'grove-phase') * 2 * Math.PI;
	if (Math.cos(x / 13 + phase) + Math.sin(y / 16 - phase) < -0.35) return [];
	const size = hashUnit(world.seed, cell.id, 'grove-size');
	const radius = Math.min(2.6, r * 0.79) * (0.76 + 0.24 * size);
	const bearing = 2 * Math.PI * hashUnit(world.seed, cell.id, 'grove-bearing');
	const cx = x + 0.16 * r * Math.cos(bearing),
		cy = y + 0.16 * r * Math.sin(bearing);
	const ground = walkingHeight(world.grid, cx, cy);
	if (!Number.isFinite(ground)) return [];
	return bankCanopy(
		'terrace-grove/' + cell.id,
		[cx, cy, ground],
		radius,
		bearing,
		hashUnit(world.seed, cell.id, 'grove-species')
	);
}

/** Projects planted bank volumes on the finished ground. Public circulation,
 * court reservations, built parcels and player forests retain their space. */
export function bankPlanting(world: World): BankPlant[] {
	if (!world.state.city) return [];
	const taken = occupied(world);
	const clear = plantingClearance(world);
	const parcels = new Set(shoulders(world.grid));
	for (const centre of world.state.city.centres)
		for (const id of centre.green?.planting ?? []) {
			const cell = world.grid.cellsById.get(id);
			if (cell && world.state.cover.get(id) === 'meadow') parcels.add(cell);
		}
	return [...parcels].flatMap((cell) => {
		const cover = world.state.cover.get(cell.id);
		if (
			cell.bank?.water !== undefined ||
			taken.has(cell.id) ||
			(cover && cover !== 'meadow') ||
			!cell.plantable
		)
			return [];
		const r = inradius(cell);
		if (!clear(cell.center[0], cell.center[1], r)) return [];
		const shrubs = coppice(world, cell);
		if (!shrubs.length) return [];
		return [...shrubs, ...grove(world, cell, r)];
	});
}
