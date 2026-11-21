import { hashUnit } from '../../core/random';
import { valleyCoords, valleyPoint } from '../terrain';
import { cellId, MODULE, type TerrainCell, type TerrainGrid } from '../terrain-grid';

export const REGIMES = ['dense-centre', 'old-town', 'detached'] as const;
export type GroundRegime = (typeof REGIMES)[number];
type Point = readonly [number, number];

const REACH_M = 145;

function lobe(
	grid: TerrainGrid,
	anchor: TerrainCell,
	seed: number,
	regime: GroundRegime,
	i: number
) {
	const [along, across] = valleyCoords(grid.terrain, anchor.center[0], anchor.center[1]);
	const angle = 2 * Math.PI * (hashUnit(seed, 'district-rotation') + i / REGIMES.length);
	const reach = 25 + 26 * hashUnit(seed, regime, 'district-reach');
	const center = valleyPoint(
		grid.terrain,
		along + Math.cos(angle) * reach,
		across + Math.sin(angle) * reach
	);
	const [x, y] = valleyPoint(grid.terrain, along + MODULE, across);
	const heading = Math.atan2(y - anchor.center[1], x - anchor.center[0]);
	return {
		regime,
		center,
		alongRadius: 39 + 25 * hashUnit(seed, regime, 'district-length'),
		acrossRadius: 39 + 22 * hashUnit(seed, regime, 'district-depth'),
		heading: heading + (hashUnit(seed, regime, 'district-tilt') - 0.5) * 1.4
	};
}

function normalizedDistance(point: Point, shape: ReturnType<typeof lobe>) {
	const x = point[0] - shape.center[0];
	const y = point[1] - shape.center[1];
	const cos = Math.cos(shape.heading);
	const sin = Math.sin(shape.heading);
	return (
		((x * cos + y * sin) / shape.alongRadius) ** 2 + ((y * cos - x * sin) / shape.acrossRadius) ** 2
	);
}

/** Selects dry land in seeded world-meter lobes and orders the district targets by regime. */
export function groundPlanShape(grid: TerrainGrid, anchor: TerrainCell, seed: number) {
	const lobes = REGIMES.map((regime, i) => lobe(grid, anchor, seed, regime, i));
	const reach = Math.ceil(REACH_M / MODULE);
	const candidates = new Map<string, TerrainCell>();
	const regimes = new Map<string, GroundRegime>();
	for (
		let row = Math.max(0, anchor.row - reach);
		row <= Math.min(grid.rows - 1, anchor.row + reach);
		row++
	) {
		for (
			let col = Math.max(0, anchor.column - reach);
			col <= Math.min(grid.columns - 1, anchor.column + reach);
			col++
		) {
			const cell = grid.cellsById.get(cellId(col, row));
			if (!cell || cell.plan.open || cell.raised) continue;
			const point: Point = [cell.center[0], cell.center[1]];
			const distances = lobes.map((shape) => normalizedDistance(point, shape));
			const minimum = Math.min(...distances);
			if (minimum > 1 && cell !== anchor) continue;
			candidates.set(cell.id, cell);
			regimes.set(cell.id, REGIMES[distances.indexOf(minimum)]);
		}
	}
	return { candidates, regimes, lobes };
}
