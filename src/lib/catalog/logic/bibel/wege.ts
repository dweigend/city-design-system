/**
 * Elevated walkway teaching example: feasible candidates → minimum spanning tree → loops by detour.
 * The same order as welt/wege.ts, here on a few points in meters, so that the rule stays
 * readable as a diagram. Pure and deterministic.
 */
import { SPANNWEITE } from '../parametrik/welt/wege';

export type Knoten = { id: string; x: number; y: number; ebene: number };
export type Kante = { a: number; b: number; laenge: number };
export type Wegenetz = { baum: Kante[]; schleifen: Kante[]; zuLang: Kante[]; andereEbene: Kante[] };

const laenge = (p: Knoten, q: Knoten) => Math.hypot(p.x - q.x, p.y - q.y);

/** Shortest paths in the tree (Dijkstra without a heap, few nodes). */
function abstand(n: number, kanten: Kante[], start: number): number[] {
	const d = Array<number>(n).fill(Infinity),
		fertig = Array<boolean>(n).fill(false);
	d[start] = 0;
	for (let k = 0; k < n; k++) {
		let u = -1;
		for (let i = 0; i < n; i++) if (!fertig[i] && (u < 0 || d[i] < d[u])) u = i;
		if (u < 0 || d[u] === Infinity) break;
		fertig[u] = true;
		for (const e of kanten) {
			const v = e.a === u ? e.b : e.b === u ? e.a : -1;
			if (v >= 0 && d[u] + e.laenge < d[v]) d[v] = d[u] + e.laenge;
		}
	}
	return d;
}

/**
 * 1. Candidate: same level and span ≤ `spannweite`. Other levels only cross; no port, no edge.
 * 2. Spanning tree after Kruskal. 3. `schleifen` extra edges with the largest detour saving.
 */
export function wegenetz(knoten: Knoten[], schleifen = 2, spannweite = SPANNWEITE): Wegenetz {
	const alle: Kante[] = [];
	for (let a = 0; a < knoten.length; a++)
		for (let b = a + 1; b < knoten.length; b++)
			alle.push({ a, b, laenge: laenge(knoten[a], knoten[b]) });
	const andereEbene = alle.filter(
		(e) => knoten[e.a].ebene !== knoten[e.b].ebene && e.laenge <= spannweite
	);
	const gleich = alle.filter((e) => knoten[e.a].ebene === knoten[e.b].ebene);
	const zuLang = gleich.filter((e) => e.laenge > spannweite && e.laenge <= spannweite * 1.4);
	const kandidaten = gleich
		.filter((e) => e.laenge <= spannweite)
		.sort((p, q) => p.laenge - q.laenge || p.a - q.a || p.b - q.b);
	const eltern = knoten.map((_, i) => i);
	const wurzel = (i: number): number => (eltern[i] === i ? i : (eltern[i] = wurzel(eltern[i])));
	const baum: Kante[] = [];
	for (const e of kandidaten) {
		const ra = wurzel(e.a),
			rb = wurzel(e.b);
		if (ra !== rb) {
			eltern[ra] = rb;
			baum.push(e);
		}
	}
	const netz = [...baum],
		extra: Kante[] = [];
	for (let s = 0; s < schleifen; s++) {
		let best: Kante | undefined,
			gewinn = 1.25;
		for (const e of kandidaten) {
			if (netz.includes(e)) continue;
			const g = abstand(knoten.length, netz, e.a)[e.b] / e.laenge;
			if (g > gewinn) [best, gewinn] = [e, g];
		}
		if (!best) break;
		netz.push(best);
		extra.push(best);
	}
	return { baum, schleifen: extra, zuLang, andereEbene };
}
