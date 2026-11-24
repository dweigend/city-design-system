import { encodePair } from '../../core/ref';
import { cityVolumeConfig } from '../../../config/city-volume';
import { required } from '../../core/invariant';
import type { StructuralColumn } from './columns';
import type { PlanTopology } from './plan-topology';
import type { Joint, Joints, PlaneKind } from './plane-joints';
import { capHeight, fanTriangles, hasCollapsedDiagonal, prismParts } from './foundation-prism';
import { cleanFaces, prismFaces } from './solid';

type Layer = Readonly<{
	level: number;
	low: PlaneKind;
	high: PlaneKind;
	cells: ReadonlySet<string>;
}>;

// Every recipe winds its faces one way: each edge is walked once in each direction.
const pyramid = (base: readonly Joint[], apex: Joint) => [
	[...base].reverse(),
	...base.map((a, i) => [a, base[(i + 1) % base.length], apex])
];

/** A plan polygon joined to its medial polygon, whose joint i halves side i. */
const frustum = (polygon: readonly Joint[], medial: readonly Joint[]) => [
	[...polygon].reverse(),
	medial,
	...polygon.map((a, i) => [a, polygon[(i + 1) % polygon.length], medial[i]]),
	...polygon.map((a, i) => [a, medial[i], medial.at(i - 1) ?? medial[i]])
];

type Faces = readonly (readonly Joint[])[];
export type SharedMedial = (id: string, key: string, level: number) => number | undefined;
type Context = Layer &
	Readonly<{
		topology: PlanTopology;
		joints: Joints;
		add: Add;
		at: (kind: PlaneKind) => number;
		bay: (cell: string) => string;
		sharedMedial: SharedMedial;
		triangulated: ReadonlySet<string>;
	}>;

function polygon({ joints }: Context, { corners }: StructuralColumn, level: number) {
	return corners.map((corner) => joints.corner(corner, level));
}

function medial({ joints, topology }: Context, { corners }: StructuralColumn, level: number) {
	return corners.map((a, i) =>
		joints.middle(topology.edgeKey(a, corners[(i + 1) % corners.length]), level)
	);
}

/** A full bay meeting a frustum splits its shared side at the frustum's triangle. */
function planSides(
	c: Context,
	column: StructuralColumn,
	sides: Faces,
	indices?: readonly number[]
) {
	const { level, topology, joints } = c;
	return sides.flatMap((side, i) => {
		const [a, b, d, e] = side;
		const start = indices?.[i] ?? i;
		const end = (start + 1) % column.corners.length;
		if (indices && end !== indices[(i + 1) % indices.length]) return [side];
		const key = topology.edgeKey(column.corners[start], column.corners[end]);
		const at = c.sharedMedial(column.planCellId, key, level);
		if (at === undefined) return [side];
		const m = joints.middle(key, at);
		return at === level
			? [
					[a, m, e],
					[m, b, d],
					[m, d, e]
				]
			: [
					[a, b, m],
					[b, d, m],
					[m, e, a]
				];
	});
}

// On a pinched foundation, a tree foot may lie on the same clamped seam in several bands.
function onFootEdge(a: Joint, b: Joint, foot: Joint) {
	const [x, y, z] = foot.position;
	const [ax, ay, az] = a.position;
	const [bx, by, bz] = b.position;
	if (z !== az || z !== bz) return false;
	const [dx, dy] = [bx - ax, by - ay];
	const lengthSquared = dx * dx + dy * dy;
	const along = (x - ax) * dx + (y - ay) * dy;
	return (
		along > 0 &&
		along < lengthSquared &&
		Math.abs(dx * (y - ay) - dy * (x - ax)) <= cityVolumeConfig.hubWeightTolerance * lengthSquared
	);
}

function throughFoot(loop: readonly Joint[], foot: Joint) {
	return loop.flatMap((a, i) =>
		onFootEdge(a, loop[(i + 1) % loop.length], foot) ? [a, foot] : [a]
	);
}

function addPlanBay(c: Context, column: StructuralColumn, foot?: Joint) {
	const { level } = c;
	const id = column.planCellId;
	const bay = c.bay(id);
	const bottom = polygon(c, column, level);
	const top = polygon(c, column, level + 1);
	const triangulate = c.triangulated.has(id);
	const split = triangulate && hasCollapsedDiagonal(bottom, top);
	const parts = split ? prismParts(bottom, top) : [{ bottom, top, indices: undefined }];
	for (const [i, part] of parts.entries()) {
		const [floor, cap, ...sides] = prismFaces(part.bottom, part.top);
		const onCap =
			foot &&
			foot.level === level + 1 &&
			(!split || capHeight(cap, foot.position[0], foot.position[1]) !== undefined);
		const ceiling = onCap
			? cap.flatMap((a, j) => {
					const b = cap[(j + 1) % cap.length];
					return onFootEdge(a, b, foot) ? [] : [[a, b, foot]];
				})
			: triangulate
				? fanTriangles(cap)
				: [cap];
		const faces = [
			...(triangulate ? fanTriangles(floor) : [floor]),
			...ceiling,
			...planSides(c, column, sides, part.indices)
		];
		const stitched =
			triangulate && foot ? cleanFaces(faces).map((loop) => throughFoot(loop, foot)) : faces;
		c.add(parts.length === 1 ? `${bay}/cell` : `${bay}/cell/${i}`, bay, stitched);
	}
}

const planPair = encodePair('plan', 'plan');
const centrePlan = encodePair('centre', 'plan');
const medialPlan = encodePair('medial', 'plan');

/** The one cell solid of each plane pair, keyed by the sorted plane kinds. */
const cellSolids: Record<string, (context: Context, column: StructuralColumn) => Faces> = {
	[centrePlan]: (c, column) =>
		pyramid(polygon(c, column, c.at('plan')), c.joints.centre(column.planCellId, c.at('centre'))),
	[medialPlan]: (c, column) =>
		frustum(polygon(c, column, c.at('plan')), medial(c, column, c.at('medial'))),
	[encodePair('foot', 'medial')]: (c, column) =>
		pyramid(medial(c, column, c.at('medial')), c.joints.centre(column.planCellId, c.at('foot')))
};

/** Between plan and dual planes, every inner plan edge spans a tetrahedron to its two centres. */
function addEdgeTetrahedra(c: Context) {
	for (const { key, ends, cells } of c.topology.edges.values()) {
		if (cells.length !== 2 || !cells.every((id) => c.cells.has(id))) continue;
		const [a, b] = ends.map((corner) => c.joints.corner(corner, c.at('plan')));
		const [d, e] = cells.map((cell) => c.joints.centre(cell, c.at('centre')));
		const faces = [
			[a, d, b],
			[a, b, e],
			[a, e, d],
			[b, d, e]
		];
		c.add(`edge/${key}/level/${c.level}`, c.bay([...cells].sort()[0]), faces);
	}
}

/** Every inner plan corner caps the ring of centres or midpoints around it with a pyramid. */
function addCornerPyramids(c: Context, onCentres: boolean) {
	for (const ring of c.topology.rings.values()) {
		if (!ring.interior || !ring.cells.every((id) => c.cells.has(id))) continue;
		const base = onCentres
			? ring.cells.map((cell) => c.joints.centre(cell, c.at('centre')))
			: ring.edges.map((key) => c.joints.middle(key, c.at('medial')));
		const apex = c.joints.corner(ring.corner, c.at('plan'));
		c.add(
			`vertex/${ring.corner.id}/level/${c.level}`,
			c.bay([...ring.cells].sort()[0]),
			pyramid(base, apex)
		);
	}
}

/** Builds the solids of one layer between two level planes. Each solid exists only where every
 * column it touches reaches the upper plane, so a lower neighbor leaves an open, faceted step. */
export function addLayer(
	topology: PlanTopology,
	joints: Joints,
	layer: Layer,
	add: Add,
	footLevel: (id: string, level: number) => number | undefined,
	sharedMedial: SharedMedial,
	triangulated: ReadonlySet<string>
) {
	const { level, low } = layer;
	const c: Context = {
		...layer,
		topology,
		joints,
		add,
		sharedMedial,
		triangulated,
		at: (kind) => (low === kind ? level : level + 1),
		bay: (cell) => `${cell}/level/${level}`
	};
	const kinds = encodePair(layer.low, layer.high);
	const cellSolid = cellSolids[kinds];
	for (const id of layer.cells) {
		const column = required(topology.columns.get(id), 'lattice column');
		if (kinds === planPair) {
			const at = footLevel(id, level);
			addPlanBay(c, column, at === undefined ? undefined : joints.centre(id, at));
			continue;
		}
		if (!cellSolid)
			throw new RangeError(`No lattice layer joins ${layer.low} and ${layer.high} planes`);
		const faces = cellSolid(c, column);
		const splitCap = triangulated.has(id) && (layer.low === 'plan' || layer.high === 'plan');
		const loops = splitCap ? [...fanTriangles(faces[0]), ...faces.slice(1)] : faces;
		c.add(`${c.bay(id)}/cell`, c.bay(id), loops);
	}
	if (kinds === centrePlan) addEdgeTetrahedra(c);
	if (kinds === centrePlan || kinds === medialPlan) addCornerPyramids(c, kinds === centrePlan);
}

export type Add = (id: string, bay: string, faces: readonly (readonly Joint[])[]) => void;
