import { measurePolygon, type Vec2, type Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { Column } from './frame';

type Corner = Column['corners'][number];

/** One plan edge with its ordered end corners and the one or two columns that share it. */
type PlanEdge = Readonly<{ key: string; ends: readonly [Corner, Corner]; cells: string[] }>;

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

const edgeKey = (a: Corner, b: Corner) => (a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`);

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
	const edges = new Map<string, PlanEdge>();
	const around = new Map<string, { corner: Corner; cells: string[]; edges: Set<string> }>();
	for (const { planCellId, corners } of columns) {
		centres.set(
			planCellId,
			required(measurePolygon(corners.map((c) => c.position)).centroid, 'centre')
		);
		for (const [i, a] of corners.entries()) {
			const b = corners[(i + 1) % corners.length];
			const key = edgeKey(a, b);
			const edge = edges.get(key) ?? { key, ends: a.id < b.id ? [a, b] : [b, a], cells: [] };
			edge.cells.push(planCellId);
			edges.set(key, edge);
			const ring = around.get(a.id) ?? { corner: a, cells: [], edges: new Set() };
			ring.cells.push(planCellId);
			ring.edges.add(key);
			ring.edges.add(edgeKey(corners.at(i - 1) ?? a, a));
			around.set(a.id, ring);
		}
	}
	const rings = new Map<string, PlanRing>();
	for (const [id, { corner, cells, edges: keys }] of around) {
		const ringEdges = [...keys].map((key) => required(edges.get(key), 'ring edge'));
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
