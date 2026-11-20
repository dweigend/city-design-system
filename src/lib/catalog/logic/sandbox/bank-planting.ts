import { courtReservations } from './court-reservations';
import { hashUnit } from '../../core/random';
import { type TerrainCell, type TerrainGrid } from '../terrain-grid';
import { inradius } from '../quad-grid';
import type { Primitive } from '../parametrik/types';
import { walkingHeight } from './network-terrain';
import type { World } from './world-contract';

type Crown = Pick<
	Extract<Primitive, { kind: 'dome' }>,
	'id' | 'kind' | 'position' | 'radius' | 'height' | 'edges'
> & { slot: 'foliage' };

const candidates = new WeakMap<TerrainGrid, TerrainCell[]>();

function plantedEdge(cell: TerrainCell) {
	const slots = cell.landform;
	if (!slots || cell.zone === 'water') return false;
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

// Two overlapping, round crowns form a low bank thicket. Taller growth is
// limited to the broad central crown on parcels with more cover.
function coppice(world: World, cell: TerrainCell): Crown[] {
	const r = Math.min(2.8, inradius(cell)) * 0.94;
	if (r < 0.85) return [];
	const [x, y] = cell.center;
	const theta = 2 * Math.PI * hashUnit(world.seed, cell.id, 'coppice-bearing');
	const cover = hashUnit(world.seed, cell.id, 'coppice-height');
	const parts: Crown[] = [];
	for (const [i, side] of [0, 1].entries()) {
		const dx = side * 0.5 * r * Math.cos(theta),
			dy = side * 0.5 * r * Math.sin(theta);
		const cx = x + dx,
			cy = y + dy,
			ground = walkingHeight(world.grid, cx, cy);
		const radius = r * (side === 0 ? 0.9 : 0.43);
		const height = radius * (side === 0 ? 0.72 + 0.56 * cover ** 2 : 0.64 + cover * 0.2);
		if (!Number.isFinite(ground)) continue;
		const base = rootLevel(world.grid, cx, cy, radius, ground);
		parts.push({
			kind: 'dome',
			slot: 'foliage',
			edges: false,
			id: 'bank-coppice/' + cell.id + '/' + i,
			position: [cx, cy, base],
			radius,
			height: height + ground - base
		});
	}
	return parts;
}

/** Projects planted bank volumes on the finished ground. Public circulation,
 * court reservations, built parcels and player forests retain their space. */
export function bankPlanting(world: World): Crown[] {
	if (!world.state.city) return [];
	const taken = occupied(world);
	return shoulders(world.grid).flatMap((cell) => {
		const cover = world.state.cover.get(cell.id);
		if (
			cell.bank?.water !== undefined ||
			taken.has(cell.id) ||
			(cover && cover !== 'meadow') ||
			!cell.plantable
		)
			return [];
		return coppice(world, cell);
	});
}
