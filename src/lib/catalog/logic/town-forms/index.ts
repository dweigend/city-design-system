import { hash } from '../hash-random';
import type { HouseUse } from '../house-brush';
import { neighborsOf } from '../quad-grid';
import { bankDistance, terrainZone } from '../terrain';
import { BLOCK, MODULE, type TerrainCell, type TerrainGrid } from '../terrain-grid';
import { routeLine } from '../transit-line';

type HouseSite = Readonly<{ cellId: string; stories: readonly HouseUse[] }>;
type TownForms = Readonly<{
	runs: readonly (readonly HouseSite[])[];
	satellite: readonly HouseSite[];
	railCellIds: readonly [string, string];
}>;

const CHANNEL = { width: 0, gap: 1, step: 2, use: 3, hamletSize: 4 };
const BANK_OFFSETS = [18, 27]; // Meters inland of the surveyed bank.
const BANK_HALF_DEPTH = 7;
const OPEN_COLUMNS = 7;
const STATION_COLUMNS = 5;
const HAMLET_RADIUS = 3; // Lattice columns to either side, rows inland.
const MIN_HAMLET_SITES = 6;
const USES: readonly HouseUse[] = ['living', 'food', 'material', 'energy', 'water'];

function buildableLand(grid: TerrainGrid, reserved: ReadonlySet<string>) {
	return grid.cells.filter(
		(cell) => cell.buildable && cell.zone !== 'water' && !reserved.has(cell.id)
	);
}

function component(
	grid: TerrainGrid,
	root: TerrainCell,
	candidates: ReadonlySet<string>,
	limit: number
) {
	const reached = [root];
	const seen = new Set([root.id]);
	for (const cell of reached) {
		for (const next of neighborsOf(grid, cell)) {
			if (reached.length === limit) return reached;
			if (!candidates.has(next.id) || seen.has(next.id)) continue;
			seen.add(next.id);
			reached.push(next);
		}
	}
	return reached;
}

function runSites(grid: TerrainGrid, candidates: TerrainCell[]) {
	const remaining = new Set(candidates.map(({ id }) => id));
	let largest: TerrainCell[] = [];
	for (const site of candidates) {
		if (!remaining.has(site.id)) continue;
		const run = component(grid, site, remaining, candidates.length);
		run.forEach(({ id }) => remaining.delete(id));
		if (run.length > largest.length) largest = run;
	}
	return largest;
}

function bankRuns(grid: TerrainGrid, land: TerrainCell[], seed: number) {
	// Keep the chain in the middle reach of the near bank, outside the steep ground.
	const first = Math.floor(grid.columns * 0.43);
	const end = Math.floor(grid.columns * 0.72);
	const phase = Math.floor(hash(seed, 0, CHANNEL.step) * BANK_OFFSETS.length);
	const bank = land.filter(
		({ column, zone }) => column >= first && column < end && zone === 'floodplain'
	);
	const runs: TerrainCell[][] = [];
	for (let column = first, slot = 0; column < end; slot++) {
		const width = Math.floor(BLOCK.columns / 3 + hash(seed, slot, CHANNEL.width) * 3);
		const offset = BANK_OFFSETS[(slot + phase) % BANK_OFFSETS.length];
		const candidates = bank.filter(
			({ column: c, center: [x, y] }) =>
				c >= column &&
				c < column + width &&
				Math.abs(bankDistance(grid.terrain, x, y) - offset) <= BANK_HALF_DEPTH
		);
		const sites = runSites(grid, candidates);
		if (sites.length >= 3) runs.push(sites);
		column += width + 1 + Math.floor(hash(seed, slot, CHANNEL.gap) * 2);
	}
	return runs;
}

function runHouses(sites: TerrainCell[], use: HouseUse): HouseSite[] {
	const center = sites[Math.floor(sites.length / 2)];
	return sites.map(({ id, column }) => ({
		cellId: id,
		stories: Math.abs(column - center.column) <= 1 ? [use, 'living'] : [use]
	}));
}

function stations(grid: TerrainGrid, land: TerrainCell[], first: number) {
	const row = Math.ceil(grid.terrain.bands.terraceEdge / MODULE) + 2;
	return land
		.filter(
			(cell) =>
				cell.column >= first &&
				cell.column < first + STATION_COLUMNS &&
				cell.zone === 'lower-terrace' &&
				Math.abs(cell.row - row) <= 2
		)
		.sort(
			(a, b) =>
				Math.abs(a.row - row) - Math.abs(b.row - row) || a.column - b.column || a.index - b.index
		);
}

function hamlet(
	grid: TerrainGrid,
	land: TerrainCell[],
	station: TerrainCell,
	west: number,
	size: number
) {
	const nearby = land.filter(
		({ column, row, zone }) =>
			column >= west &&
			Math.abs(column - station.column) <= HAMLET_RADIUS &&
			row >= station.row &&
			row <= station.row + HAMLET_RADIUS &&
			zone === 'lower-terrace'
	);
	const lots = new Set(nearby.map(({ id }) => id));
	// Grow from the station forecourt, leaving the terminal itself free of houses.
	return component(grid, station, lots, size + 1).slice(1);
}

function isOverland(grid: TerrainGrid, cellIds: TownForms['railCellIds']) {
	const rail = routeLine(grid, { id: 'town-forms', kind: 'viaduct', cellIds });
	return rail?.path.every(([x, y]) => terrainZone(grid.terrain, x, y) !== 'water');
}

function satelliteLink(
	grid: TerrainGrid,
	land: TerrainCell[],
	first: number,
	west: number,
	seed: number
) {
	const townStops = stations(grid, land, first);
	const size = 10 + Math.floor(hash(seed, 0, CHANNEL.hamletSize) * 4);
	for (const stop of stations(grid, land, west)) {
		const sites = hamlet(grid, land, stop, west, size);
		if (sites.length < MIN_HAMLET_SITES) continue;
		const townStop = townStops.find(({ id }) => isOverland(grid, [id, stop.id]));
		if (townStop) return { sites, railCellIds: [townStop.id, stop.id] as const };
	}
}

function preferredLayout(grid: TerrainGrid, land: TerrainCell[], seed: number) {
	const runs = bankRuns(grid, land, seed);
	if (!runs.length) return;
	const first = Math.min(...runs[0].map(({ column }) => column));
	const east = Math.max(...runs.flat().map(({ column }) => column));
	const link = satelliteLink(grid, land, first, east + OPEN_COLUMNS, seed);
	if (link) return { runs, ...link };
}

function compactLayout(grid: TerrainGrid, land: TerrainCell[]) {
	const available = new Set(land.map(({ id }) => id));
	const stops = land
		.map((stop) => ({
			stop,
			lots: neighborsOf(grid, stop).filter(({ id }) => available.has(id))
		}))
		.filter(({ lots }) => lots.length);
	const towns = [...stops].sort(
		(a, b) => Number(b.stop.zone === 'floodplain') - Number(a.stop.zone === 'floodplain')
	);
	const satellites = stops.sort(
		(a, b) =>
			Number(b.stop.zone === 'lower-terrace') - Number(a.stop.zone === 'lower-terrace') ||
			b.stop.column - a.stop.column
	);
	for (const town of towns) {
		for (const satellite of satellites) {
			const layout = connectedLots(grid, town, satellite);
			if (layout) return layout;
		}
	}
}

type StopLots = { stop: TerrainCell; lots: TerrainCell[] };

function connectedLots(grid: TerrainGrid, town: StopLots, satellite: StopLots) {
	if (town.stop === satellite.stop) return;
	const railCellIds = [town.stop.id, satellite.stop.id] as const;
	for (const lot of town.lots) {
		if (lot === satellite.stop) continue;
		const site = satellite.lots.find((cell) => cell !== town.stop && cell !== lot);
		if (site && isOverland(grid, railCellIds)) {
			return { runs: [[lot]], sites: [site], railCellIds };
		}
	}
}

function hamletHouses(sites: TerrainCell[]): HouseSite[] {
	return sites.map(({ id }, index) => ({
		cellId: id,
		stories: index < 3 ? ['food', 'living'] : ['living']
	}));
}

/**
 * Plans a bank town and one rail-linked hamlet on a valley TerrainGrid. Unordered reserved
 * IDs (empty by default) exclude occupied or protected sites. Widths and gaps are in grid
 * columns, bank offsets in world meters. Returns detached construction data, or undefined
 * if no two stops can each serve a distinct adjacent lot and support an overland viaduct.
 * If the preferred bank runs and separated hamlet do not fit, a single lot per stop can suffice.
 *
 * Hashing reads the seed as u32. Addresses are the ascending run slot and the named decision
 * channel (step phase, use phase and hamlet size use slot 0); there is no shared draw cursor. Runs emit
 * west to east, with equal-sized footprints resolved by the grid's row-major order. Houses
 * within a footprint emit in side-neighbor traversal order, stories from ground to roof.
 * Rail IDs emit town first, hamlet second. The inputs are read only.
 */
export function planTownForms(
	grid: TerrainGrid,
	seed: number,
	reserved: ReadonlySet<string> = new Set()
): TownForms | undefined {
	const land = buildableLand(grid, reserved);
	const layout = preferredLayout(grid, land, seed) ?? compactLayout(grid, land);
	if (!layout) return;
	const { runs, sites, railCellIds } = layout;
	const usePhase = Math.floor(hash(seed, 0, CHANNEL.use) * USES.length);
	return {
		runs: runs.map((run, index) => runHouses(run, USES[(usePhase + index) % USES.length])),
		satellite: hamletHouses(sites),
		railCellIds
	};
}
