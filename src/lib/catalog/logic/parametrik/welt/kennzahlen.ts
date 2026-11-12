/** Comparison metrics: identical measurement for existing stock and every kernel part. */
import { quadQuality } from '../raster/universal/kern';
import { haeuser, cellOutline } from '../eckraster/bestand';
import { cellAt } from '../eckraster/topology';
import type { Point2 } from '../vocab';
import { teile } from './index';
import { zugang, MIN_FRONT } from './zugang';
import type { WeltParams } from './typen';
export const hash = (s: string) => {
	let h = 2166136261;
	for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	return (h >>> 0).toString(16).padStart(8, '0');
};
export function kennzahlen(p: WeltParams) {
	const { r, b, netz: n } = teile(p),
		qs = r.patch.faces.map((f) => quadQuality(f.vertices.map((v) => r.point.get(v)!))),
		z = zugang(r, b);
	const adj = n.knoten.map(() => [] as number[]),
		pt = (k: number) => r.point.get(n.knoten[k][0])!,
		len = (a: number, b: number) => Math.hypot(pt(a)[0] - pt(b)[0], pt(a)[1] - pt(b)[1]);
	for (const [a, b] of n.kanten) {
		adj[a].push(b);
		adj[b].push(a);
	}
	let knick = 0;
	for (let k = 0; k < adj.length; k++) {
		const [a, b] = adj[k];
		if (
			adj[k].length !== 2 ||
			n.knoten[k][1] === 0 ||
			n.knoten[a][1] !== n.knoten[k][1] ||
			n.knoten[b][1] !== n.knoten[k][1]
		)
			continue;
		const A = pt(a),
			B = pt(b),
			K = pt(k),
			dot = (K[0] - A[0]) * (B[0] - K[0]) + (K[1] - A[1]) * (B[1] - K[1]);
		knick += (Math.acos(Math.max(-1, Math.min(1, dot / (len(a, k) * len(k, b))))) * 180) / Math.PI;
	}
	const ds = n.knoten.map(() => Infinity),
		queue = new Set(n.knoten.map((_, i) => i));
	ds[n.start] = 0;
	while (queue.size) {
		let u = -1;
		for (const k of queue) if (u < 0 || ds[k] < ds[u]) u = k;
		if (u < 0 || !Number.isFinite(ds[u])) break;
		queue.delete(u);
		for (const v of adj[u]) ds[v] = Math.min(ds[v], ds[u] + len(u, v));
	}
	const detours = n.ziele
		.filter((z) => len(z.knoten, n.start) >= 10)
		.map((z) => ds[z.knoten] / len(z.knoten, n.start));
	const distance = (p: Point2, a: Point2, b: Point2) => {
		const dx = b[0] - a[0],
			dy = b[1] - a[1],
			t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
		return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
	};
	let dachMax = 0,
		dachZahl = 0;
	for (const h of haeuser(
		r.patch,
		b.samples,
		b.plan,
		p.kern.zugang ? (id) => !r.blockOf.has(id) : undefined
	)) {
		const boundaries = h.cells.map((c) => cellOutline(r.patch, c));
		let depth = 0;
		for (let i = 0; i < h.outline.length; i++) {
			const a = h.outline[i],
				bb = h.outline[(i + 1) % h.outline.length],
				steps = Math.ceil(Math.hypot(bb[0] - a[0], bb[1] - a[1]) / 0.25);
			for (let j = 0; j < steps; j++) {
				let q: Point2 = [a[0] + ((bb[0] - a[0]) * j) / steps, a[1] + ((bb[1] - a[1]) * j) / steps];
				const l = Math.hypot(h.center[0] - q[0], h.center[1] - q[1]);
				if (l)
					q = [q[0] + ((h.center[0] - q[0]) * 0.01) / l, q[1] + ((h.center[1] - q[1]) * 0.01) / l];
				const cell = cellAt(r.patch, q);
				if (!cell || h.cells.includes(cell) || r.blockOf.has(cell)) continue;
				depth = Math.max(
					depth,
					Math.min(
						...boundaries.flatMap((poly) =>
							poly.map((a, i) => distance(q, a, poly[(i + 1) % poly.length]))
						)
					)
				);
			}
		}
		dachMax = Math.max(dachMax, depth);
		if (depth > 0.05) dachZahl++;
	}
	const connected = new Set([n.start]),
		todo = [n.start];
	for (let i = 0; i < todo.length; i++)
		for (const v of adj[todo[i]] ?? [])
			if (!connected.has(v)) {
				connected.add(v);
				todo.push(v);
			}
	return {
		bloecke: r.blocks.length,
		zellen: r.patch.vertices.length,
		fuellung:
			r.patch.cells.filter((c) => r.blockOf.has(c.id)).reduce((s, c) => s + c.area, 0) /
			(2 * r.extent) ** 2,
		winkel: Math.min(...qs.map((q) => q.minAngle)),
		seiten: Math.max(...qs.map((q) => q.aspect)),
		js: Math.min(...qs.map((q) => q.minJacobian)),
		stufe: r.guete.stufe ?? 0,
		haengend: r.guete.haengend ?? 0,
		abweisungen: r.guete.fehler ?? [],
		feldRueckfall: r.feldRueckfall ?? 0,
		tuerme: b.eingriffe.filter((e) => e.art === 'turm').length,
		eingriffe: b.eingriffe.length,
		zugang:
			z.parzellen.filter((p) => p.front >= MIN_FRONT).length / Math.max(1, z.parzellen.length),
		frontMin: Math.min(...z.parzellen.map((p) => p.front)),
		dachMax,
		dachZahl,
		hochweg: n.laenge,
		laeufe: n.laeufe,
		schleifen: n.schleifen,
		diagonalen: n.kanten.filter(
			([a, b]) =>
				n.knoten[a][1] === n.knoten[b][1] && !r.nb.get(n.knoten[a][0])!.includes(n.knoten[b][0])
		).length,
		knick: knick / (n.laenge / 100),
		umweg: detours.reduce((s, d) => s + d, 0) / Math.max(1, detours.length),
		ohneAnschluss: n.ohneAnschluss,
		zusammen: connected.size === n.knoten.length
	};
}
export type Kennzahlen = ReturnType<typeof kennzahlen>;
