import { FRAME_DIAMETER, type Bounds } from '../megastructure';
import { atSocket, moduleGroup, stackTop, type HouseUse } from '../house-brush';
import type { Vec3 } from '../parametrik/types';
import type { QuadCell, QuadGrid } from '../quad-grid';
import { position, rejected, type BuiltPart, type Proposal } from './installation-parts';
import type { World } from './world';

type Rod = { part: BuiltPart; a: Vec3; b: Vec3; radius: number };
/** Returns the physical axis and section used by the solver and the docking survey. */
export function rodOf(grid: QuadGrid, part: BuiltPart): Rod | undefined {
	if (part.kind !== 'segment' || (part.recipe !== 'chord' && part.recipe !== 'brace')) return;
	return {
		part,
		a: position(grid, part.anchor),
		b: position(grid, part.end),
		radius: FRAME_DIAMETER[part.recipe === 'chord' ? 'main' : 'brace'] / 2
	};
}

function roofObstacles(world: World): Bounds[] {
	return [...world.state.stacks.keys()].flatMap((id) => {
		const c = world.grid.cellsById.get(id);
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
	const rods = [...world.state.parts.values()].flatMap((p) => rodOf(world.grid, p) ?? []);
	const occupied = roofObstacles(world);
	for (const p of world.state.parts.values()) {
		if (p.kind !== 'module') continue;
		const r = rods.find((r) => r.part.id === p.attachedTo);
		const m = r && atSocket(r, p.share, p.recipe, []);
		if (m) occupied.push(m.bounds);
	}
	const ids = new Set(cells.map((c) => c.id));
	const selected = rods.filter((r) => ids.has(r.part.anchor.cellId));
	for (const owner of new Set(selected.map((r) => r.part.owner))) {
		const candidates = selected.filter(
			(r) => r.part.owner === owner && r.part.recipe === 'chord' && Math.abs(r.a[2] - r.b[2]) < 1e-8
		);
		if (!candidates.length) continue;
		const group = moduleGroup(rods, candidates, use, occupied);
		if (group)
			return {
				owner,
				parts: group.map(({ rod, share, recipe }) => ({
					kind: 'module',
					recipe,
					anchor: rod.part.anchor,
					attachedTo: rod.part.id,
					share
				}))
			};
	}
	return rejected('no-dock-group', cells);
}
