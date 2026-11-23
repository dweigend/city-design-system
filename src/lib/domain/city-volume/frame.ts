import type { Vec3 } from '../../core/geometry';

export const latticeVariants = Object.freeze(['box', 'braced', 'centered', 'tetrahedral'] as const);
export type LatticeVariant = (typeof latticeVariants)[number];

/** Stable addresses for full levels, joints and undirected members. Joint positions are world
 * XYZ meters, with Z up. Lists are detached and deeply frozen in plan/level traversal order. */
export type CityLattice = Readonly<{
	cells: readonly Readonly<{
		id: string;
		planCellId: string;
		level: number;
		sideFaces: readonly string[];
	}>[];
	faces: readonly Readonly<{ id: string; corners: readonly [string, string, string, string] }>[];
	nodes: readonly Readonly<{ id: string; position: Vec3 }>[];
	edges: readonly Readonly<{ id: string; from: string; to: string }>[];
}>;

type Node = CityLattice['nodes'][number];
type Edge = CityLattice['edges'][number];

export type Column = Readonly<{
	planCellId: string;
	corners: readonly Node[];
	neighbors: readonly (string | null)[];
	levels: number;
}>;

type Level = Readonly<{ id: string; bottom: readonly Node[]; top: readonly Node[] }>;
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
	const position = corners.reduce<Vec3>(
		([x, y, z], { position: [u, v, w] }) => [
			x + u / corners.length,
			y + v / corners.length,
			z + w / corners.length
		],
		[0, 0, 0]
	);
	const hub = { id: `${level.id}/center`, position };
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

const frames: Record<LatticeVariant, (level: Level, connect: Connect) => void> = {
	box,
	braced,
	centered,
	tetrahedral
};

export function createFrame(
	columns: readonly Column[],
	datumZ: number,
	height: number,
	variant: LatticeVariant
): CityLattice {
	const addMembers = frames[variant];
	const nodes = new Map<string, Node>();
	const edges = new Map<string, Edge>();
	const cells = [];
	const faces = new Map<string, CityLattice['faces'][number]>();
	function connect(a: Node, b: Node) {
		for (const { id, position } of [a, b]) {
			if (!nodes.has(id)) nodes.set(id, Object.freeze({ id, position: Object.freeze(position) }));
		}
		const [from, to] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
		const id = JSON.stringify([from, to]);
		if (!edges.has(id)) edges.set(id, Object.freeze({ id, from, to }));
	}
	for (const { planCellId, corners, levels } of columns) {
		const cornersAt = (level: number) =>
			corners.map(({ id, position: [x, y, z] }): Node => ({
				id: `vertex/${id}/level/${level}`,
				position: [x, y, level === 0 ? z : datumZ + height * level]
			}));
		let bottom = cornersAt(0);
		for (let level = 0; level < levels; level++) {
			const id = `${planCellId}/level/${level}`;
			const top = cornersAt(level + 1);
			const sideFaces = bottom.map((a, i) => {
				const j = (i + 1) % bottom.length;
				const [from, to] = a.id < bottom[j].id ? [i, j] : [j, i];
				const corners = [bottom[from].id, bottom[to].id, top[to].id, top[from].id] as const;
				const face = JSON.stringify(corners);
				if (!faces.has(face))
					faces.set(face, Object.freeze({ id: face, corners: Object.freeze(corners) }));
				return face;
			});
			cells.push(Object.freeze({ id, planCellId, level, sideFaces: Object.freeze(sideFaces) }));
			addMembers({ id, bottom, top }, connect);
			bottom = top;
		}
	}
	return Object.freeze({
		cells: Object.freeze(cells),
		faces: Object.freeze([...faces.values()]),
		nodes: Object.freeze([...nodes.values()]),
		edges: Object.freeze([...edges.values()])
	});
}
