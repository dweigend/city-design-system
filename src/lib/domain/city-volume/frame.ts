import type { Vec3 } from '../../core/geometry';
import { columnBays } from './foundation';
import { closeSolid, prismFaces, type LatticeSolid } from './solid';

/** Stable addresses for full levels, joints and undirected members. Joint positions are world
 * XYZ meters, with Z up. Lists are detached and deeply frozen in plan/level traversal order. */
export type CityLattice = Readonly<{
	cells: readonly Readonly<{
		id: string;
		planCellId: string;
		level: number;
		sideFaces: readonly (string | null)[];
	}>[];
	faces: readonly Readonly<{ id: string; corners: readonly [string, string, string, string] }>[];
	nodes: readonly Readonly<{ id: string; position: Vec3 }>[];
	edges: readonly Readonly<{ id: string; from: string; to: string; rank?: 'chord' | 'strut' }>[];
	solids: readonly LatticeSolid[];
}>;

type Node = CityLattice['nodes'][number];
type Edge = CityLattice['edges'][number];

export type Column = Readonly<{
	planCellId: string;
	corners: readonly Node[];
	neighbors: readonly (string | null)[];
	levels: number;
	groundAtHub?: number;
}>;

type Level = Readonly<{
	id: string;
	bottom: readonly Node[];
	top: readonly Node[];
	groundAtHub?: number;
}>;
type Connect = (a: Node, b: Node) => void;

function box({ bottom, top }: Level, connect: Connect) {
	for (const [i, a] of bottom.entries()) {
		const j = (i + 1) % bottom.length;
		connect(a, bottom[j]);
		connect(top[i], top[j]);
		connect(a, top[i]);
	}
}

function braced(level: Level, connect: Connect) {
	box(level, connect);
	const { bottom, top } = level;
	for (const [i, a] of bottom.entries()) {
		const j = (i + 1) % bottom.length;
		// Both neighboring columns choose the same diagonal across the shared face.
		if (a.id < bottom[j].id) connect(a, top[j]);
		else connect(bottom[j], top[i]);
	}
}

function centered(level: Level, connect: Connect) {
	box(level, connect);
	const corners = [...level.bottom, ...level.top];
	const [x, y, nominalZ] = level.bottom.reduce<Vec3>(
		([x, y, z], { position: [u, v, w] }) => [
			x + u / level.bottom.length,
			y + v / level.bottom.length,
			z + w / corners.length
		],
		[0, 0, 0]
	);
	const topZ = level.top.reduce((z, corner) => z + corner.position[2] / corners.length, 0);
	const position: Vec3 = [x, y, Math.max(level.groundAtHub ?? -Infinity, nominalZ + topZ)];
	const id =
		position[2] === level.groundAtHub
			? `${level.id.slice(0, level.id.lastIndexOf('/level/'))}/ground-center`
			: `${level.id}/center`;
	const hub = { id, position };
	for (const corner of corners) connect(hub, corner);
}

function tetrahedral(level: Level, connect: Connect) {
	braced(level, connect);
	const { bottom, top } = level;
	// A fan from the least-addressed corner fixes both copies of every horizontal face.
	const origin = bottom.reduce((least, node, i) => (node.id < bottom[least].id ? i : least), 0);
	for (let offset = 2; offset < bottom.length - 1; offset++) {
		const j = (origin + offset) % bottom.length;
		connect(bottom[origin], bottom[j]);
		connect(top[origin], top[j]);
		// Each triangular prism splits into three tetrahedra with low-to-high ID side diagonals.
		connect(bottom[origin], top[j]);
	}
}

const frames = {
	box,
	braced,
	centered,
	tetrahedral
};

export type PrismVariant = keyof typeof frames;
export const prismVariants = Object.freeze(Object.keys(frames) as PrismVariant[]);

export function createFrame(
	columns: readonly Column[],
	datumZ: number,
	variant: PrismVariant
): CityLattice {
	const addMembers = frames[variant];
	const nodes = new Map<string, Node>();
	const edges = new Map<string, Edge>();
	const solids: LatticeSolid[] = [];
	function connect(a: Node, b: Node) {
		if (a.id === b.id) return;
		for (const { id, position } of [a, b]) {
			if (!nodes.has(id)) nodes.set(id, Object.freeze({ id, position: Object.freeze(position) }));
		}
		const [from, to] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
		const id = JSON.stringify([from, to]);
		if (!edges.has(id)) edges.set(id, Object.freeze({ id, from, to }));
	}
	const { cells, faces } = bayAddresses(columns, datumZ, (bay) => {
		const { id, bottom, top } = bay;
		addMembers(bay, connect);
		solids.push(closeSolid(id, id, prismFaces(bottom, top)));
	});
	return Object.freeze({
		cells,
		faces,
		nodes: Object.freeze([...nodes.values()]),
		edges: Object.freeze([...edges.values()]),
		solids: Object.freeze(solids)
	});
}

/** Builds the canonical addresses and visits their ground-clamped rings in plan order. */
export function bayAddresses(
	columns: readonly Column[],
	datumZ: number,
	visit?: (bay: Level) => void
) {
	const cells = [];
	const faces = new Map<string, CityLattice['faces'][number]>();
	for (const column of columns) {
		const { planCellId } = column;
		for (const { level, bottom, top } of columnBays(column, datumZ)) {
			const id = `${planCellId}/level/${level}`;
			const sideFaces = bottom.map((a, i) => {
				const j = (i + 1) % bottom.length;
				if (a.id === top[i].id && bottom[j].id === top[j].id) return null;
				const [from, to] = a.id < bottom[j].id ? [i, j] : [j, i];
				const corners = [bottom[from].id, bottom[to].id, top[to].id, top[from].id] as const;
				const face = JSON.stringify(corners);
				if (!faces.has(face))
					faces.set(face, Object.freeze({ id: face, corners: Object.freeze(corners) }));
				return face;
			});
			cells.push(Object.freeze({ id, planCellId, level, sideFaces: Object.freeze(sideFaces) }));
			visit?.({ id, bottom, top, groundAtHub: column.groundAtHub });
		}
	}
	return {
		cells: Object.freeze(cells),
		faces: Object.freeze([...faces.values()])
	};
}
