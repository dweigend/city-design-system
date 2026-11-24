import type { Vec3 } from '../../core/geometry';
import type { FineCell } from '../cell-space';
import type { Context } from './context';

type Node = Readonly<{ cell: FineCell; storey: number; id: string }>;
type Face = Readonly<{ owner: string; points: Vec3[] }>;

const nodeId = (cell: string, storey: number) => `${cell}#${storey}`;
const pointKey = ([x, y, z]: Vec3) => `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;

function nodes(ctx: Context): Node[] {
	return ctx.space.cells.flatMap((cell) => {
		const house = ctx.occupancy.get(cell.id);
		if (!house) return [];
		return Array.from({ length: Math.max(0, house.toStorey - house.fromStorey) }, (_, k) => ({
			cell,
			storey: house.fromStorey + k,
			id: nodeId(cell.id, house.fromStorey + k)
		}));
	});
}

/** Faces of the shell `members`, cell by cell and run by run: a floor under each run, a roof
 * over it and the sides of each storey not shared with another member, wound outward. */
export function shellFaces(ctx: Context, members: ReadonlySet<string>): Face[] {
	const level = (storey: number) => ctx.space.baseZ + storey * ctx.space.storeyHeightM;
	const faces: Face[] = [];
	for (const cell of ctx.space.cells) {
		const ring = (storey: number) => cell.quad.map(([x, y]): Vec3 => [x, y, level(storey)]);
		const inShell = (storey: number) => members.has(nodeId(cell.id, storey));
		const house = ctx.occupancy.get(cell.id);
		for (let storey = house?.fromStorey ?? 0; storey < (house?.toStorey ?? 0); storey += 1) {
			if (!inShell(storey)) continue;
			const owner = nodeId(cell.id, storey);
			if (!inShell(storey - 1)) faces.push({ owner, points: [...ring(storey)].reverse() });
			if (!inShell(storey + 1)) faces.push({ owner, points: ring(storey + 1) });
		}
		for (let storey = house?.fromStorey ?? 0; storey < (house?.toStorey ?? 0); storey += 1) {
			if (!inShell(storey)) continue;
			const [low, high] = [ring(storey), ring(storey + 1)];
			cell.quad.forEach((_, i) => {
				const j = (i + 1) % cell.quad.length;
				const across = cell.sides[i].neighbour;
				if (across === null || !members.has(nodeId(across, storey)))
					faces.push({
						owner: nodeId(cell.id, storey),
						points: [low[i], low[j], high[j], high[i]]
					});
			});
		}
	}
	return faces;
}

function faceAdjacent(a: Node, b: Node): boolean {
	if (a.cell.id === b.cell.id) return Math.abs(a.storey - b.storey) === 1;
	return a.storey === b.storey && a.cell.sides.some(({ neighbour }) => neighbour === b.cell.id);
}

/** Pairs of members meeting on an edge shared by more than two faces of their shell. */
function edgeContacts(faces: readonly Face[], byId: ReadonlyMap<string, Node>): [string, string][] {
	const owners = new Map<string, string[]>();
	for (const { owner, points } of faces)
		points.forEach((point, i) => {
			const edge = [pointKey(point), pointKey(points[(i + 1) % points.length])].sort().join('|');
			owners.set(edge, [...(owners.get(edge) ?? []), owner]);
		});
	const pairs: [string, string][] = [];
	for (const list of owners.values()) {
		if (list.length <= 2) continue;
		for (const a of list)
			for (const b of list) {
				const [na, nb] = [byId.get(a), byId.get(b)];
				if (a < b && na && nb && !faceAdjacent(na, nb)) pairs.push([a, b]);
			}
	}
	return pairs;
}

/** Partitions the built cell storeys into shells whose surfaces stay two-manifold: storeys join
 * the first shell they have no edge-only contact with. Without such contacts all storeys form one
 * shell, the merged envelope. Deterministic in cell and storey order. */
export function shells(ctx: Context): ReadonlySet<string>[] {
	const all = nodes(ctx);
	if (!all.length) return [];
	const byId = new Map(all.map((node) => [node.id, node]));
	const conflicts = new Map<string, Set<string>>();
	for (;;) {
		const groups: Set<string>[] = [];
		for (const node of all) {
			const clash = conflicts.get(node.id);
			const home = groups.find((group) => ![...(clash ?? [])].some((other) => group.has(other)));
			if (home) home.add(node.id);
			else groups.push(new Set([node.id]));
		}
		const pairs = groups.flatMap((group) => edgeContacts(shellFaces(ctx, group), byId));
		if (!pairs.length) return groups;
		for (const [a, b] of pairs) {
			conflicts.set(a, (conflicts.get(a) ?? new Set()).add(b));
			conflicts.set(b, (conflicts.get(b) ?? new Set()).add(a));
		}
	}
}
