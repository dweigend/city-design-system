import { hashUnit } from '../../core/random';
import { cellsBetween, type TerrainCell, type TerrainGrid } from '../terrain-grid';
import { characters, centreMix } from './character';
import { planDistricts } from './districts';
import { planEnsembles } from './ensembles';
export { styleWeightsAt } from './districts';
export type CityPlan = ReturnType<typeof planCity>;
type Link = readonly [string, string];
const distance = (a: TerrainCell, b: TerrainCell) => Math.hypot(a.column - b.column, a.row - b.row);

// Extend the town by two to four blocks at a time, with room for an expansion area.
function expansionScore(
	grid: TerrainGrid,
	cell: TerrainCell,
	separation: number,
	reach: number,
	character: string
) {
	const edge = Math.min(
		cell.column,
		cell.row,
		grid.columns - 1 - cell.column,
		grid.rows - 1 - cell.row
	);
	const preferred =
		character === 'island' || character === 'eco-zone' ? 'floodplain' : 'lower-terrace';
	return (
		Math.min(separation, (reach * reach) / Math.max(1, separation)) *
		Math.min(1, edge / 10) *
		(cell.zone === preferred ? 1.2 : 1)
	);
}

function centreStops(
	grid: TerrainGrid,
	rail: Link,
	land: TerrainCell[],
	families: ReturnType<typeof characters>
) {
	const stops = rail.map((id) => {
		const stop = grid.cellsById.get(id);
		if (!stop?.buildable) throw new RangeError('Expected a buildable town station: ' + id);
		return stop;
	});
	const count = 2 + Math.floor(hashUnit(grid.terrain.seed, 'centre-count') * 3);
	const corridors: Link[] = [[...rail]];
	while (stops.length < count) {
		const family = families[stops.length];
		const reach = 24 + 24 * hashUnit(grid.terrain.seed, family.character, 'expansion-reach');
		let best = 0,
			candidate: TerrainCell | undefined,
			nearest = stops[0];
		for (const cell of land) {
			const close = stops.reduce((a, b) => (distance(a, cell) <= distance(b, cell) ? a : b));
			const score = expansionScore(grid, cell, distance(cell, close), reach, family.character);
			if (score <= best) continue;
			best = score;
			candidate = cell;
			nearest = close;
		}
		if (!candidate || best < 8) break;
		corridors.push([nearest.id, candidate.id]);
		stops.push(candidate);
	}
	return { stops, corridors };
}

function planCentre(
	grid: TerrainGrid,
	stop: TerrainCell,
	land: TerrainCell[],
	reserved: Set<string>,
	family: ReturnType<typeof characters>[number]
) {
	const nearby = land
		.filter((c) => !reserved.has(c.id) && distance(c, stop) <= 10)
		.sort((a, b) => distance(a, stop) - distance(b, stop) || a.index - b.index);
	const landmark = nearby.find((c) => distance(c, stop) >= 3);
	if (!landmark) throw new RangeError('No landmark site near ' + stop.id);
	const path = cellsBetween(grid, stop.id, landmark.id).map((c) => c.id);
	for (const id of path) reserved.add(id);
	return {
		cellId: stop.id,
		column: stop.column,
		row: stop.row,
		character: family.character,
		landmark: { cellId: landmark.id, object: family.landmark, variant: family.variant },
		path,

		towerShare: family.towerShare,
		weights: centreMix(grid.terrain.seed, stop.id, family.weights)
	};
}

/** Extends a surveyed valley town's two rail stops on dry land. Growth lots emit
 * nearest first in lattice cells, ties by row-major index. Occupied IDs are excluded
 * from new works. Missing station or landmark ground raises RangeError. */
export function planCity(
	grid: TerrainGrid,
	rail: Link,
	occupied: ReadonlySet<string>,
	walkOccupied: ReadonlySet<string> = occupied
) {
	const land = grid.cells.filter((c) => c.buildable && c.zone !== 'water' && !occupied.has(c.id));
	const families = characters(grid.terrain.seed);
	const { stops, corridors } = centreStops(grid, rail, land, families);
	const reserved = new Set([
		...occupied,
		...corridors.flatMap(([a, b]) => cellsBetween(grid, a, b).map((c) => c.id))
	]);
	const landmarks = stops.map((stop, i) => planCentre(grid, stop, land, reserved, families[i]));
	const { groups, walk, greens, planting } = planEnsembles(
		grid,
		stops,
		land,
		reserved,
		new Set([...walkOccupied, ...landmarks.map((c) => c.landmark.cellId)])
	);
	const centres = landmarks.map((centre, i) => ({
		...centre,
		green: { ...greens[i], planting: planting[i] },
		dominantProgramme: (['living', 'food', 'material', 'water', 'energy'] as const)[
			(i + Math.floor(hashUnit(grid.terrain.seed, 'district-programme') * 5)) % 5
		],
		ensembles: groups[i],
		lots: groups[i].flatMap((group) => group.lots)
	}));
	return { centres, corridors, walk, districts: planDistricts(grid, centres) };
}
