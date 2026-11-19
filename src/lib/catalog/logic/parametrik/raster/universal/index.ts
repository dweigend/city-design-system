import { assemble } from '../../eckraster/topology';
import type { Point2 } from '../../vocab';
import { cell, convexParts, turnCross, key, midpoint } from '../geometry';
import { quality } from './quality';
import type { Origin, PatchOptions, UniversalGrid, UniversalPatch } from './types';
export * from './types';
export { strukturen, affectedRegion } from './structures';
export { organicGrid } from './organic';
export { quality };

/** Input must be a planar polygon tiling per level. Missing cells remain holes. */
export function toPatch(grid: UniversalGrid, opts: PatchOptions = {}): UniversalPatch {
	const origins = new Map<string, Origin>(),
		points = new Map<string, Point2>();
	const corners = new Map<string, string>();
	const sourceById = new Map(grid.cells.map((c) => [c.id, c]));
	const source = [...grid.cells].sort((a, b) => a.id.localeCompare(b.id));
	for (const c of source)
		c.polygon.forEach((p, i) => {
			const k = `${c.level}:${key(p)}`;
			let id = corners.get(k);
			if (!id) {
				id = `corner:${c.id}:${i}`;
				corners.set(k, id);
				points.set(id, [...p]);
				origins.set(id, {
					kind: 'corner',
					cells: [],
					level: c.level,
					boundary: false,
					fixed: false
				});
			}
			origins.get(id)!.cells.push(c.id);
		});
	const cornerPoints = [...points];
	const polygons: { id: string; vertices: string[] }[] = [];
	for (const c of source) {
		// Insert all hanging vertices on each edge before subdivision.
		const xs = c.polygon.map((p) => p[0]),
			ys = c.polygon.map((p) => p[1]);
		const minX = Math.min(...xs) - 1e-6,
			maxX = Math.max(...xs) + 1e-6;
		const minY = Math.min(...ys) - 1e-6,
			maxY = Math.max(...ys) + 1e-6;
		const candidates = cornerPoints.filter(
			([id, p]) =>
				origins.get(id)!.level === c.level &&
				p[0] >= minX &&
				p[0] <= maxX &&
				p[1] >= minY &&
				p[1] <= maxY
		);
		for (const [partIndex, part] of convexParts(c.polygon).entries()) {
			const ring = part.flatMap((a, i) => {
				const b = part[(i + 1) % part.length],
					dx = b[0] - a[0],
					dy = b[1] - a[1],
					l2 = dx * dx + dy * dy;
				return candidates
					.map(([id, p]) => ({ id, p, t: ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 }))
					.filter(
						(v) =>
							v.t >= -1e-7 &&
							v.t < 1 - 1e-7 &&
							Math.abs(turnCross(a, b, v.p)) < 1e-6 * Math.sqrt(l2)
					)
					.sort((u, v) => u.t - v.t)
					.map((v) => v.id);
			});
			const parent = `${c.id}/p${partIndex}`;
			const addCenter = (id: string, vs: string[]) => {
				points.set(
					id,
					cell(
						vs.map((v) => points.get(v)!),
						id
					).center
				);
				origins.set(id, {
					kind: 'center',
					cells: [c.id],
					level: c.level,
					boundary: false,
					fixed: false
				});
			};
			const center = `center:${parent}`;
			addCenter(center, ring);
			const collinear = ring.some(
				(v, i) =>
					turnCross(
						points.get(v)!,
						points.get(ring[(i + 1) % ring.length])!,
						points.get(ring[(i + 2) % ring.length])!
					) < 1e-8
			);
			const pieces = collinear
				? ring.map((v, i) => [v, ring[(i + 1) % ring.length], center])
				: [ring];
			pieces.forEach((vs, j) => {
				const ctr = collinear ? `center:${parent}/t${j}` : center;
				if (collinear) addCenter(ctr, vs);
				const edge = (a: string, b: string) => {
					const ends = [a, b].sort() as [string, string],
						id = `edge:${ends.join('|')}`;
					if (!points.has(id)) {
						points.set(id, midpoint(points.get(a)!, points.get(b)!));
						origins.set(id, {
							kind: 'edge',
							cells: [],
							edge: ends,
							level: c.level,
							boundary: false,
							fixed: false
						});
					}
					if (!origins.get(id)!.cells.includes(c.id)) origins.get(id)!.cells.push(c.id);
					return id;
				};
				vs.forEach((v, i) =>
					polygons.push({
						id: `face:${parent}/${j}/${i}`,
						vertices: [
							v,
							edge(v, vs[(i + 1) % vs.length]),
							ctr,
							edge(vs[(i + vs.length - 1) % vs.length], v)
						]
					})
				);
			});
		}
	}
	let patch = assemble(opts.seed ?? 42, points, polygons);
	if (opts.cellSize !== undefined) {
		if (!(opts.cellSize > 0)) throw new Error('cellSize must be positive');
		const lengths = patch.vertices
			.flatMap((v) =>
				v.neighbors
					.filter((n) => n > v.id)
					.map((n) => Math.hypot(v.point[0] - points.get(n)![0], v.point[1] - points.get(n)![1]))
			)
			.sort((a, b) => a - b);
		const scale = opts.cellSize / (lengths[Math.floor(lengths.length / 2)] || opts.cellSize);
		for (const [id, p] of points) points.set(id, [p[0] * scale, p[1] * scale]);
	}
	for (const v of patch.vertices) {
		const o = origins.get(v.id)!;
		o.boundary = v.boundary;
		o.fixed =
			v.boundary ||
			!!opts.fixedVertices?.has(v.id) ||
			o.cells.some((id) => opts.fixedCells?.has(id) || sourceById.get(id)?.role === 'bestand');
	}
	const shapes = () => polygons.map((p) => p.vertices.map((v) => points.get(v)!));
	const initial = quality(shapes());
	if (initial.minAngle <= 0 || initial.minArea <= 0)
		throw new Error('Input produces a folded or degenerate quad');
	const minAngle = Math.min(opts.minAngle ?? 5, initial.minAngle),
		minArea = Math.min(opts.minArea ?? 0.01, initial.minArea);
	for (let pass = 0; pass < (opts.iterations ?? 3); pass++) {
		const original = new Map(points);
		for (let step = 0.35; step > 0.001; step /= 2) {
			for (const v of patch.vertices) {
				if (origins.get(v.id)!.fixed) continue;
				const p = original.get(v.id)!,
					ns = v.neighbors.map((n) => original.get(n)!);
				points.set(v.id, [
					p[0] * (1 - step) + (step * ns.reduce((s, q) => s + q[0], 0)) / ns.length,
					p[1] * (1 - step) + (step * ns.reduce((s, q) => s + q[1], 0)) / ns.length
				]);
			}
			const q = quality(shapes());
			if (q.minAngle >= minAngle - 1e-8 && q.minArea >= minArea - 1e-8) break;
			for (const [id, p] of original) points.set(id, p);
		}
	}
	patch = assemble(opts.seed ?? 42, points, polygons);
	for (const c of patch.cells) c.level = origins.get(c.id)!.level;
	return {
		...patch,
		origins: new Map(patch.vertices.map((v) => [v.id, origins.get(v.id)!])),
		quality: quality(shapes())
	};
}

export { encodeState, decodeState } from './serialization';
export { updatePatch } from './update';

/** Strict, representation-free model. Legacy API remains unchanged. */
export * as kern from './kern';
