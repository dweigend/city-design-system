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

/** Publish the children only when each has access; otherwise all carriers belong to the parent. */
export function resolveCourtAccess(
	columns: TerrainCell[][],
	first: number,
	minimum: number,
	candidateOf: (cell: TerrainCell) => string
) {
	const courts = new Map<string, Map<string, TerrainCell[]>>();
	for (const column of columns)
		for (const cell of column) {
			if (!cell.parcelAccess) continue;
			const children = courts.get(cell.block) ?? new Map<string, TerrainCell[]>();
			courts.set(cell.block, children);
			const candidate = cell.parcel === cell.block ? candidateOf(cell) : cell.parcel;
			const members = children.get(candidate);
			if (members) members.push(cell);
			else children.set(candidate, [cell]);
		}
	const lookup = (id: string) => {
		const [c, r] = coord(id);
		return columns[c - first][r];
	};
	for (const children of courts.values()) {
		const fronted = [...children.values()].filter((members) =>
			members.some((cell) => hasFront(cell, lookup, minimum))
		);
		const split = fronted.length === children.size;
		const access = fronted.length ? 'fronted' : 'landlocked';
		for (const [candidate, members] of children)
			for (const cell of members) {
				const parcel = split ? candidate : cell.block;
				if (cell.parcel === parcel && cell.parcelAccess === access) continue;
				columns[cell.column - first][cell.row] = {
					...cell,
					parcel,
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
