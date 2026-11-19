import { STORY } from '../../data/grid';
import { buildingPlots } from './building-plots';
import { type Bounds } from '../megastructure';
import {
	socketBounds,
	capsulePitch,
	ringArea,
	moduleGroup,
	stackTop,
	type HouseUse
} from '../house-brush';
import type { QuadCell } from '../quad-grid';
import { savedSocket, rodOf, rejected, type Proposal } from './installation-parts';
import type { World } from './world';

function roofObstacles(world: World): Bounds[] {
	return [...world.state.stacks.keys()].flatMap((id) => {
		const c = buildingPlots(world.grid).cellsById.get(id);
		if (!c) return [];
		const xs = c.corners.map((p) => p[0]),
			ys = c.corners.map((p) => p[1]);
		return [
			{
				min: [Math.min(...xs), Math.min(...ys), Math.min(...c.corners.map((p) => p[2]))],
				max: [Math.max(...xs), Math.max(...ys), stackTop(world.state.stacks, c)]
			}
		];
	});
}

/** Places two suspended shells and one accent on the same carrier, or rejects the entire group. */
export function dockStroke(world: World, cells: QuadCell[], use: HouseUse): Proposal {
	const rods = [...world.state.parts.values()].flatMap(
		(p) => rodOf(buildingPlots(world.grid), p) ?? []
	);
	const occupied = roofObstacles(world);
	for (const p of world.state.parts.values()) {
		if (p.kind !== 'module') continue;
		const r = rods.find((r) => r.part.id === p.attachedTo);
		const m = r && savedSocket(r, p, world.seed);
		if (m) occupied.push(...socketBounds(m));
	}
	const ids = new Set(cells.map((c) => c.id));
	const selected = rods.filter((r) => ids.has(r.part.anchor.cellId));
	for (const owner of [...new Set(selected.map((r) => r.part.owner))].sort()) {
		const candidates = selected.filter(
			(r) => r.part.owner === owner && r.part.recipe === 'chord' && Math.abs(r.a[2] - r.b[2]) < 1e-8
		);
		if (!candidates.length) continue;
		const plots = buildingPlots(world.grid);
		const area = Math.max(
			...candidates.map((r) => {
				const c = plots.cellsById.get(r.part.anchor.cellId);
				return c ? Math.abs(ringArea(c.corners.map(([x, y]) => [x, y]))) : 0;
			})
		);
		candidates.sort((a, b) => a.part.id.localeCompare(b.part.id, 'en', { numeric: true }));
		const group = moduleGroup(rods, candidates, use, occupied, capsulePitch(area * STORY), {
			seed: world.seed,
			cell: (r) => r.part.anchor.cellId
		});
		if (group)
			return {
				owner,
				parts: group.map(({ rod, share, recipe, pitch }) => ({
					kind: 'module',
					fit: 'profile-v1',
					recipe,
					anchor: rod.part.anchor,
					attachedTo: rod.part.id,
					pitch,
					share
				}))
			};
	}
	return rejected('no-dock-group', cells);
}
