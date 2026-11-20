import { required } from '../required';
import { easedRun, ribbonRise } from './ribbon-rise';
import type { Vec3 } from '../parametrik/types';
import { walkingProfile } from './walking-profile';
import type { ribbonNetwork } from './ribbon-network';
type Network = ReturnType<typeof ribbonNetwork>;
type Node = { floor: number; ceiling: number; links: { to: Node; run: number }[] };
const node = (): Node => ({ floor: -Infinity, ceiling: Infinity, links: [] });
function propagate(nodes: Node[], slot: 'floor' | 'ceiling', sign: number) {
	const queue = nodes.filter((n) => Number.isFinite(n[slot]));
	const pending = new Set(queue);
	for (let i = 0; i < queue.length; i++) {
		const n = queue[i];
		pending.delete(n);
		for (const { to, run } of n.links) {
			const limit = n[slot] - sign * run * walkingProfile.gradeLimit;
			if (sign * (limit - to[slot]) <= 1e-9) continue;
			to[slot] = limit;
			if (!pending.has(to)) {
				pending.add(to);
				queue.push(to);
			}
		}
	}
}
function seat(p: Vec3, ground: (x: number, y: number) => number) {
	const value = ground(p[0], p[1]);
	return Number.isFinite(value) ? value : -Infinity;
}
type Reach = Network['reaches'][number];
function runs(sections: Reach['sections'], loop: boolean) {
	const ds = [0];
	for (let i = 1; i < sections.length; i++) {
		const a = sections[i - 1].centre,
			b = sections[i].centre;
		ds.push(ds[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
	}
	return loop ? ds : ds.map((x) => easedRun(x, ds[ds.length - 1]));
}
function link(a: Node, b: Node, run: number) {
	a.links.push({ to: b, run });
	b.links.push({ to: a, run });
}
function survey(
	{ sections, ends, hubs: keys }: Reach,
	hubs: Map<string, Node>,
	ground: (x: number, y: number) => number
) {
	const loop = ends[0].join(',') === ends[1].join(',');
	const distances = runs(sections, loop),
		row = sections.map(() => node());
	for (const side of [0, 1]) {
		const i = side * (sections.length - 1),
			key = keys[side];
		if (key) row[i] = required(hubs.get(key), 'ribbon fork');
		else if (!loop) row[i].ceiling = ends[side][2];
	}
	if (loop) row[row.length - 1] = row[0];
	for (const [i, s] of sections.entries()) {
		const cell = row[i];
		const soil = Math.max(...[s.left, s.centre, s.right].map((p) => seat(p, ground)));
		cell.floor = Math.max(cell.floor, s.centre[2], soil + 0.15);
		if (i) link(cell, row[i - 1], distances[i] - distances[i - 1]);
	}
	return { row, distances, loop };
}
/** Grades connected reaches together, with exact court levels and a common elevation at each fork. */
export function gradeRibbon({ reaches, forks }: Network, ground: (x: number, y: number) => number) {
	const hubs = new Map(forks.map((f) => [f.id, node()]));

	const rows = reaches.map((r) => survey(r, hubs, ground));
	const nodes = new Set(rows.flatMap((r) => r.row));
	propagate([...nodes], 'floor', 1);
	propagate([...nodes], 'ceiling', -1);
	const limited = rows.flatMap(({ row }, i) => {
		const r = reaches[i];
		if (!r.hubs.some(Boolean)) return [];
		return [0, 1].flatMap((side) => {
			if (r.hubs[side]) return [];
			const at = side ? row[row.length - 1] : row[0],
				other = side ? row[0] : row[row.length - 1];
			return at.floor > at.ceiling + 0.18
				? [{ reach: r, side, base: at.ceiling, top: other.floor }]
				: [];
		});
	});
	const z = (n: Node) => Math.min(n.floor, n.ceiling);
	for (const [r, { sections }] of reaches.entries()) {
		const { row, distances, loop } = rows[r],
			levels = ribbonRise(distances, row.map(z), loop);
		for (const [i, s] of sections.entries()) s.centre[2] = s.left[2] = s.right[2] = levels[i];
	}
	for (const f of forks) {
		const h = z(required(hubs.get(f.id), 'ribbon station'));
		f.position = [f.position[0], f.position[1], h];
		for (const edge of f.rim) for (const p of edge) p[2] = h;
	}
	return limited;
}
