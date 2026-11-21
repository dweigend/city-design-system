import { boundaryRings } from '../quad-grid';
import { groundPlanCandidates } from './ground-plan-shape';
import { groundPlanUses, type GroundUse } from './ground-plan-use';
import type { TerrainCell, TerrainGrid } from './types';

const VERSION = 'ground-plan/1';

type GroundPoint = Readonly<TerrainCell['center']>;
type GroundPlanCell = Readonly<{
	id: string;
	corners: readonly [GroundPoint, GroundPoint, GroundPoint, GroundPoint];
	vertexIds: TerrainCell['vertexIds'];
	center: GroundPoint;
	neighbors: TerrainCell['neighbors'];
}>;

function component(
	cells: ReadonlyMap<string, TerrainCell>,
	start: TerrainCell,
	includes: (id: string) => boolean
) {
	const queue = [start];
	const visited = new Set([start.id]);
	for (const { neighbors } of queue) {
		for (const id of neighbors) {
			if (id === null || visited.has(id) || !includes(id)) continue;
			const neighbor = cells.get(id);
			if (!neighbor) continue;
			visited.add(id);
			queue.push(neighbor);
		}
	}
	return queue;
}

function groundAreas(
	planId: string,
	cells: readonly TerrainCell[],
	uses: ReadonlyMap<string, GroundUse>
) {
	const byId = new Map(cells.map((cell) => [cell.id, cell]));
	const seen = new Set<string>();
	return cells.flatMap((cell) => {
		const kind = uses.get(cell.id);
		if (!kind || seen.has(cell.id)) return [];
		const members = component(byId, cell, (id) => uses.get(id) === kind);
		const cellIds = members.map(({ id }) => id).sort();
		for (const id of cellIds) seen.add(id);
		return [{ id: `${planId}/${kind}/${cellIds[0]}`, kind, cellIds }];
	});
}

function planCell(
	{ id, corners, vertexIds, center, neighbors: [a, b, c, d] }: TerrainCell,
	active: ReadonlySet<string>
): GroundPlanCell {
	const retained = (neighbor: string | null) =>
		neighbor !== null && active.has(neighbor) ? neighbor : null;
	return {
		id,
		corners,
		vertexIds,
		center,
		neighbors: [retained(a), retained(b), retained(c), retained(d)]
	};
}

/**
 * Derives the seeded ground plan rooted at a dry carrier cell. The seed is read as u32.
 * Cell corners and centers reference the source grid's world X/Y and up Z, in meters.
 * Boundary rings are detached XY, with positive winding for exteriors and negative for holes.
 * Incidence is inherited from the carrier; only the anchor's connected component is kept.
 * Cells and area emission follow carrier index; area membership is ordered by stable cell ID.
 * Throws RangeError for an absent or unsuitable anchor. The grid is never mutated.
 */
export function deriveGroundPlan(grid: TerrainGrid, anchorId: string, seed: number) {
	const anchor = grid.cellsById.get(anchorId);
	if (!anchor || anchor.raised || anchor.plan.open)
		throw new RangeError('Expected a dry plan anchor');
	const planSeed = seed >>> 0;
	const candidates = groundPlanCandidates(grid, anchor, planSeed);
	const cells = component(candidates, anchor, (id) => candidates.has(id)).sort(
		(a, b) => a.index - b.index
	);
	const active = new Set(cells.map(({ id }) => id));
	const id = `${VERSION}/terrain/${grid.terrain.seed}/${anchorId}/${planSeed}`;
	return {
		id,
		version: VERSION,
		seed: planSeed,
		anchorId,
		boundary: boundaryRings(cells, (neighbor) => active.has(neighbor)),
		cells: cells.map((cell) => planCell(cell, active)),
		areas: groundAreas(id, cells, groundPlanUses(cells, anchor, planSeed))
	};
}
