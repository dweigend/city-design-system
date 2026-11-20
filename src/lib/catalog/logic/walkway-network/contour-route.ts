import type { TerrainGrid, TerrainCell } from '../terrain-grid';
import { required } from '../required';

function climb(a: TerrainCell, b: TerrainCell) {
	const rise = b.center[2] - a.center[2];
	return (rise * rise) / Math.hypot(b.center[0] - a.center[0], b.center[1] - a.center[1]);
}
/** Moves a two-hop bend to the gentler free side of its mesh cell pair.
 * Both endpoints, hop count, dry-land reservations and stable tie order are preserved. */
export function contourRoute(grid: TerrainGrid, path: string[], blocked: Set<string>) {
	const used = new Set(path);
	const cell = (id: string) => required(grid.cellsById.get(id), 'route cell');
	for (let i = 1; i < path.length - 1; i++) {
		const a = cell(path[i - 1]),
			b = cell(path[i + 1]),
			middle = cell(path[i]);
		let best = climb(a, middle) + climb(middle, b);
		for (const id of a.neighbors) {
			if (!id || blocked.has(id) || used.has(id) || !b.neighbors.includes(id)) continue;
			const candidate = cell(id),
				score = climb(a, candidate) + climb(candidate, b);
			if (candidate.zone === 'water' || score >= best - 1e-8) continue;
			used.delete(path[i]);
			used.add(id);
			path[i] = id;
			best = score;
		}
	}
	return path;
}
