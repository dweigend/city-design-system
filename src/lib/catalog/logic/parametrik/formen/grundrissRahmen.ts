/** Polygonal grid cells for space-filling frames. Meters, CCW, convex cells.
 * Grid and boundary are clipped before projection; the same cell edges carry
 * struts and bound the rooms. Free-standing boxes/beams stay in the rectangle kit.
 */
import type { Primitive, Vec3 } from '../types';
import type { Point2 } from '../vocab';
import type { Kit } from './kit';
import { area, inset, localBounds, rotate, scaleAbout } from './geom';

const EPS = 1e-7;
const cross = (a: Point2, b: Point2, p: Point2) =>
	(b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);

/** Convex intersection, preserving CCW order; boundary contact has no area. */
function intersection(subject: Point2[], boundary: Point2[]): Point2[] {
	let out = subject;
	for (let i = 0; i < boundary.length; i++) {
		const a = boundary[i],
			b = boundary[(i + 1) % boundary.length],
			input = out;
		out = [];
		for (let j = 0; j < input.length; j++) {
			const p = input[j],
				q = input[(j + 1) % input.length],
				dp = cross(a, b, p),
				dq = cross(a, b, q);
			if (dp >= -EPS) out.push(p);
			if ((dp > EPS && dq < -EPS) || (dp < -EPS && dq > EPS)) {
				const t = dp / (dp - dq);
				out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
			}
		}
	}
	return out.filter(
		(p, i) =>
			Math.hypot(p[0] - out[(i + 1) % out.length][0], p[1] - out[(i + 1) % out.length][1]) > EPS
	);
}

/** True only for the legacy rectangle aligned with the context. No RNG or mutation. */
export function rechteckigerRahmen(k: Kit): boolean {
	const b = localBounds(k.ctx.footprint, k.ctx.center, k.rot);
	return (
		k.ctx.footprint.length === 4 &&
		k.ctx.footprint.every((p) => {
			const [u, v] = rotate([p[0] - k.ctx.center[0], p[1] - k.ctx.center[1]], -k.rot);
			return (
				Math.min(Math.abs(u - b.minU), Math.abs(u - b.maxU)) < EPS &&
				Math.min(Math.abs(v - b.minV), Math.abs(v - b.maxV)) < EPS
			);
		})
	);
}

/** Detached primitives, stable raster order u/v/story. Occupancy draws per cell/story.
 * The pull-out is limited by the owning cell, so it cannot enter a neighbor or cross a bar.
 * Tiny boundary cells carry the frame but no room (minimum room area 0.36 m²).
 */
export function grundrissRahmen(k: Kit, p: Record<string, number>, plugin: boolean): Primitive[] {
	const ctx = k.ctx,
		b = localBounds(ctx.footprint, ctx.center, k.rot);
	const local = ctx.footprint.map((q) =>
		rotate([q[0] - ctx.center[0], q[1] - ctx.center[1]], -k.rot)
	);
	const world = ([u, v]: Point2): Point2 => {
		const q = rotate([u, v], k.rot);
		return [q[0] + ctx.center[0], q[1] + ctx.center[1]];
	};
	const nu = plugin ? Math.max(1, Math.round((b.maxU - b.minU) / 4)) : p.felder;
	const nv = plugin ? Math.max(1, Math.round((b.maxV - b.minV) / 4)) : p.felder;
	const floors = plugin ? p.geschosse : p.felder;
	const height = plugin ? ctx.height : Math.min(b.maxU - b.minU, b.maxV - b.minV, ctx.height);
	const fh = height / floors,
		cu = (b.maxU - b.minU) / nu,
		cv = (b.maxV - b.minV) / nv;
	const bar = plugin ? 0.22 : p.stab,
		margin = Math.max(plugin ? 0.25 : 0.15, bar / 2 + 0.04);
	const out: Primitive[] = [],
		seen = new Set<string>();
	const members: [Vec3, Vec3][] = [];
	const at = (q: Point2, z: number): Vec3 => [...world(q), z];
	const member = (a: Vec3, b: Vec3) => {
		const key = [a, b]
			.map((p) => p.map((v) => Math.round(v / EPS)).join(','))
			.sort()
			.join('/');
		if (seen.has(key)) return;
		seen.add(key);
		members.push([a, b]);
	};
	for (let i = 0; i < nu; i++)
		for (let j = 0; j < nv; j++) {
			const u = b.minU + i * cu,
				v = b.minV + j * cv;
			const cell = intersection(
				[
					[u, v],
					[u + cu, v],
					[u + cu, v + cv],
					[u, v + cv]
				],
				local
			);
			if (cell.length < 3 || area(cell) < EPS) continue;
			for (let f = 0; f <= floors; f++)
				for (let e = 0; e < cell.length; e++) {
					const a = cell[e],
						q = cell[(e + 1) % cell.length],
						z = ctx.z + f * fh;
					member(at(a, z), at(q, z));
					if (f < floors) {
						member(at(a, z), at(a, z + fh));
						if (plugin) member(at(a, z), at(q, z + fh));
					}
				}
			const center: Point2 = [
				cell.reduce((s, p) => s + p[0], 0) / cell.length,
				cell.reduce((s, p) => s + p[1], 0) / cell.length
			];
			// Reserve travel space independently of the slider: the pull-out translates, never reshapes.
			const room = scaleAbout(inset(cell, margin, center), center, plugin ? 0.75 : 1);
			const usable =
				room.length >= 3 &&
				area(room) > 0.36 &&
				room.every((q) => cell.every((a, e) => cross(a, cell[(e + 1) % cell.length], q) >= -EPS));
			for (let f = 0; f < floors; f++) {
				if (k.rng() > p.belegung * (plugin ? 1 : 1 - f * 0.15)) continue;
				// The drawer remains attached to its actual polygon cell even at full extension.
				const travel = plugin ? k.rng() : 0;
				const direction = plugin ? (k.rng() < 0.5 ? -1 : 1) : 0;
				if (!usable) continue;
				let limit = cu * 0.45;
				for (let e = 0; e < cell.length; e++) {
					const a = cell[e],
						b = cell[(e + 1) % cell.length];
					const derivative = -(b[1] - a[1]) * direction;
					if (derivative >= -EPS) continue;
					const clearance = (bar / 2 + 0.04) * Math.hypot(b[0] - a[0], b[1] - a[1]);
					for (const q of room) limit = Math.min(limit, (cross(a, b, q) - clearance) / -derivative);
				}
				const slide = plugin ? p.ausschub * (0.5 + travel * 0.5) * Math.max(0, limit) : 0;
				const shape = room.map(([x, y]): Point2 => [x + slide * direction, y]);
				out.push(
					k.prism(shape.map(world), ctx.z + f * fh + 0.15, fh - 0.3, k.tone(f % 3), { rank: 0 })
				);
			}
		}
	const xs = ctx.footprint.map((p) => p[0]),
		ys = ctx.footprint.map((p) => p[1]);
	const frame = k.frame(0, 0, ctx.z, 1, 1, height, [nu, nv, floors], bar, '--paper', { rank: 1 });
	out.unshift({
		...frame,
		kind: 'frame',
		members,
		position: [Math.min(...xs), Math.min(...ys), ctx.z],
		size: [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), height],
		cells: [nu, nv, floors],
		bar,
		rotation: 0
	});
	return out;
}
