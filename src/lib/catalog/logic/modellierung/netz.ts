/**
 * Small planar path graph for teaching demos: nodes, edges with birth time, grid index.
 * Every new edge is split at intersections; this keeps the graph planar.
 */
export type Punkt = [number, number];
export type Treffer = { kante: number; s: number; u: number };

const EPS = 1e-9;
const kreuz = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;

export class Netz {
	readonly x: number[] = [];
	readonly y: number[] = [];
	readonly rand: boolean[] = [];
	readonly a: number[] = [];
	readonly b: number[] = [];
	readonly geburt: number[] = [];
	readonly klasse: number[] = [];
	readonly tag: number[] = [];
	readonly tot: boolean[] = [];
	/** Edges per node (dead ones too; filter when reading). */
	readonly inzident: number[][] = [];
	private readonly zellen = new Map<number, number[]>();
	private readonly knotenZellen = new Map<number, number[]>();
	private readonly schluessel = new Map<string, number>();

	constructor(readonly zelle = 24) {}

	private index(ix: number, iy: number) {
		return (ix + 512) * 4096 + (iy + 512);
	}
	private feld(v: number) {
		return Math.floor(v / this.zelle);
	}

	knoten(x: number, y: number, rand = false): number {
		const k = `${Math.round(x * 1e6)}:${Math.round(y * 1e6)}`;
		const vorhanden = this.schluessel.get(k);
		if (vorhanden !== undefined) {
			if (rand) this.rand[vorhanden] = true;
			return vorhanden;
		}
		const id = this.x.length;
		this.x.push(x);
		this.y.push(y);
		this.rand.push(rand);
		this.inzident.push([]);
		this.schluessel.set(k, id);
		const z = this.index(this.feld(x), this.feld(y));
		const liste = this.knotenZellen.get(z);
		if (liste) liste.push(id);
		else this.knotenZellen.set(z, [id]);
		return id;
	}

	private eintragen(e: number) {
		const x0 = Math.min(this.x[this.a[e]], this.x[this.b[e]]),
			x1 = Math.max(this.x[this.a[e]], this.x[this.b[e]]);
		const y0 = Math.min(this.y[this.a[e]], this.y[this.b[e]]),
			y1 = Math.max(this.y[this.a[e]], this.y[this.b[e]]);
		for (let ix = this.feld(x0); ix <= this.feld(x1); ix++)
			for (let iy = this.feld(y0); iy <= this.feld(y1); iy++) {
				const z = this.index(ix, iy);
				const liste = this.zellen.get(z);
				if (liste) liste.push(e);
				else this.zellen.set(z, [e]);
			}
	}

	verbunden(i: number, j: number) {
		return this.inzident[i].some((e) => !this.tot[e] && (this.a[e] === j || this.b[e] === j));
	}

	verbinde(i: number, j: number, geburt: number, klasse: number, tag = -1): number {
		if (i === j || this.verbunden(i, j)) return -1;
		const e = this.a.length;
		this.a.push(i);
		this.b.push(j);
		this.geburt.push(geburt);
		this.klasse.push(klasse);
		this.tag.push(tag);
		this.tot.push(false);
		this.inzident[i].push(e);
		this.inzident[j].push(e);
		this.eintragen(e);
		return e;
	}

	/** Splits edge e at parameter u; returns the node at that point. */
	teile(e: number, u: number): number {
		const a = this.a[e],
			b = this.b[e];
		if (u <= 1e-6) return a;
		if (u >= 1 - 1e-6) return b;
		const n = this.knoten(
			this.x[a] + (this.x[b] - this.x[a]) * u,
			this.y[a] + (this.y[b] - this.y[a]) * u,
			this.rand[a] && this.rand[b]
		);
		this.tot[e] = true;
		this.verbinde(a, n, this.geburt[e], this.klasse[e], this.tag[e]);
		this.verbinde(n, b, this.geburt[e], this.klasse[e], this.tag[e]);
		return n;
	}

	private kandidaten(x0: number, y0: number, x1: number, y1: number, r = 0) {
		const gesehen = new Set<number>();
		for (let ix = this.feld(Math.min(x0, x1) - r); ix <= this.feld(Math.max(x0, x1) + r); ix++)
			for (let iy = this.feld(Math.min(y0, y1) - r); iy <= this.feld(Math.max(y0, y1) + r); iy++)
				for (const e of this.zellen.get(this.index(ix, iy)) ?? []) if (!this.tot[e]) gesehen.add(e);
		return [...gesehen].sort((m, n) => m - n);
	}

	/** All intersections of segment p→q with live edges, sorted by distance. */
	treffer(p: Punkt, q: Punkt, ausser: (e: number) => boolean = () => false): Treffer[] {
		const dx = q[0] - p[0],
			dy = q[1] - p[1];
		const liste: Treffer[] = [];
		for (const e of this.kandidaten(p[0], p[1], q[0], q[1])) {
			if (ausser(e)) continue;
			const ax = this.x[this.a[e]],
				ay = this.y[this.a[e]];
			const ex = this.x[this.b[e]] - ax,
				ey = this.y[this.b[e]] - ay;
			const den = kreuz(dx, dy, ex, ey);
			if (Math.abs(den) < 1e-12) continue;
			const s = kreuz(ax - p[0], ay - p[1], ex, ey) / den;
			const u = kreuz(ax - p[0], ay - p[1], dx, dy) / den;
			if (s > EPS && s <= 1 + EPS && u >= -EPS && u <= 1 + EPS)
				liste.push({ kante: e, s: Math.min(1, s), u: Math.max(0, Math.min(1, u)) });
		}
		return liste.sort((m, n) => m.s - n.s || m.kante - n.kante);
	}

	/** Nearest node within radius r that is not excluded; −1 if none. */
	naechster(p: Punkt, r: number, ausser: (n: number) => boolean = () => false): number {
		let best = -1,
			d = r * r;
		for (let ix = this.feld(p[0] - r); ix <= this.feld(p[0] + r); ix++)
			for (let iy = this.feld(p[1] - r); iy <= this.feld(p[1] + r); iy++)
				for (const n of this.knotenZellen.get(this.index(ix, iy)) ?? []) {
					if (ausser(n) || !this.inzident[n].some((e) => !this.tot[e])) continue;
					const dd = (this.x[n] - p[0]) ** 2 + (this.y[n] - p[1]) ** 2;
					if (dd < d || (dd === d && n < best)) {
						d = dd;
						best = n;
					}
				}
		return best;
	}

	/** Smallest distance from p to live edges that satisfy `nur`. */
	abstand(p: Punkt, r: number, nur: (e: number) => boolean): number {
		let d = Infinity;
		for (const e of this.kandidaten(p[0], p[1], p[0], p[1], r)) {
			if (!nur(e)) continue;
			const ax = this.x[this.a[e]],
				ay = this.y[this.a[e]];
			const ex = this.x[this.b[e]] - ax,
				ey = this.y[this.b[e]] - ay;
			const l = ex * ex + ey * ey;
			const u = l > 0 ? Math.max(0, Math.min(1, ((p[0] - ax) * ex + (p[1] - ay) * ey) / l)) : 0;
			d = Math.min(d, Math.hypot(ax + ex * u - p[0], ay + ey * u - p[1]));
		}
		return d;
	}

	laenge(e: number) {
		return Math.hypot(this.x[this.b[e]] - this.x[this.a[e]], this.y[this.b[e]] - this.y[this.a[e]]);
	}

	lebend(): number[] {
		const out: number[] = [];
		for (let e = 0; e < this.a.length; e++) if (!this.tot[e]) out.push(e);
		return out;
	}
}

/** Next half-edge target on the left face of u → v: the neighbor of v that precedes u in angle order. */
function naechsteKante(nachbarn: Map<number, { n: number; w: number }[]>, u: number, v: number) {
	// v is an endpoint of an edge in `kanten`, so `flaechen` registered its neighbors.
	const l = nachbarn.get(v);
	if (!l) throw new Error(`flaechen: node ${v} has no registered neighbors`);
	const i = l.findIndex((k) => k.n === u);
	return l[(i - 1 + l.length) % l.length].n;
}

/** Faces of a planar graph (half-edges, face on the left). Positive area = bounded face. */
export function flaechen(netz: Netz, kanten: number[]) {
	const nachbarn = new Map<number, { n: number; w: number }[]>();
	const add = (i: number, j: number) => {
		const w = Math.atan2(netz.y[j] - netz.y[i], netz.x[j] - netz.x[i]);
		const l = nachbarn.get(i);
		if (l) l.push({ n: j, w });
		else nachbarn.set(i, [{ n: j, w }]);
	};
	for (const e of kanten) {
		add(netz.a[e], netz.b[e]);
		add(netz.b[e], netz.a[e]);
	}
	for (const l of nachbarn.values()) l.sort((m, n) => m.w - n.w || m.n - n.n);
	const besucht = new Set<string>();
	const out: { knoten: number[]; flaeche: number }[] = [];
	for (const e of kanten)
		for (const [s, t] of [
			[netz.a[e], netz.b[e]],
			[netz.b[e], netz.a[e]]
		]) {
			if (besucht.has(`${s}>${t}`)) continue;
			const ring: number[] = [];
			let u = s,
				v = t,
				flaeche = 0,
				schutz = 0;
			while (!besucht.has(`${u}>${v}`) && schutz++ < 100000) {
				besucht.add(`${u}>${v}`);
				ring.push(u);
				flaeche += netz.x[u] * netz.y[v] - netz.x[v] * netz.y[u];
				const w = naechsteKante(nachbarn, u, v);
				u = v;
				v = w;
			}
			out.push({ knoten: ring, flaeche: flaeche / 2 });
		}
	return out;
}
