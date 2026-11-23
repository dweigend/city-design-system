import type { Vec2, Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { createFrame, type CityLattice, type Column } from './frame';
import { readPlanTopology, type PlanRing, type PlanTopology } from './plan-topology';
import { closeSolid, type LatticeSolid } from './solid';

/** What a level plane holds: the plan corners, the cell centres (the dual), the edge midpoints
 * (the medial plan) or one foot per cell on the terrain. */
type PlaneKind = 'plan' | 'centre' | 'medial' | 'foot';

/** A lattice model as a rule over level planes. `shift` moves a plan corner horizontally in
 * meters at a level above the terrain; it must return the same offset for the same input. */
export type PlaneRule = Readonly<{
	plane: (level: number) => PlaneKind;
	shift?: (topology: PlanTopology, ring: PlanRing, level: number) => Vec2;
}>;

type Joint = Readonly<{ id: string; position: Vec3; level: number }>;
type Corner = Column['corners'][number];
type Layer = Readonly<{
	level: number;
	low: PlaneKind;
	high: PlaneKind;
	tall: (id: string) => boolean;
}>;

function meanZ(corners: readonly Corner[]) {
	return corners.reduce((sum, { position }) => sum + position[2], 0) / corners.length;
}

/** Joint factory of one lattice: every joint is created once and keyed by plan address and level. */
function jointsOf(topology: PlanTopology, rule: PlaneRule, datumZ: number, height: number) {
	const joints = new Map<string, Joint>();
	const at = (id: string, level: number, position: () => Vec3) => {
		let joint = joints.get(id);
		if (!joint) {
			joint = Object.freeze({ id, level, position: Object.freeze(position()) });
			joints.set(id, joint);
		}
		return joint;
	};
	const z = (level: number) => datumZ + height * level;
	const column = (cell: string) => required(topology.columns.get(cell), 'lattice column');
	return {
		joints,
		corner(corner: Corner, level: number) {
			return at(`vertex/${corner.id}/level/${level}`, level, () => {
				if (level === 0) return corner.position;
				const ring = required(topology.rings.get(corner.id), 'corner ring');
				const [dx, dy] = rule.shift?.(topology, ring, level) ?? [0, 0];
				return [corner.position[0] + dx, corner.position[1] + dy, z(level)];
			});
		},
		centre(cell: string, level: number) {
			return at(`cell/${cell}/level/${level}`, level, () => {
				const [x, y] = required(topology.centres.get(cell), 'cell centre');
				return [x, y, level === 0 ? meanZ(column(cell).corners) : z(level)];
			});
		},
		middle(key: string, level: number) {
			return at(`edge/${key}/level/${level}`, level, () => {
				const { ends } = required(topology.edges.get(key), 'plan edge');
				const [[ax, ay], [bx, by]] = ends.map(({ position }) => position);
				return [(ax + bx) / 2, (ay + by) / 2, level === 0 ? meanZ(ends) : z(level)];
			});
		}
	};
}

type Joints = ReturnType<typeof jointsOf>;

// Every recipe winds its faces one way: each edge is walked once in each direction.
const pyramid = (base: readonly Joint[], apex: Joint) => [
	[...base].reverse(),
	...base.map((a, i) => [a, base[(i + 1) % base.length], apex])
];

const prism = (bottom: readonly Joint[], top: readonly Joint[]) => [
	[...bottom].reverse(),
	top,
	...bottom.map((a, i) => {
		const j = (i + 1) % bottom.length;
		return [a, bottom[j], top[j], top[i]];
	})
];

/** A plan polygon joined to its medial polygon, whose joint i halves side i. */
const frustum = (polygon: readonly Joint[], medial: readonly Joint[]) => [
	[...polygon].reverse(),
	medial,
	...polygon.map((a, i) => [a, polygon[(i + 1) % polygon.length], medial[i]]),
	...polygon.map((a, i) => [a, medial[i], medial.at(i - 1) ?? medial[i]])
];

type Faces = readonly (readonly Joint[])[];
type Context = Layer &
	Readonly<{
		topology: PlanTopology;
		joints: Joints;
		add: Add;
		at: (kind: PlaneKind) => number;
		bay: (cell: string) => string;
	}>;

function polygon({ joints }: Context, { corners }: Column, level: number) {
	return corners.map((corner) => joints.corner(corner, level));
}

function medial({ joints, topology }: Context, { corners }: Column, level: number) {
	return corners.map((a, i) =>
		joints.middle(topology.edgeKey(a, corners[(i + 1) % corners.length]), level)
	);
}

/** The one cell solid of each plane pair, keyed by the sorted plane kinds. */
const cellSolids: Record<string, (context: Context, column: Column) => Faces> = {
	'plan/plan': (c, column) => prism(polygon(c, column, c.level), polygon(c, column, c.level + 1)),
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
		if (cells.length !== 2 || !cells.every(c.tall)) continue;
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
		if (!ring.interior || !ring.cells.every(c.tall)) continue;
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
function addLayer(topology: PlanTopology, joints: Joints, layer: Layer, add: Add) {
	const { level, low } = layer;
	const c: Context = {
		...layer,
		topology,
		joints,
		add,
		at: (kind) => (low === kind ? level : level + 1),
		bay: (cell) => `${cell}/level/${level}`
	};
	const kinds = [layer.low, layer.high].sort().join('/');
	const cellSolid = cellSolids[kinds];
	if (!cellSolid) throw new RangeError(`No lattice layer joins ${kinds} planes`);
	for (const column of topology.columns.values())
		if (layer.tall(column.planCellId))
			add(`${c.bay(column.planCellId)}/cell`, c.bay(column.planCellId), cellSolid(c, column));
	if (kinds === 'centre/plan') addEdgeTetrahedra(c);
	if (kinds === 'centre/plan' || kinds === 'medial/plan')
		addCornerPyramids(c, kinds === 'centre/plan');
}

type Add = (id: string, bay: string, faces: readonly (readonly Joint[])[]) => void;

/** Builds a lattice whose level planes follow the rule. Bays and their side faces are the shared
 * address frame of the box lattice; solids and members come from the rule. A member is a solid
 * edge: a chord joins two joints of one plane, a strut joins two planes. */
export function createPlaneLattice(
	columns: readonly Column[],
	datumZ: number,
	height: number,
	rule: PlaneRule
): CityLattice {
	const { cells, faces } = createFrame(columns, datumZ, height, 'box');
	const topology = readPlanTopology(columns);
	const joints = jointsOf(topology, rule, datumZ, height);
	const solids: LatticeSolid[] = [];
	const edges = new Map<string, CityLattice['edges'][number]>();
	const add: Add = (id, bay, loops) => {
		solids.push(closeSolid(id, bay, loops));
		for (const loop of loops) {
			for (const [i, a] of loop.entries()) {
				const b = loop[(i + 1) % loop.length];
				const [from, to] = a.id < b.id ? [a, b] : [b, a];
				const key = `${from.id}\n${to.id}`;
				if (edges.has(key)) continue;
				const id = JSON.stringify([from.id, to.id]);
				const rank = a.level === b.level ? 'chord' : 'strut';
				edges.set(key, Object.freeze({ id, from: from.id, to: to.id, rank }));
			}
		}
	};
	const top = Math.max(0, ...columns.map(({ levels }) => levels));
	for (let level = 0; level < top; level++) {
		const tall = (cell: string) =>
			required(topology.columns.get(cell), 'lattice column').levels > level;
		addLayer(
			topology,
			joints,
			{ level, low: rule.plane(level), high: rule.plane(level + 1), tall },
			add
		);
	}
	return Object.freeze({
		cells,
		faces,
		nodes: Object.freeze(
			[...joints.joints.values()].map(({ id, position }) => Object.freeze({ id, position }))
		),
		edges: Object.freeze([...edges.values()]),
		solids: Object.freeze(solids)
	});
}
