import { hashUnit } from '../../core/random';
import { required } from '../required';
import { inradius } from '../quad-grid';
import type { TerrainCell } from '../terrain-grid';
import { centreMix, centreFamily } from './character';
import type { GroundRegime } from './ground-plan-shape';

export const DEFAULT_PATH_CLEARANCE_M = 3.7;
const TOWER_SEPARATION_M = 15.5;

export type GroundPlot =
	| { kind: 'house'; setbackM: number }
	| { kind: 'perimeter'; eaveZ: number }
	| { kind: 'podium' }
	| { kind: 'tower' };

const families = {
	'dense-centre': 'metropolitan',
	'old-town': 'village',
	detached: 'eco-zone'
} as const;

const groundDistance = (a: readonly number[], b: readonly number[]) =>
	Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Resolves a seeded district target to dry carrier ground with stable tie-breaking. */
export function groundCentre(
	cells: readonly TerrainCell[],
	{ center, regime }: { center: readonly [number, number]; regime: GroundRegime },
	seed: number
) {
	const siting = (cell: TerrainCell) =>
		groundDistance(cell.center, center) +
		(regime === 'dense-centre' && cell.pattern === 'contour' ? 8 : 0);
	const cell = cells.reduce((a, b) => (siting(a) <= siting(b) ? a : b));
	return {
		regime,
		cell,
		weights: centreMix(seed, cell.id, centreFamily(families[regime]).weights)
	};
}

function towerSites(
	cells: readonly TerrainCell[],
	regimes: ReadonlyMap<string, GroundRegime>,
	dense: TerrainCell,
	seed: number
) {
	const towerCount = 3 + Math.floor(3 * hashUnit(seed, 'centre-tower-count'));
	const candidates = cells
		.filter((cell) => regimes.get(cell.id) === 'dense-centre')
		.sort(
			(a, b) =>
				groundDistance(a.center, dense.center) - groundDistance(b.center, dense.center) ||
				a.index - b.index
		);
	const towers: TerrainCell[] = [];
	for (const cell of candidates) {
		if (towers.length === towerCount) break;
		if (towers.every((tower) => groundDistance(cell.center, tower.center) >= TOWER_SEPARATION_M))
			towers.push(cell);
	}
	return new Set(towers.map(({ id }) => id));
}

/** Assigns the three building patterns to buildable plots and leaves detached gaps open. */
export function groundPlots(
	cells: readonly TerrainCell[],
	regimes: ReadonlyMap<string, GroundRegime>,
	dense: TerrainCell,
	seed: number
) {
	const plots = new Map<string, GroundPlot>();
	const eaveM = [9.6, 10.2, 10.8][Math.floor(3 * hashUnit(seed, 'old-town-eave'))];
	let oldTownBaseZ = -Infinity;
	for (const cell of cells)
		if (regimes.get(cell.id) === 'old-town') oldTownBaseZ = Math.max(oldTownBaseZ, cell.pad);
	const eaveZ = oldTownBaseZ + eaveM;
	const towerIds = towerSites(cells, regimes, dense, seed);
	for (const cell of cells) {
		switch (required(regimes.get(cell.id), 'plot district')) {
			case 'detached':
				if (hashUnit(seed, cell.id, 'pocket-garden') >= 0.24)
					plots.set(cell.id, {
						kind: 'house',
						setbackM: Math.min(
							1.45 + 0.6 * hashUnit(seed, cell.id, 'house-setback'),
							0.6 * inradius(cell)
						)
					});
				break;
			case 'old-town':
				plots.set(cell.id, { kind: 'perimeter', eaveZ });
				break;
			case 'dense-centre':
				plots.set(cell.id, { kind: towerIds.has(cell.id) ? 'tower' : 'podium' });
				break;
		}
	}
	return plots;
}
