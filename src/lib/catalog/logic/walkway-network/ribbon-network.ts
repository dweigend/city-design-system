import { required } from '../required';
import { routeChains } from './route-chains';
import { type Vec3 } from '../parametrik/types';
import { ribbonCurve } from './ribbon-curve';
import { ribbonProfile } from './ribbon-column';
type Station = { position: Vec3; arms: string[] };
type Port = { centre: Vec3; left: Vec3; right: Vec3; dx: number; dy: number };

function ports(stations: Map<string, Station>, id: string, s: Station) {
	const arms = s.arms
		.map((neighbour) => {
			const q = required(stations.get(neighbour), 'ribbon station').position;
			const dx = q[0] - s.position[0],
				dy = q[1] - s.position[1],
				d = Math.hypot(dx, dy);
			return { neighbour, angle: Math.atan2(dy, dx), dx: dx / d, dy: dy / d, d };
		})
		.sort((a, b) => a.angle - b.angle);
	return arms.map(({ neighbour, angle, dx, dy, d }, i) => {
		const turn = Math.min(
			...arms
				.filter((_, j) => i !== j)
				.map((a) => Math.acos(Math.min(1, Math.max(-1, Math.cos(angle - a.angle)))))
		);
		const h = ribbonProfile.width / 2,
			setback = Math.min(
				d * (required(stations.get(neighbour), 'ribbon station').arms.length === 2 ? 0.82 : 0.48),
				h / Math.tan(turn / 2) + 1.45
			);
		const at = (off: number): Vec3 => [
			s.position[0] + dx * setback - dy * off,
			s.position[1] + dy * setback + dx * off,
			s.position[2]
		];
		return { id: id + '>' + neighbour, centre: at(0), left: at(h), right: at(-h), dx, dy };
	});
}
function fillet(a: Port, b: Port) {
	const start = a.left,
		end = b.right;
	const den = a.dx * b.dy - a.dy * b.dx;
	const x = end[0] - start[0],
		y = end[1] - start[1];
	const reach = Math.hypot(x, y) * 0.52;
	const handle = (n: number) =>
		Math.abs(den) > 1e-7 ? Math.min(reach, Math.abs(n / den) * 0.72) : reach;
	const l = handle(x * b.dy - y * b.dx),
		r = handle(a.dx * y - a.dy * x);
	const c: Vec3 = [start[0] - a.dx * l, start[1] - a.dy * l, start[2]],
		d: Vec3 = [end[0] - b.dx * r, end[1] - b.dy * r, end[2]];
	return Array.from({ length: 25 }, (_, i) => {
		const t = i / 24,
			u = 1 - t;
		return start.map(
			(v, k) => u ** 3 * v + 3 * u * u * t * c[k] + 3 * u * t * t * d[k] + t ** 3 * end[k]
		) as Vec3;
	});
}
/** Separates fork mouths before tracing uninterrupted reaches, including loops. */
export function ribbonNetwork(routes: readonly string[][], stations: Map<string, Station>) {
	const mouths = new Map<string, Port>(),
		hubs = new Map<string, string>();
	const forks = [...stations]
		.filter(([, s]) => s.arms.length >= 3)
		.map(([id, s]) => {
			const arms = ports(stations, id, s);
			for (const p of arms) {
				mouths.set(p.id, p);
				hubs.set(p.id, id);
			}
			return {
				id,
				position: s.position,
				rim: arms.map((p, i) => fillet(p, arms[(i + 1) % arms.length]))
			};
		});
	const name = (a: string, b: string) => (mouths.has(a + '>' + b) ? a + '>' + b : a);
	const links = routes.flatMap((path) =>
		path.slice(1).map((to, i) => [name(path[i], to), name(to, path[i])] as const)
	);
	const point = (id: string) =>
		mouths.get(id)?.centre ?? required(stations.get(id), 'ribbon station').position;
	const reaches = routeChains(links).map((chain) => {
		const path = chain.map(point),
			terminals = [chain[0], chain[chain.length - 1]];
		const station = (id: string) => hubs.get(id) ?? id;
		return {
			id: 'town-walk/' + station(chain[0]) + '>' + station(chain[1]),
			terminals,
			sections: ribbonCurve(path, ribbonProfile.width, terminals[0] === terminals[1]),
			ends: [path[0], path[path.length - 1]],
			hubs: terminals.map((id) => hubs.get(id))
		};
	});
	return { reaches, forks };
}
