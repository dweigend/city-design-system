import type { GridGenerator, GridKind, ParamSpec, Point2 } from '../vocab';
import { random } from '../random';
import { area, cell, clip, convexParts, cross, grid, intersect, key, subdivide } from './geometry';
const param = (
	key: string,
	label: string,
	min: number,
	max: number,
	step: number,
	value: number
): ParamSpec => ({ key, label, min, max, step, default: value });
const size = param('size', 'Cell size', 2, 8, 0.5, 5),
	count = param('count', 'Fields', 2, 8, 1, 5),
	relax = param('relax', 'Relaxation', 0, 8, 1, 3);
export const defaults = (g: GridGenerator) =>
	Object.fromEntries(g.params.map((p) => [p.key, p.default]));
const rect = (x: number, y: number, w: number, h: number): Point2[] => [
	[x, y],
	[x + w, y],
	[x + w, y + h],
	[x, y + h]
];
function regular(kind: GridKind, n: number, s: number, levels = 1) {
	const cells = [];
	let y = 0;
	for (let j = 0; j < n; j++) {
		let x = 0;
		const h = kind === 'axis' ? (j % 2 ? 7.2 : 3.6) : s;
		for (let i = 0; i < n; i++) {
			const w = kind === 'axis' ? (i % 2 ? 7.2 : 3.6) : s;
			for (let l = 0; l < levels; l++) cells.push(cell(rect(x, y, w, h), `${i}-${j}-${l}`, l));
			x += w;
		}
		y += h;
	}
	return grid(kind, cells);
}
function hexagons(n: number, s: number) {
	const out: Point2[][] = [];
	for (let q = -n; q <= n; q++)
		for (let r = -n; r <= n; r++)
			if (Math.abs(q + r) <= n) {
				const x = s * 1.5 * q,
					y = s * Math.sqrt(3) * (r + q / 2);
				out.push(
					Array.from(
						{ length: 6 },
						(_, i) =>
							[x + s * Math.cos((i * Math.PI) / 3), y + s * Math.sin((i * Math.PI) / 3)] as Point2
					)
				);
			}
	return out;
}
function irregular(n: number, s: number, seed: number, iterations: number) {
	const rng = random(seed),
		tris = hexagons(n, s).flatMap((p) => p.map((v, i) => [cell(p, '').center, v, p[(i + 1) % 6]]));
	const used = new Set<number>(),
		polys: Point2[][] = [];
	for (const i of tris
		.map((_, i) => ({ i, r: rng() }))
		.sort((a, b) => a.r - b.r)
		.map((v) => v.i)) {
		if (used.has(i)) continue;
		used.add(i);
		let merged = false;
		for (let j = 0; j < tris.length; j++) {
			if (used.has(j)) continue;
			const vertices = [...new Map([...tris[i], ...tris[j]].map((p) => [key(p), p])).values()];
			if (vertices.length !== 4) continue;
			const center: Point2 = [
				vertices.reduce((s, v) => s + v[0], 0) / 4,
				vertices.reduce((s, v) => s + v[1], 0) / 4
			];
			vertices.sort(
				(a, b) =>
					Math.atan2(a[1] - center[1], a[0] - center[0]) -
					Math.atan2(b[1] - center[1], b[0] - center[0])
			);
			if (vertices.every((v, k) => cross(v, vertices[(k + 1) % 4], vertices[(k + 2) % 4]) > 1e-8)) {
				polys.push(vertices);
				used.add(j);
				merged = true;
				break;
			}
		}
		if (!merged) polys.push(tris[i]);
	}
	let quads = polys.flatMap(subdivide);
	const edges = new Map<string, number>();
	quads.forEach((p) =>
		p.forEach((a, i) => {
			const k = [key(a), key(p[(i + 1) % p.length])].sort().join('|');
			edges.set(k, (edges.get(k) ?? 0) + 1);
		})
	);
	const fixed = new Set([...edges].filter(([, n]) => n === 1).flatMap(([k]) => k.split('|')));
	for (let iteration = 0; iteration < iterations; iteration++) {
		const neighbors = new Map<string, Point2[]>();
		quads.forEach((p) =>
			p.forEach((a, i) =>
				neighbors.set(key(a), [...(neighbors.get(key(a)) ?? []), p[(i + 1) % 4], p[(i + 3) % 4]])
			)
		);
		const moved = new Map<string, Point2>();
		for (const [k, ns] of neighbors) {
			const original = k.split(',').map(Number) as Point2;
			moved.set(
				k,
				fixed.has(k)
					? original
					: [
							original[0] * 0.65 + (0.35 * ns.reduce((s, v) => s + v[0], 0)) / ns.length,
							original[1] * 0.65 + (0.35 * ns.reduce((s, v) => s + v[1], 0)) / ns.length
						]
			);
		}
		const candidate = quads.map((p) => p.map((v) => moved.get(key(v))!));
		if (candidate.every((p) => p.every((v, i) => cross(v, p[(i + 1) % 4], p[(i + 2) % 4]) > 1e-8)))
			quads = candidate;
	}
	return grid(
		'quad-irregular',
		quads.map((p, i) => cell(p, String(i)))
	);
}
function validateBoundary(p: Point2[]) {
	if (p.length < 3 || p.some((v) => v.some((n) => !Number.isFinite(n))) || Math.abs(area(p)) < 1e-7)
		throw new Error('A nondegenerate simple polygon is required');
}
/** Drops duplicate and collinear vertices; returns a CCW polygon. */
function tidy(p: Point2[]): Point2[] {
	const q = area(p) > 0 ? [...p] : [...p].reverse();
	for (let changed = true; changed && q.length > 3;) {
		changed = false;
		for (let i = 0; i < q.length; i++) {
			const a = q[(i + q.length - 1) % q.length],
				b = q[i],
				c = q[(i + 1) % q.length];
			const len = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
			if (key(a) === key(b) || Math.abs(cross(a, b, c)) < 1e-7 * len) {
				q.splice(i, 1);
				changed = true;
				break;
			}
		}
	}
	return q;
}
/** Splits a clip result that touches itself (disconnected pieces joined at a point). */
function loops(p: Point2[]): Point2[][] {
	for (let i = 0; i < p.length; i++)
		for (let j = i + 1; j < p.length; j++)
			if (key(p[i]) === key(p[j]))
				return [...loops(p.slice(i, j)), ...loops([...p.slice(j), ...p.slice(0, i)])];
	return p.length >= 3 && area(p) > 1e-7 ? [tidy(p)] : [];
}
/** Every edge sees the centroid on its left: no fans, no folded cells. */
const starShaped = (p: Point2[]) => {
	const c = cell(p, '').center;
	return p.every((v, i) => cross(v, p[(i + 1) % p.length], c) >= -1e-6);
};
/**
 * Inward offset by d (mitred). Null when an edge would flip or vanish, i.e. the band
 * is too wide for this contour; the caller then falls back to a plain clip.
 */
function offset(p: Point2[], d: number): Point2[] | null {
	const n = p.length;
	const line = (i: number) => {
		const a = p[i],
			b = p[(i + 1) % n],
			len = Math.hypot(b[0] - a[0], b[1] - a[1]);
		const normal: Point2 = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
		return {
			a: [a[0] + normal[0] * d, a[1] + normal[1] * d] as Point2,
			dir: [b[0] - a[0], b[1] - a[1]] as Point2
		};
	};
	const q: Point2[] = [];
	for (let i = 0; i < n; i++) {
		const l0 = line((i + n - 1) % n),
			l1 = line(i);
		const den = l0.dir[0] * l1.dir[1] - l0.dir[1] * l1.dir[0];
		if (Math.abs(den) < 1e-9) return null;
		const t = ((l1.a[0] - l0.a[0]) * l1.dir[1] - (l1.a[1] - l0.a[1]) * l1.dir[0]) / den;
		q.push([l0.a[0] + l0.dir[0] * t, l0.a[1] + l0.dir[1] * t]);
	}
	for (let i = 0; i < n; i++) {
		const o = [p[(i + 1) % n][0] - p[i][0], p[(i + 1) % n][1] - p[i][1]],
			w = [q[(i + 1) % n][0] - q[i][0], q[(i + 1) % n][1] - q[i][1]];
		if (o[0] * w[0] + o[1] * w[1] <= 1e-6 * Math.hypot(o[0], o[1])) return null;
	}
	return area(q) > 0 ? q : null;
}
const perimeter = (p: Point2[]) =>
	p.reduce(
		(t, v, i) => t + Math.hypot(p[(i + 1) % p.length][0] - v[0], p[(i + 1) % p.length][1] - v[1]),
		0
	);
/**
 * Band of cells along a free contour: one strip per edge with square cuts, a kite at
 * every corner (convex: between the feet of the inner corner; reflex: between the
 * offset points). Null if the contour is too tight for the band.
 */
function contourBand(outer: Point2[], band: number, s: number): Point2[][] | null {
	const inner = offset(outer, band);
	if (!inner) return null;
	const n = outer.length;
	const unit = (a: Point2, b: Point2): Point2 => {
		const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
		return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
	};
	const add = (p: Point2, d: Point2, t: number): Point2 => [p[0] + d[0] * t, p[1] + d[1] * t];
	const convex = (i: number) => cross(outer[(i + n - 1) % n], outer[i], outer[(i + 1) % n]) > 0;
	/** Outer and inner end of edge i's strip at its corner k (k = i start, k = i + 1 end). */
	const end = (i: number, k: number): [Point2, Point2] => {
		const a = outer[i],
			t = unit(a, outer[(i + 1) % n]),
			nrm: Point2 = [-t[1], t[0]],
			v = outer[k % n],
			d = inner[k % n];
		if (convex(k % n)) {
			const along = (d[0] - a[0]) * t[0] + (d[1] - a[1]) * t[1];
			return [add(a, t, along), d];
		}
		return [v, add(v, nrm, band)];
	};
	const cells: Point2[][] = [];
	for (let i = 0; i < n; i++) {
		const [s0, s1] = end(i, i),
			[e0, e1] = end(i, i + 1),
			t = unit(outer[i], outer[(i + 1) % n]);
		const len = (e0[0] - s0[0]) * t[0] + (e0[1] - s0[1]) * t[1];
		if (len < s * 0.25) return null;
		const m = Math.max(1, Math.round(len / s));
		for (let k = 0; k < m; k++)
			cells.push([
				add(s0, t, (len * k) / m),
				add(s0, t, (len * (k + 1)) / m),
				add(s1, t, (len * (k + 1)) / m),
				add(s1, t, (len * k) / m)
			]);
		// Corner kite at the end of edge i: own end, the corner, next edge's start.
		const [n0, n1] = end((i + 1) % n, i + 1);
		const corner = outer[(i + 1) % n];
		cells.push(convex((i + 1) % n) ? [e0, corner, n0, e1] : [corner, n1, inner[(i + 1) % n], e1]);
	}
	return cells.map((c) => (area(c) < 0 ? c.reverse() : c));
}
/** Inserts the vertices of b that lie inside the edges of a (T-junctions). */
function splitBy(a: Point2[], b: Point2[]): Point2[] {
	return a.flatMap((p, i) => {
		const q = a[(i + 1) % a.length],
			len = Math.hypot(q[0] - p[0], q[1] - p[1]);
		const t = (v: Point2) =>
			((v[0] - p[0]) * (q[0] - p[0]) + (v[1] - p[1]) * (q[1] - p[1])) / len ** 2;
		const inner = b
			.filter((v) => Math.abs(cross(p, q, v)) < 1e-6 * len && t(v) > 1e-6 && t(v) < 1 - 1e-6)
			.sort((u, v) => t(u) - t(v));
		return [p, ...inner];
	});
}
/** Union of two cells sharing an edge; null unless the result is one clean loop. */
function union(a: Point2[], b: Point2[]): Point2[] | null {
	const loop = (p: Point2[]) => p.map((v, i) => [v, p[(i + 1) % p.length]] as [Point2, Point2]);
	const id = ([p, q]: [Point2, Point2]) => `${key(p)}>${key(q)}`;
	const ea = loop(splitBy(a, b)),
		eb = loop(splitBy(b, a));
	// Only edges shared between the two cells cancel (a→b in one, b→a in the other).
	const inA = new Set(ea.map(id)),
		inB = new Set(eb.map(id));
	const rest = [
		...ea.filter(([p, q]) => !inB.has(id([q, p]))),
		...eb.filter(([p, q]) => !inA.has(id([q, p])))
	];
	if (rest.length === ea.length + eb.length) return null;
	const next = new Map(rest.map((e) => [key(e[0]), e]));
	if (next.size !== rest.length) return null;
	const out: Point2[] = [];
	let e = rest[0];
	for (let i = 0; i < rest.length; i++) {
		out.push(e[0]);
		e = next.get(key(e[1]))!;
		if (!e || (e === rest[0] && i < rest.length - 1)) return null;
	}
	return e === rest[0] ? tidy(out) : null;
}
/**
 * Contour grid: the free (existing) contour keeps a band of cells along every edge,
 * the interior is a rotated regular grid clipped to the inner contour. Slivers merge
 * into a neighbor, so no cell collapses into a fan. Concave contours are clipped as a
 * whole (not per triangle), which keeps grid squares intact.
 */
export function contourGrid(boundary: Point2[], s = 5, angle = 0) {
	if (!Number.isFinite(s) || s <= 0 || !Number.isFinite(angle))
		throw new Error('Positive cell size and finite angle required');
	validateBoundary(boundary);
	const outer = tidy(boundary),
		r = (angle * Math.PI) / 180;
	const band = s * 0.6;
	const polys = contourBand(outer, band, s);
	const inner = polys ? offset(outer, band)! : outer;
	const rotate = (p: Point2, a: number): Point2 => [
		p[0] * Math.cos(a) - p[1] * Math.sin(a),
		p[0] * Math.sin(a) + p[1] * Math.cos(a)
	];
	const local = inner.map((p) => rotate(p, -r));
	const xs = local.map((p) => p[0]),
		ys = local.map((p) => p[1]);
	// Grid anchored on the inner contour's centroid, so the pattern is centered, not cornered.
	const [cx, cy] = rotate(cell(inner, '').center, -r);
	const x0 = cx - Math.ceil((cx - Math.min(...xs)) / s) * s,
		y0 = cy - Math.ceil((cy - Math.min(...ys)) / s) * s;
	let interior: Point2[][] = [];
	for (let x = x0; x < Math.max(...xs); x += s)
		for (let y = y0; y < Math.max(...ys); y += s) {
			const p = intersect(
				inner,
				rect(x, y, s, s).map((p) => rotate(p, r))
			);
			interior.push(...loops(p));
		}
	// A square around a reflex corner of the contour is concave: cut it along the corner's edge line.
	const cut = (p: Point2[], depth = 0): Point2[][] => {
		if (starShaped(p) || depth > 3) return [p];
		const i = p.findIndex(
			(v, k) => cross(p[(k + p.length - 1) % p.length], v, p[(k + 1) % p.length]) < -1e-9
		);
		// Cut along the line of an edge at the reflex corner; keep the first cut that
		// splits the cell into two pieces without losing area.
		const u = p[(i + p.length - 1) % p.length],
			v = p[i],
			w = p[(i + 1) % p.length];
		for (const [a, b] of [
			[u, v],
			[v, w]
		]) {
			const normal: Point2 = [b[1] - a[1], a[0] - b[0]],
				limit = normal[0] * v[0] + normal[1] * v[1];
			const pieces = [clip(p, normal, limit), clip(p, [-normal[0], -normal[1]], -limit)].flatMap(
				loops
			);
			const lost = Math.abs(pieces.reduce((t, q) => t + area(q), 0) - area(p));
			if (pieces.length >= 2 && lost < 1e-6 * Math.max(1, area(p)))
				return pieces.flatMap((q) => cut(q, depth + 1));
		}
		return [p];
	};
	interior = interior.flatMap((p) => cut(p));
	// Merge slivers (under a third of a module) into the neighbor with the cleanest union;
	// band cells may absorb them too. Merges that would fold a cell are skipped.
	const all = [...(polys ?? []), ...interior];
	const sliver = new Set(interior.map((_, i) => i + (polys?.length ?? 0)));
	for (let changed = true; changed;) {
		changed = false;
		const order = [...sliver]
			.filter((i) => area(all[i]) < s * s * 0.34)
			.sort((i, j) => area(all[i]) - area(all[j]));
		for (const i of order) {
			// Prefer a full neighbor, then the longest shared edge (perimeter saved).
			const options = all
				.map((q, j) => ({ j, u: j === i || !q.length ? null : union(all[i], q) }))
				.filter((o): o is { j: number; u: Point2[] } => !!o.u && starShaped(o.u))
				.map((o) => ({
					...o,
					small: area(all[o.j]) < s * s * 0.34,
					shared: perimeter(all[i]) + perimeter(all[o.j]) - perimeter(o.u)
				}))
				.sort((a, b) => Number(a.small) - Number(b.small) || b.shared - a.shared);
			if (!options.length) continue;
			const { j, u } = options[0];
			all[j] = u;
			all[i] = [];
			sliver.delete(i);
			changed = true;
			break;
		}
	}
	return grid(
		'contour',
		all
			.filter((p) => p.length)
			.flatMap((p) => cut(p))
			.map((p, i) => cell(p, String(i)))
	);
}
export function voronoiGrid(boundary: Point2[], number = 30, seed = 42, iterations = 3) {
	validateBoundary(boundary);
	if (
		!Number.isInteger(number) ||
		number < 1 ||
		number > 500 ||
		!Number.isInteger(iterations) ||
		iterations < 0 ||
		iterations > 50
	)
		throw new Error('Invalid Voronoi count or iterations');
	const rng = random(seed),
		parts = convexParts(boundary),
		xs = boundary.map((p) => p[0]),
		ys = boundary.map((p) => p[1]);
	let sites: Point2[] = [];
	while (sites.length < number) {
		const p: Point2 = [
			Math.min(...xs) + rng() * (Math.max(...xs) - Math.min(...xs)),
			Math.min(...ys) + rng() * (Math.max(...ys) - Math.min(...ys))
		];
		if (parts.some((q) => q.every((v, i) => cross(v, q[(i + 1) % q.length], p) >= 0)))
			sites.push(p);
	}
	const regions = () =>
		sites.map((a, i) =>
			parts
				.map((part) =>
					sites.reduce(
						(p, b, j) =>
							i === j
								? p
								: clip(
										p,
										[b[0] - a[0], b[1] - a[1]],
										(b[0] ** 2 + b[1] ** 2 - a[0] ** 2 - a[1] ** 2) / 2
									),
						part
					)
				)
				.filter((p) => p.length >= 3 && area(p) > 1e-7)
		);
	for (let t = 0; t < iterations; t++) {
		sites = regions().map((ps, i) => {
			const cs = ps.map((p) => cell(p, '')),
				sum = cs.reduce((s, c) => s + c.area, 0);
			return sum
				? [
						cs.reduce((s, c) => s + c.center[0] * c.area, 0) / sum,
						cs.reduce((s, c) => s + c.center[1] * c.area, 0) / sum
					]
				: sites[i];
		});
	}
	return grid(
		'voronoi',
		regions()
			.flat()
			.map((p, i) => cell(p, String(i)))
	);
}
const specs: [GridKind, string, ParamSpec[]][] = [
	['square', 'Square', [count, size]],
	['axis', 'Axes', [count]],
	['triangle', 'Triangle', [count, size]],
	['hex', 'Hexagon', [param('count', 'Radius in cells', 1, 4, 1, 2), size]],
	['quad-irregular', 'Free quad', [param('count', 'Radius in cells', 1, 3, 1, 2), size, relax]],
	['voronoi', 'Voronoi', [param('sites', 'Seed points', 8, 60, 1, 24), relax]],
	[
		'polar',
		'Polar',
		[param('rings', 'Rings', 1, 6, 1, 3), param('sectors', 'Sectors', 6, 24, 1, 12), size]
	],
	[
		'contour',
		'Contour',
		[size, param('angle', 'Rotation', 0, 90, 1, 17), param('notch', 'Notch', 0, 12, 1, 7)]
	],
	[
		'vertical',
		'Floors',
		[param('count', 'Fields', 2, 5, 1, 3), size, param('levels', 'Floors', 1, 6, 1, 3)]
	]
];
export const gridGenerators: GridGenerator[] = specs.map(([kind, name, params]) => ({
	kind,
	name,
	params,
	generate(input, seed) {
		const p = Object.fromEntries(
			params.map((s) => {
				const v = input[s.key] ?? s.default;
				return [s.key, Math.max(s.min, Math.min(s.max, Number.isFinite(v) ? v : s.default))];
			})
		);
		const n = Math.round(p.count ?? 3),
			s = p.size ?? 5;
		if (kind === 'square' || kind === 'axis' || kind === 'vertical')
			return regular(kind, n, s, Math.round(p.levels ?? 1));
		if (kind === 'hex')
			return grid(
				kind,
				hexagons(n, s).map((p, i) => cell(p, String(i)))
			);
		if (kind === 'quad-irregular') return irregular(n, s, seed, Math.round(p.relax));
		if (kind === 'voronoi')
			return voronoiGrid(rect(-15, -15, 30, 30), Math.round(p.sites), seed, Math.round(p.relax));
		if (kind === 'contour')
			return contourGrid(
				[
					[0, 0],
					[30, 0],
					[30, 23],
					[18, 23 - p.notch],
					[0, 23]
				],
				s,
				p.angle
			);
		if (kind === 'triangle') {
			const cells = [];
			for (let y = 0; y < n; y++)
				for (let x = 0; x < n; x++) {
					const a: Point2 = [s * (x + y / 2), ((s * Math.sqrt(3)) / 2) * y],
						b: Point2 = [a[0] + s, a[1]],
						c: Point2 = [a[0] + s / 2, a[1] + (s * Math.sqrt(3)) / 2],
						d: Point2 = [c[0] + s, c[1]];
					cells.push(cell([a, b, c], `${x}-${y}-a`), cell([b, d, c], `${x}-${y}-b`));
				}
			return grid(kind, cells);
		}
		const cells = [];
		const sectors = Math.round(p.sectors);
		for (let r = 0; r < Math.round(p.rings); r++)
			for (let i = 0; i < sectors; i++) {
				const at = (radius: number, j: number): Point2 => [
					radius * Math.cos((j * 2 * Math.PI) / sectors),
					radius * Math.sin((j * 2 * Math.PI) / sectors)
				];
				cells.push(
					cell(
						r === 0
							? [[0, 0], at(s, i), at(s, i + 1)]
							: [at(r * s, i), at((r + 1) * s, i), at((r + 1) * s, i + 1), at(r * s, i + 1)],
						`${r}-${i}`
					)
				);
			}
		return grid(kind, cells);
	}
}));
