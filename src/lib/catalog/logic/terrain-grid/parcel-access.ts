import { kern } from '../parametrik/raster/universal';
import type { TerrainCell } from './types';

type Site = Pick<TerrainCell, 'id' | 'corners' | 'alleyEdges' | 'plan'> & {
	neighbors: readonly (string | null)[];
};

function routeWidth(cell: Site, side: number) {
	const { plan } = cell;
	if (plan.square) {
		const a = cell.corners[side],
			b = cell.corners[(side + 1) % 4];
		return Math.hypot(a[0] - b[0], a[1] - b[1]);
	}
	if (!(cell.alleyEdges & (1 << side))) return 0;
	return plan.direction === 'both' || plan.direction === (side % 2 ? 'across' : 'along')
		? plan.width
		: 0;
}

/** Measure only shared exterior edges reached by the circulation plan. */
export function hasFront(cell: Site, lookup: (id: string) => Site, minimum: number) {
	const polygon = cell.corners.map(([x, y]): kern.Vec => [x, y]);
	const fronts: kern.Front[] = [];
	for (const [side, id] of cell.neighbors.entries()) {
		if (!(cell.alleyEdges & (1 << side))) continue;
		const neighbor = id && lookup(id);
		const width = Math.max(
			routeWidth(cell, side),
			neighbor ? routeWidth(neighbor, neighbor.neighbors.indexOf(cell.id)) : 0
		);
		if (width > 0)
			fronts.push({
				id: String(side),
				a: polygon[side],
				b: polygon[(side + 1) % 4],
				width,
				level: 0,
				kind: cell.plan.square || (neighbor && neighbor.plan.square) ? 'square' : 'alley'
			});
	}
	return (
		kern.frontage(polygon, fronts, { level: 0, minWidth: minimum, minFront: minimum }).length > 0
	);
}
