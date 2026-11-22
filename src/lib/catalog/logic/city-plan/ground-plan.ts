import { required } from '../required';
import { boundaryRings } from '../quad-grid';
import type { CellPoint } from '../cell-space';
import type { Reservations } from '../occupancy';
import {
	surveyGroundRoutes,
	type GroundRoute,
	type TerrainCell,
	type TerrainGrid
} from '../terrain-grid';
import { surveyEnclosedCourts } from './ground-courts';
import {
	DEFAULT_PATH_CLEARANCE_M,
	groundCentre,
	groundPlots,
	type GroundPlot
} from './ground-districts';
import { groundPlanShape, type GroundRegime } from './ground-plan-shape';
import { surveyCentrePlaza } from './plaza';

const VERSION = 'ground-plan/2';
export type GroundPlanCell = Readonly<{
	id: string;
	corners: readonly [CellPoint, CellPoint, CellPoint, CellPoint];
	vertexIds: TerrainCell['vertexIds'];
	center: CellPoint;
	neighbors: TerrainCell['neighbors'];
	regime: GroundRegime;
	pattern: TerrainCell['pattern'];
	plot?: GroundPlot;
}>;

export type GroundArea = Readonly<
	{
		id: string;
		cellIds: readonly string[];
	} & (
		| { kind: 'buildable' }
		| { kind: 'path'; reserve: { kind: 'clearance'; clearanceM: number } }
		| { kind: 'court' | 'plaza' | 'gap'; reserve: { kind: 'open-to-sky' } }
	)
>;

export type GroundPlan = Readonly<{
	id: string;
	version: typeof VERSION;
	seed: number;
	terrainSeed: number;
	anchorId: string;
	boundary: ReturnType<typeof boundaryRings>;
	cells: readonly GroundPlanCell[];
	areas: readonly GroundArea[];
	reservations: Reservations;
	centres: readonly {
		regime: GroundRegime;
		cellId: string;
		weights: ReturnType<typeof groundCentre>['weights'];
	}[];
	routes: readonly (GroundRoute & { id: string })[];
}>;

function connectedLand(candidates: ReadonlyMap<string, TerrainCell>, start: TerrainCell) {
	const land = [start];
	const visited = new Set([start.id]);
	for (const { neighbors } of land) {
		for (const id of neighbors) {
			if (id === null || visited.has(id)) continue;
			const neighbor = candidates.get(id);
			if (!neighbor) continue;
			visited.add(id);
			land.push(neighbor);
		}
	}
	return land.sort((a, b) => a.index - b.index);
}

function planCell(
	{ id, corners, vertexIds, center, neighbors: [a, b, c, d], pattern }: TerrainCell,
	land: ReadonlyMap<string, TerrainCell>,
	regime: GroundRegime,
	plot?: GroundPlot
): GroundPlanCell {
	const retained = (neighbor: string | null) =>
		neighbor !== null && land.has(neighbor) ? neighbor : null;
	return {
		id,
		corners,
		vertexIds,
		center,
		neighbors: [retained(a), retained(b), retained(c), retained(d)],
		pattern,
		regime,
		...(plot ? { plot } : {})
	};
}

type Courts = ReturnType<typeof surveyEnclosedCourts>;

function frontedPlots(
	cells: readonly TerrainCell[],
	circulation: ReadonlySet<string>,
	courts: Courts
) {
	const built = new Set(courts.flatMap(({ enclosure }) => enclosure));
	for (const cell of cells)
		if (cell.neighbors.some((id) => id !== null && circulation.has(id))) built.add(cell.id);
	// The carrier's fronted parcels can continue across multiple cells behind the first row.
	const frontageParcels = new Set(
		cells.filter((c) => built.has(c.id) && c.buildable).map((c) => c.parcel)
	);
	const free = new Set([...circulation, ...courts.map(({ court }) => court)]);
	return cells.filter(
		(c) => !free.has(c.id) && (built.has(c.id) || (c.buildable && frontageParcels.has(c.parcel)))
	);
}

function groundAreas(
	id: string,
	cells: readonly TerrainCell[],
	paths: ReadonlySet<string>,
	plaza: ReadonlySet<string>,
	courts: Courts,
	plots: ReadonlyMap<string, GroundPlot>
): GroundArea[] {
	const areas: GroundArea[] = [
		{
			id: `${id}/path/network`,
			kind: 'path',
			cellIds: [...paths].sort(),
			reserve: { kind: 'clearance', clearanceM: DEFAULT_PATH_CLEARANCE_M }
		}
	];
	if (plaza.size)
		areas.push({
			id: `${id}/plaza/centre`,
			kind: 'plaza',
			cellIds: [...plaza].sort(),
			reserve: { kind: 'open-to-sky' }
		});
	for (const { block, court } of courts)
		areas.push({
			id: `${id}/court/${block}`,
			kind: 'court',
			cellIds: [court],
			reserve: { kind: 'open-to-sky' }
		});
	const reserved = new Set(areas.flatMap(({ cellIds }) => cellIds));
	for (const cell of cells) {
		if (reserved.has(cell.id)) continue;
		if (plots.has(cell.id))
			areas.push({ id: `${id}/plot/${cell.id}`, kind: 'buildable', cellIds: [cell.id] });
		else
			areas.push({
				id: `${id}/gap/${cell.id}`,
				kind: 'gap',
				cellIds: [cell.id],
				reserve: { kind: 'open-to-sky' }
			});
	}
	return areas;
}

/**
 * Derives the authoritative paths, courts, reserves and plots inside a dry terrain crop.
 * Use the returned boundary, centres and routes to compare seeds on the same grid and anchor.
 * Positions are world X/Y with Z up in meters. Cells are in carrier order and share the
 * grid's coordinate tuples. The result's boundaries, area lists and reservation map are
 * detached. Area members are ordered by cell ID. No input is mutated.
 * @throws {RangeError} If the seed is not a uint32 or the anchor is missing, raised or open.
 */
export function deriveGroundPlan(grid: TerrainGrid, anchorId: string, seed: number): GroundPlan {
	if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
		throw new RangeError('Expected an unsigned 32-bit plan seed');
	const anchor = grid.cellsById.get(anchorId);
	if (!anchor || anchor.raised || anchor.plan.open)
		throw new RangeError('Expected a dry plan anchor');
	const { candidates, lobes, regimes } = groundPlanShape(grid, anchor, seed);
	const cells = connectedLand(candidates, anchor);
	const land = new Map(cells.map((cell) => [cell.id, cell]));
	const centres = lobes.map((lobe) => groundCentre(cells, lobe, seed));
	const [dense, oldTown, detached] = centres.map(({ cell }) => cell);
	const square = surveyCentrePlaza(grid, dense, land, detached);
	const plaza = square?.cells ?? new Set<string>();
	const gate = square?.mouth ?? dense;
	const arterialStart = plaza.has(detached.id) ? gate.id : detached.id;
	const routes = surveyGroundRoutes(land, grid.profile, arterialStart, gate.id, oldTown.id, plaza);
	const paths = new Set(routes.flatMap(({ cellIds }) => cellIds));
	const circulation = new Set([...paths, ...plaza]);
	const oldTownLand = new Set(
		cells.filter(({ id }) => regimes.get(id) === 'old-town').map(({ id }) => id)
	);
	const courts = surveyEnclosedCourts(land, oldTownLand, paths, circulation);
	const plots = groundPlots(frontedPlots(cells, circulation, courts), regimes, dense, seed);
	const id = `${VERSION}/terrain/${grid.terrain.seed}/${anchorId}/${seed}`;
	const areas = groundAreas(id, cells, paths, plaza, courts, plots);

	return {
		id,
		version: VERSION,
		seed,
		terrainSeed: grid.terrain.seed,
		anchorId,
		boundary: boundaryRings(cells, (neighbor) => land.has(neighbor)),
		cells: cells.map((cell) =>
			planCell(cell, land, required(regimes.get(cell.id), 'ground district'), plots.get(cell.id))
		),
		areas,
		reservations: new Map(
			areas.flatMap((area) =>
				'reserve' in area ? area.cellIds.map((cellId) => [cellId, area.id] as const) : []
			)
		),
		centres: centres.map(({ cell, regime, weights }) => ({ cellId: cell.id, regime, weights })),
		routes: routes.map((route) => ({
			...route,
			id: `${id}/route/${route.kind === 'arterial' ? 'arterial' : route.cellIds.at(-1)}`
		}))
	};
}
