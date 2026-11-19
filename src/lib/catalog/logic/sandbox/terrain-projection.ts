import { createTerrain, type TerrainEdit } from '../terrain';
import { regrid, type TerrainGrid } from '../terrain-grid';

/** Derives a terrain transition from the saved edit sequence. */
export function projectTerrain(grid: TerrainGrid, edits: readonly TerrainEdit[]) {
	return regrid(grid, createTerrain({ seed: grid.terrain.seed, edits }));
}

/** Shares terrain work between the preview and commit when their source terrain is unchanged. */
export function shareTerrainProjection(): typeof projectTerrain {
	const projections = new Map<string, TerrainGrid>();
	return (grid, edits) => {
		const key = JSON.stringify([grid.terrain, grid.profile, edits]);
		const cached = projections.get(key);
		if (cached) return cached;
		const projected = projectTerrain(grid, edits);
		projections.set(key, projected);
		return projected;
	};
}
