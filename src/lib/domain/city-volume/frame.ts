import type { StructuralColumn } from './columns';
import { readVertexMean, type Vec3 } from '../../core/geometry';
import { encodePair } from '../../core/ref';
import {
	bayAddresses,
	type BayFace,
	type BayRings,
	type LatticeBay,
	type LatticePoint
} from './bay-addresses';
import { cornerReader } from './foundation';
import { capHeight, fanTriangles, hasCollapsedDiagonal, prismParts } from './foundation-prism';
import { cleanFaces, closeSolid, prismFaces, type LatticeSolid } from './solid';

/** Stable addresses for full levels, joints and undirected members. Joint positions are world
 * XYZ meters, with Z up. Lists are detached and deeply frozen in plan/level traversal order. */
export type CityLattice = Readonly<{
	cells: readonly LatticeBay[];
	faces: readonly BayFace[];
	bayCorners: readonly LatticePoint[];
	nodes: readonly LatticePoint[];
	edges: readonly Readonly<{ id: string; from: string; to: string; rank?: 'chord' | 'strut' }>[];
	solids: readonly LatticeSolid[];
}>;

type Node = CityLattice['nodes'][number];
type Edge = CityLattice['edges'][number];

type Level = BayRings;
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

function hubCapHeight(ring: readonly Node[], x: number, y: number) {
	const z = ring[0].position[2];
	return ring.every(({ position }) => position[2] === z) ? z : capHeight(ring, x, y);
}

function centered(level: Level, connect: Connect) {
	box(level, connect);
	const corners = [...level.bottom, ...level.top];
	const [x, y] = readVertexMean(
		level.bottom.map(({ position }) => position),
		'before-sum'
	);
	const bottom = hubCapHeight(level.bottom, x, y);
	const top = hubCapHeight(level.top, x, y);
	if (bottom === undefined || top === undefined) return;
	const floor = Math.max(bottom, level.groundAtHub ?? -Infinity);
	if (top <= floor) return;
	const z = Math.max(floor, (bottom + top) / 2);
	const position: Vec3 = [x, y, z];
	const id =
		position[2] === level.groundAtHub
			? `${level.id.slice(0, level.id.lastIndexOf('/level/'))}/ground-center`
			: `${level.id}/center`;
	const hub = Object.freeze({
		id,
		position: Object.freeze(position),
		...(z === level.groundAtHub && { groundContact: true as const })
	});
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
	columns: readonly StructuralColumn[],
	datumZ: number,
	variant: PrismVariant,
	levelHeightM: number
): CityLattice {
	const addMembers = frames[variant];
	const nodes = new Map<string, Node>();
	const edges = new Map<string, Edge>();
	const solids: LatticeSolid[] = [];
	function connect(a: Node, b: Node) {
		if (a.id === b.id) return;
		if (!nodes.has(a.id)) nodes.set(a.id, a);
		if (!nodes.has(b.id)) nodes.set(b.id, b);
		const [from, to] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
		const id = encodePair(from, to);
		if (!edges.has(id)) edges.set(id, Object.freeze({ id, from, to }));
	}
	let triangulate = false;
	const addresses = bayAddresses(
		columns,
		datumZ,
		cornerReader(datumZ, levelHeightM),
		levelHeightM,
		(bay, first) => {
			const { id, bottom, top } = bay;
			if (first) triangulate = hasCollapsedDiagonal(bottom, top);
			addMembers(bay, connect);
			if (!triangulate) {
				solids.push(closeSolid(id, id, cleanFaces(prismFaces(bottom, top))));
				return;
			}
			const split = hasCollapsedDiagonal(bottom, top);
			const parts = split ? prismParts(bottom, top) : [{ bottom, top }];
			for (const [i, part] of parts.entries()) {
				const [floor, ceiling, ...sides] = prismFaces(part.bottom, part.top);
				solids.push(
					closeSolid(
						parts.length === 1 ? id : `${id}/part/${i}`,
						id,
						cleanFaces([...fanTriangles(floor), ...fanTriangles(ceiling), ...sides])
					)
				);
			}
		}
	);
	return Object.freeze({
		...addresses,
		nodes: Object.freeze([...nodes.values()]),
		edges: Object.freeze([...edges.values()]),
		solids: Object.freeze(solids)
	});
}
