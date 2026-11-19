import { courtParcels } from './court-parcels';
import { concaveBlocks } from './concave-blocks';
import { kern } from '../parametrik/raster/universal';
import { corners, coord, get, average, sourceGraph, sourceIntent, type Face } from './block-graph';
import { required } from '../required';
import { cellId } from './types';
import { type Lattice } from './contour-rows';

export type Address = readonly [number, number];
export type Ground = (c: number, r: number) => kern.Vec;
function slotFor(vertex: string, ring: string[], slots: string[], available: Set<string>) {
	const natural = slots[ring.indexOf(vertex)];
	if (natural && available.delete(natural)) return natural;
	return undefined;
}

function parcelChildren(
	f: Face,
	c: number,
	r: number,
	merged: ReturnType<typeof concaveBlocks>,
	intent: kern.Intent,
	positions: Map<string, kern.Vec>,
	available: Set<string>,
	cuts: ReturnType<typeof courtParcels>
) {
	const [x, y] = coord(f.id),
		original = corners(x, y, 2);
	const joined = merged.get(f.id);
	const cut = cuts.blocks.get(f.id);
	if (cut)
		return cut.map((child) => ({
			...child,
			parent: f,
			front: 1,
			back: 1,
			slot: slotFor(child.ring[0], original, f.slots, available)
		}));
	const chunk = joined?.chunk ?? kern.deriveChunk(intent, { id: f.id, ring: f.ring, level: 0 });
	const alias = new Map(f.ring.map((v) => [v, v]));
	f.ring.forEach((v, i) => {
		const w = f.ring[(i + 1) % f.ring.length],
			[a, b] = coord(v),
			[d, e] = coord(w);
		alias.set(
			'mid:' + kern.edgeId(v, w),
			a !== d && b !== e ? cellId(c + 2, r + 1) : average(v, w)
		);
	});
	return [...chunk.topology.faces.values()]
		.filter((q) => alias.has(q.vertices[0]) && alias.has(q.vertices[1]) && alias.has(q.vertices[3]))
		.map((q) => {
			const ring = q.vertices.map((v) => alias.get(v) ?? cellId(x + 1, y + 1));
			q.vertices.forEach((v, i) =>
				positions.set(ring[i], cuts.points.get(ring[i]) ?? get(chunk.geometry.positions, v))
			);
			return {
				ring,
				parcel: q.id,
				parent: joined ?? f,
				front: q.vertices[1] === joined?.shared ? 0 : 1,
				back: q.vertices[3] === joined?.shared ? 0 : 1,
				slot: slotFor(q.vertices[0], original, f.slots, available)
			};
		});
}

function fixedFrontages(
	parents: ReadonlyMap<string, { mask: number }>,
	faces: ReadonlyMap<string, kern.SourceFace>
) {
	const fixed = new Set<string>();
	for (const [id, { mask }] of parents) {
		const face = required(faces.get(id), 'parcel');
		face.ring.forEach((v, i) => {
			if (mask & (1 << i)) {
				fixed.add(v);
				fixed.add(face.ring[(i + 1) % 4]);
			}
		});
	}
	return fixed;
}

function* sourceGroups(faces: Map<string, Face>, width: number, height: number, settled: boolean) {
	for (let r = 0; r < height; r += 2)
		for (let c = 0; c < width;) {
			const pair = settled && r >= 2 && r + 2 < height && c % 4 === 2 && c + 4 < width;
			const group = [required(faces.get(cellId(c, r)), 'source block')];
			if (pair) group.push(required(faces.get(cellId(c + 2, r)), 'paired block'));
			yield { group, c, r };
			c += group.length * 2;
		}
}
/** The kernel owns subdivision and relaxation. Slots preserve the sandbox's painted addresses. */
export function blockTemplate(
	width: number,
	height: number,
	seed: number,
	profile: Lattice['profile'],
	settled: boolean,
	exchanges = true
) {
	const graph = sourceGraph(width, height, seed, profile, settled, exchanges),
		intent = sourceIntent(seed, graph.positions);
	const cuts = courtParcels(graph, width, height, seed, profile, settled);
	const positions = new Map([...graph.positions, ...cuts.points]),
		faces = new Map<string, kern.SourceFace>();
	const merged = concaveBlocks(graph.faces.values(), intent);
	const parents = new Map<
		string,
		{ id: string; sides: number; mask: number; group: string; parcel: string }
	>();
	for (const { group, c, r } of sourceGroups(graph.faces, width, height, settled)) {
		const available = new Set(group.flatMap((f) => f.slots));
		const children = group.flatMap((f) =>
			parcelChildren(f, c, r, merged, intent, positions, available, cuts)
		);
		for (const child of children) {
			const id = child.slot ?? required(available.values().next().value, 'free parcel address');
			available.delete(id);
			const [x, y] = coord(id),
				corner = y % 2 ? (x % 2 ? 2 : 3) : x % 2;
			const rotate = (i: number) => (i + 4 - corner) % 4;
			faces.set(id, { id, ring: child.ring.map((_, i) => child.ring[rotate(i)]), level: 0 });
			parents.set(id, {
				id: child.parent.id,
				group: cellId(c, r),
				parcel: child.parcel,
				sides: child.parent.ring.length,
				mask: (child.front << corner) | (child.back << ((corner + 3) % 4))
			});
		}
	}

	const fixed = fixedFrontages(parents, faces);
	for (const id of cuts.points.keys()) fixed.add(id);
	const relaxed = kern.relax(
		{ ...intent, positions, faces, fixed },
		settled ? profile.relaxPasses : 0
	);
	return {
		faces,
		positions: relaxed.positions,
		parents,
		seams: cuts.seams,
		cutVertices: new Set(cuts.points.keys())
	};
}
