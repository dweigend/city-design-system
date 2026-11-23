import { measurePolygon, type Vec2, type Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { planEdgeId, planEdges } from '../terrain-grid';
import type { Column } from './bay-addresses';

type Corner = Column['corners'][number];

/** One plan edge with its ordered end corners and the one or two columns that share it. */
type PlanEdge = Readonly<{
	key: string;
	ends: readonly [Corner, Corner];
	cells: readonly string[];
}>;

/** One plan corner with the columns and edges around it in counter-clockwise order. A corner is
 * interior when every edge around it is shared by two columns. */
export type PlanRing = Readonly<{
	corner: Corner;
	cells: readonly string[];
	edges: readonly string[];
	interior: boolean;
}>;

/** The plan relations every non-prism lattice reads: centres, shared edges and corner rings. */
export type PlanTopology = Readonly<{
	columns: ReadonlyMap<string, Column>;
	centres: ReadonlyMap<string, Vec2>;
	edges: ReadonlyMap<string, PlanEdge>;
	rings: ReadonlyMap<string, PlanRing>;
	edgeKey: (a: Corner, b: Corner) => string;
}>;

const edgeKey = (a: Corner, b: Corner) => planEdgeId(a.id, b.id);

function angleAround([x, y]: Vec3) {
	return ([u, v]: Vec2) => Math.atan2(v - y, u - x);
}

function sortedAround<T>(corner: Corner, items: readonly T[], at: (item: T) => Vec2) {
	const angle = angleAround(corner.position);
	return [...items].sort((a, b) => angle(at(a)) - angle(at(b)));
}

function midpoint({ ends: [a, b] }: PlanEdge): Vec2 {
	return [(a.position[0] + b.position[0]) / 2, (a.position[1] + b.position[1]) / 2];
}

/** Reads centres, shared edges and corner rings of the columns in plan order. */
export function readPlanTopology(columns: readonly Column[]): PlanTopology {
	const centres = new Map<string, Vec2>();
	const cornersById = new Map<string, Corner>();
	const around = new Map<string, { corner: Corner; cells: string[]; edges: PlanEdge[] }>();
	for (const { planCellId, corners } of columns) {
		centres.set(
			planCellId,
			required(measurePolygon(corners.map((c) => c.position)).centroid, 'centre')
		);
		for (const corner of corners) {
			cornersById.set(corner.id, corner);
			const ring = around.get(corner.id) ?? { corner, cells: [], edges: [] };
			ring.cells.push(planCellId);
			around.set(corner.id, ring);
		}
	}
	const edges = new Map<string, PlanEdge>();
	for (const {
		id,
		nodeIds: [a, b],
		cellIds
	} of planEdges({
		vertices: [...cornersById.values()],
		cells: columns.map(({ planCellId, corners }) => ({
			id: planCellId,
			vertexIds: corners.map(({ id }) => id)
		}))
	})) {
		const edge: PlanEdge = {
			key: id,
			ends: [
				required(cornersById.get(a), 'edge corner'),
				required(cornersById.get(b), 'edge corner')
			],
			cells: cellIds
		};
		edges.set(id, edge);
		required(around.get(a), 'corner ring').edges.push(edge);
		required(around.get(b), 'corner ring').edges.push(edge);
	}
	const rings = new Map<string, PlanRing>();
	for (const [id, { corner, cells, edges: ringEdges }] of around) {
		rings.set(
			id,
			Object.freeze({
				corner,
				cells: Object.freeze(
					sortedAround(corner, cells, (cell) => required(centres.get(cell), 'ring centre'))
				),
				edges: Object.freeze(sortedAround(corner, ringEdges, midpoint).map(({ key }) => key)),
				interior: ringEdges.every(({ cells }) => cells.length === 2)
			})
		);
	}
	return Object.freeze({
		columns: new Map(columns.map((column) => [column.planCellId, column])),
		centres,
		edges,
		rings,
		edgeKey
	});
}
