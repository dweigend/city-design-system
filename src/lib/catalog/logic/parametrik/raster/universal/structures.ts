import type { Patch } from '../../eckraster/topology';
import type { Point2 } from '../../vocab';
import type { Block, StructureOptions, Structures } from './types';
/** Dependency halo for local field/geometry updates; topology changes require a full rebuild. */
export function affectedRegion(patch: Patch, changed: Iterable<string>, rings = 2): Set<string> {
	const byId = new Map(patch.vertices.map((v) => [v.id, v]));
	const result = new Set([...changed].filter((id) => byId.has(id)));
	let frontier = [...result];
	for (let i = 0; i < rings; i++) {
		const next: string[] = [];
		for (const id of frontier)
			for (const n of byId.get(id)!.neighbors)
				if (!result.has(n)) {
					result.add(n);
					next.push(n);
				}
		frontier = next;
	}
	return result;
}
export function strukturen(patch: Patch, opts: StructureOptions = {}): Structures {
	const byId = new Map(patch.vertices.map((v) => [v.id, v]));
	const neighbors = new Map(patch.vertices.map((v) => [v.id, [...v.neighbors]]));
	const orientation = new Map(patch.cells.map((c) => [c.id, c.orientation]));
	const center: Point2 = opts.center ?? [
		patch.vertices.reduce((s, v) => s + v.point[0], 0) / (patch.vertices.length || 1),
		patch.vertices.reduce((s, v) => s + v.point[1], 0) / (patch.vertices.length || 1)
	];
	const radius = Math.max(
		1,
		...patch.vertices.map((v) => Math.hypot(v.point[0] - center[0], v.point[1] - center[1]))
	);
	const fields = new Map(
		patch.vertices.map((v) => {
			const naehe = Math.max(
				0,
				1 - Math.hypot(v.point[0] - center[0], v.point[1] - center[1]) / radius
			);
			return [
				v.id,
				{ naehe, dichte: Math.max(0, Math.min(1, (opts.density ?? 0.8) * (0.4 + 0.6 * naehe))) }
			];
		})
	);
	const labels = new Map<string, string>();
	const size = Math.max(1, opts.blockSize ?? 25);
	// Region growth uses accumulated edge lengths, never raster indices.
	for (const root of patch.vertices) {
		if (labels.has(root.id)) continue;
		labels.set(root.id, root.id);
		const queue: [string, number][] = [[root.id, 0]];
		for (let i = 0; i < queue.length; i++) {
			const [id, d] = queue[i],
				v = byId.get(id)!;
			for (const n of v.neighbors) {
				const w = byId.get(n)!,
					nd = d + Math.hypot(v.point[0] - w.point[0], v.point[1] - w.point[1]);
				if (nd > size / 2 || labels.has(n)) continue;
				labels.set(n, root.id);
				queue.push([n, nd]);
			}
		}
	}
	const alleys = new Set<string>(),
		squares = new Set<string>();
	for (const v of patch.vertices) {
		const regions = new Set([labels.get(v.id), ...v.neighbors.map((n) => labels.get(n))]);
		if (v.neighbors.some((n) => labels.get(n)! < labels.get(v.id)!)) alleys.add(v.id);
		if (regions.size >= 3) {
			squares.add(v.id);
			alleys.add(v.id);
		}
	}
	const blocks: Block[] = [],
		blockOf = new Map<string, Block>();
	for (const v of patch.vertices) {
		if (alleys.has(v.id) || blockOf.has(v.id)) continue;
		const block: Block = {
			id: `block:${v.id}`,
			cells: [],
			center: [0, 0],
			naehe: 0,
			seed: patch.seed
		};
		const queue = [v.id];
		blockOf.set(v.id, block);
		for (let i = 0; i < queue.length; i++) {
			const id = queue[i],
				w = byId.get(id)!;
			block.cells.push(id);
			block.center[0] += w.point[0];
			block.center[1] += w.point[1];
			block.naehe += fields.get(id)!.naehe;
			for (const n of w.neighbors)
				if (!alleys.has(n) && !blockOf.has(n)) {
					blockOf.set(n, block);
					queue.push(n);
				}
		}
		block.center = block.center.map((x) => x / block.cells.length) as Point2;
		block.naehe /= block.cells.length;
		for (const ch of block.id) block.seed = (Math.imul(block.seed, 31) + ch.charCodeAt(0)) >>> 0;
		blocks.push(block);
	}
	return {
		blocks,
		blockOf,
		parcels: blocks.flatMap((b) =>
			b.cells.map((id) => ({ id: `parcel:${id}`, block: b.id, cells: [id] }))
		),
		alleys,
		squares,
		fields,
		orientation,
		neighbors
	};
}
