import { dryPlanEdges, TerrainGrid } from '../terrain-grid';
import { createParcelPlan, type ParcelPlanInput } from './index';

/** A six-cell exhibition site with two walkways and caller-defined holding rules. */
export function parcelExample() {
	const input = exampleGround();
	const laneIds = new Set(input.grid.cells[0].vertexIds.slice(0, 3));
	return createParcelPlan({
		...input,
		lanes: input.lanes.filter(({ edge }) => edge.nodeIds.every((id) => laneIds.has(id)))
	}).read();
}

export function exampleGround(): ParcelPlanInput {
	const grid = TerrainGrid.create({
		seed: 1201,
		variant: 'square',
		parameters: { cellSize: 60 },
		site: {
			origin: [0, 0],
			bearing: 0,
			outline: [
				[0, 0],
				[180, 0],
				[180, 120],
				[0, 120]
			]
		},
		heightAt: () => 0
	});
	return {
		grid,
		lanes: dryPlanEdges(grid, grid).map((edge) => ({
			edge,
			widthM: 3,
			surface: 'walk',
			hierarchy: ['walkway']
		})),
		plannedKinds: Object.fromEntries(grid.cells.map(({ id }) => [id, 'exhibit'])),
		holdingRules: {
			exhibit: { minimumFrontageM: 3 },
			plaza: { minimumFrontageM: 3, publicUse: true }
		},
		tolerance: {
			linearToleranceM: 0.000001,
			areaToleranceM2: 0.01,
			relativeAreaToleranceRatio: 1e-8
		}
	};
}
