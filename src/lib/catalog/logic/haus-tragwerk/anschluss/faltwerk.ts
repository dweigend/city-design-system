import type { TraegerPlan, Vec3 } from '../../traeger/plan';
import { anschluss, rechteck } from '../plan';
/** Clip a planar roof facet to the usable strip. Linear extrema occur on clipped vertices. */
function streifen(ring: Vec3[], axis: 0 | 1, limit: number, sign: number): Vec3[] {
	const out: Vec3[] = [];
	for (let i = 0; i < ring.length; i++) {
		const a = ring[i],
			b = ring[(i + 1) % ring.length];
		const inside = sign * (a[axis] - limit) >= 0,
			next = sign * (b[axis] - limit) >= 0;
		if (inside) out.push(a);
		if (inside !== next) {
			const t = (limit - a[axis]) / (b[axis] - a[axis]);
			out.push(a.map((v, j) => v + t * (b[j] - v)) as Vec3);
		}
	}
	return out;
}
/** Central usable strip under both folded sheets; no paneel or crease is modified. */
export function faltwerk(p: TraegerPlan) {
	const nodes = new Map(p.knoten.map((n) => [n.id, n.p]));
	const ys = p.knoten.map((n) => n.p[1]);
	const minY = Math.min(...ys),
		maxY = Math.max(...ys),
		width = 2.6;
	const heights: number[] = [];
	for (const f of p.flaechen.filter((f) => /^faltwerk:f:[01]:/.test(f.id))) {
		let ring = f.knoten.flatMap((id) => {
			const n = nodes.get(id);
			return n ? [n] : [];
		});
		ring = streifen(ring, 1, minY + (2 * (maxY - minY)) / p.werte.felder, -1);
		ring = streifen(ring, 0, -width / 2, 1);
		ring = streifen(ring, 0, width / 2, -1);
		heights.push(...ring.map((p) => p[2]));
	}
	const height = heights.length ? Math.min(3.5, Math.min(...heights) - 8) : 0;
	const a = anschluss(
		'faltwerk:z:haus',
		'tragende-huelle',
		rechteck(-width / 2, minY, width, (2 * (maxY - minY)) / p.werte.felder),
		8,
		height,
		p.knoten.filter((n) => n.id.startsWith('faltwerk:first:')).map((n) => n.id)
	);
	a.tuer.p = [0, minY, 8];
	a.tuer.tangente = [1, 0];
	return [a];
}
