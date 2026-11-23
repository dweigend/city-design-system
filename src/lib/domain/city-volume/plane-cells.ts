import { required } from '../../core/invariant';
import type { Column } from './frame';
import type { PlanTopology } from './plan-topology';
import type { Joint, Joints, PlaneKind } from './plane-joints';
import { prismFaces } from './solid';

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
	}>;

function polygon({ joints }: Context, { corners }: Column, level: number) {
	return corners.map((corner) => joints.corner(corner, level));
}

function medial({ joints, topology }: Context, { corners }: Column, level: number) {
	return corners.map((a, i) =>
		joints.middle(topology.edgeKey(a, corners[(i + 1) % corners.length]), level)
	);
}

/** A full bay meeting a frustum splits its shared side at the frustum's triangle. */
function planBay(c: Context, column: Column) {
	const { level, topology, joints } = c;
	const bottom = polygon(c, column, level);
	const top = polygon(c, column, level + 1);
	const [floor, roof, ...sides] = prismFaces(bottom, top);
	return [
		floor,
		roof,
		...sides.flatMap((side, i) => {
			const [a, b, d, e] = side;
			const key = topology.edgeKey(column.corners[i], column.corners[(i + 1) % sides.length]);
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
		})
	];
}

/** The one cell solid of each plane pair, keyed by the sorted plane kinds. */
const cellSolids: Record<string, (context: Context, column: Column) => Faces> = {
	'plan/plan': planBay,
	'centre/plan': (c, column) =>
		pyramid(polygon(c, column, c.at('plan')), c.joints.centre(column.planCellId, c.at('centre'))),
	'medial/plan': (c, column) =>
		frustum(polygon(c, column, c.at('plan')), medial(c, column, c.at('medial'))),
	'foot/medial': (c, column) =>
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
	foundation: (id: string, level: number) => boolean,
	sharedMedial: SharedMedial
) {
	const { level, low } = layer;
	const c: Context = {
		...layer,
		topology,
		joints,
		add,
		sharedMedial,
		at: (kind) => (low === kind ? level : level + 1),
		bay: (cell) => `${cell}/level/${level}`
	};
	const kinds = [layer.low, layer.high].sort().join('/');
	const cellSolid = cellSolids[kinds];
	if (!cellSolid) throw new RangeError(`No lattice layer joins ${kinds} planes`);
	for (const id of layer.cells) {
		const column = required(topology.columns.get(id), 'lattice column');
		let faces = cellSolid(c, column);
		if (foundation(id, level)) {
			const ring = polygon(c, column, level + 1);
			faces = [
				faces[0],
				...ring.map((a, i) => [a, ring[(i + 1) % ring.length], joints.centre(id, level + 1)]),
				...faces.slice(2)
			];
		}
		add(`${c.bay(id)}/cell`, c.bay(id), faces);
	}
	if (kinds === 'centre/plan') addEdgeTetrahedra(c);
	if (kinds === 'centre/plan' || kinds === 'medial/plan')
		addCornerPyramids(c, kinds === 'centre/plan');
}

export type Add = (id: string, bay: string, faces: readonly (readonly Joint[])[]) => void;
