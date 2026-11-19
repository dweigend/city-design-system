import { kern } from '../parametrik/raster/universal';
import { coord } from './block-graph';
import type { TerrainCell } from './types';

function routeWidth(cell: TerrainCell, side: number) {
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

function hasFront(cell: TerrainCell, lookup: (id: string) => TerrainCell, minimum: number) {
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
				id: cell.vertexIds[side],
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

/** Classify both carriers of a kernel child against the final, edge-adjacent circulation plan. */
export function resolveCourtAccess(columns: TerrainCell[][], first: number, minimum: number) {
	const parcels = new Map<string, TerrainCell[]>();
	for (const column of columns)
		for (const cell of column) {
			if (!cell.parcelAccess) continue;
			const members = parcels.get(cell.parcel);
			if (members) members.push(cell);
			else parcels.set(cell.parcel, [cell]);
		}
	const lookup = (id: string) => {
		const [c, r] = coord(id);
		return columns[c - first][r];
	};
	for (const members of parcels.values()) {
		const access = members.some((c) => hasFront(c, lookup, minimum)) ? 'fronted' : 'landlocked';
		for (const cell of members) {
			if (cell.parcelAccess === access) continue;
			const column = columns[cell.column - first];
			column[cell.row] = {
				...cell,
				parcelAccess: access,
				buildable:
					access === 'fronted' &&
					!cell.plan.open &&
					!cell.plan.square &&
					(!cell.alley || !!cell.lotCorners)
			};
		}
	}
}
