import { dockStock } from './dock-stock';
import { STORY } from '../../data/grid';
import { buildingPlots } from './building-plots';
import { capsulePitch, ringArea, moduleGroup, type HouseUse } from '../house-brush';
import type { QuadCell } from '../quad-grid';
import { rejected, type Proposal } from './installation-parts';
import type { World } from './world';

/** Places two suspended shells and one accent on the same carrier, or rejects the entire group. */
export function dockStroke(world: World, cells: QuadCell[], use: HouseUse): Proposal {
	const { rods, occupied } = dockStock(world);
	const ids = new Set(cells.map((c) => c.id));
	const selected = rods.filter((r) => ids.has(r.part.anchor.cellId));
	for (const owner of [...new Set(selected.map((r) => r.part.owner))].sort()) {
		const candidates = selected.filter(
			(r) =>
				r.part.owner === owner &&
				r.part.recipe === 'chord' &&
				!r.part.frame?.gate &&
				Math.abs(r.a[2] - r.b[2]) < 1e-8
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
