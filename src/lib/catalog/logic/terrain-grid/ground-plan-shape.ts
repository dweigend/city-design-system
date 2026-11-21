import { hash } from '../../core/random';
import { MODULE } from './contour-rows';
import { cellId, type TerrainCell, type TerrainGrid } from './types';

const LOBES = [
	{ alongM: 0, acrossM: 0, radiusAlongM: 56, radiusAcrossM: 53 },
	{ alongM: -40, acrossM: -24, radiusAlongM: 41, radiusAcrossM: 37 },
	{ alongM: 36, acrossM: 29, radiusAlongM: 40, radiusAcrossM: 40 }
] as const;
const DRAW = { shiftAlong: 0, shiftAcross: 1, radiusAlong: 2, radiusAcross: 3 };
const VARIATION_M = 8;

function seededLobes(seed: number) {
	const delta = (lobe: number, channel: number) =>
		(2 * hash(seed, lobe, channel) - 1) * VARIATION_M;
	return LOBES.map((lobe, key) => ({
		alongM: lobe.alongM + delta(key, DRAW.shiftAlong),
		acrossM: lobe.acrossM + delta(key, DRAW.shiftAcross),
		radiusAlongM: lobe.radiusAlongM + delta(key, DRAW.radiusAlong),
		radiusAcrossM: lobe.radiusAcrossM + delta(key, DRAW.radiusAcross)
	}));
}

/** Crops a multi-lobed settlement in the terrain's nominal valley lattice (meters). */
export function groundPlanCandidates(grid: TerrainGrid, anchor: TerrainCell, seed: number) {
	const lobes = seededLobes(seed);
	const reach = Math.ceil(
		Math.max(
			...lobes.map((lobe) =>
				Math.max(
					Math.abs(lobe.alongM) + lobe.radiusAlongM,
					Math.abs(lobe.acrossM) + lobe.radiusAcrossM
				)
			)
		) / MODULE
	);
	const cells = new Map<string, TerrainCell>();
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
			const alongM = (col - anchor.column) * MODULE;
			const acrossM = (row - anchor.row) * MODULE;
			if (
				lobes.some(
					(lobe) =>
						((alongM - lobe.alongM) / lobe.radiusAlongM) ** 2 +
							((acrossM - lobe.acrossM) / lobe.radiusAcrossM) ** 2 <=
						1
				)
			) {
				cells.set(cell.id, cell);
			}
		}
	}
	return cells;
}
