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

/** Builds the solids of one layer between two level planes. Each solid exists only where every
 * column it touches reaches the upper plane, so a lower neighbor leaves an open, faceted step. */
function addLayer(topology: PlanTopology, joints: Joints, layer: Layer, add: Add) {
	const { level, low, high, tall } = layer;
	const at = (kind: PlaneKind) => (low === kind ? level : level + 1);
	const bay = (cell: string) => `${cell}/level/${level}`;
	const kinds = [low, high].sort().join('/');
	for (const { planCellId: cell, corners } of topology.columns.values()) {
		if (!tall(cell)) continue;
		const polygon = (k: number) => corners.map((corner) => joints.corner(corner, k));
		const medial = (k: number) =>
			corners.map((a, i) =>
				joints.middle(topology.edgeKey(a, corners[(i + 1) % corners.length]), k)
			);
		const id = `${bay(cell)}/cell`;
		if (kinds === 'plan/plan') add(id, bay(cell), prism(polygon(level), polygon(level + 1)));
		if (kinds === 'centre/plan')
			add(id, bay(cell), pyramid(polygon(at('plan')), joints.centre(cell, at('centre'))));
		if (kinds === 'medial/plan')
			add(id, bay(cell), frustum(polygon(at('plan')), medial(at('medial'))));
		if (kinds === 'foot/medial')
			add(id, bay(cell), pyramid(medial(at('medial')), joints.centre(cell, at('foot'))));
	}
	if (kinds === 'centre/plan') {
		for (const { key, ends, cells } of topology.edges.values()) {
			if (cells.length !== 2 || !cells.every(tall)) continue;
			const [a, b] = ends.map((corner) => joints.corner(corner, at('plan')));
			const [c, d] = cells.map((cell) => joints.centre(cell, at('centre')));
			add(`edge/${key}/level/${level}`, bay([...cells].sort()[0]), [
				[a, c, b],
				[a, b, d],
				[a, d, c],
				[b, c, d]
			]);
		}
	}
	if (kinds !== 'centre/plan' && kinds !== 'medial/plan') return;
	for (const ring of topology.rings.values()) {
		if (!ring.interior || !ring.cells.every(tall)) continue;
		const base =
			kinds === 'centre/plan'
				? ring.cells.map((cell) => joints.centre(cell, at('centre')))
				: ring.edges.map((key) => joints.middle(key, at('medial')));
		const apex = joints.corner(ring.corner, at('plan'));
		add(
			`vertex/${ring.corner.id}/level/${level}`,
			bay([...ring.cells].sort()[0]),
			pyramid(base, apex)
		);
	}
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
