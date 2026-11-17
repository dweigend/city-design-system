/**
 * Path network of the world as occupancy (group `weg`): nodes are build cells on one level,
 * edges are the mesh edges (level) or a flight to the neighboring cell one level higher.
 * Rules after docs/research/04-city-rules.md §1.3:
 * 1. Height classes: paths preferably lie on the gallery (level 2, 8 m, above the alleys) and
 *    on the rooftop walkway (level 4, 16 m, above the roofs). Other levels are expensive and serve
 *    as transitions; a height jump of one floor is a stair flight.
 * 2. Feasible: cell free, clear height above it free, no path directly below.
 * 3. Spanning tree: every target attaches to the growing network by its cheapest path.
 * 4. Loops: target pairs with the largest detour in the tree get a second connection.
 * The corner module draws the form (footbridge, landing, flight, railing, column).
 */
import type { Vec3 } from '../types';
import { address, HEIGHT_STEP, MAX_LEVEL, WEG, type Sample } from '../eckraster/state';
import { WEG_D } from '../formen/eck';
import type { Belegung } from './belegung';
import type { Lage } from './lage';
import { AUGE } from './typen';

/** Height classes: gallery and rooftop walkway. */
export const KLASSEN = [2, 4];
/** Highest path level. */
const TOP = 5;
/** Cost per level: ground only for arriving, classes cheap, intermediate levels expensive. */
const EBENE = [3.2, 2.4, 1, 2.4, 1.05, 2.8];
const LAUF = 2;
/** On a roof the path rests on it: cheap, whatever the level. */
const DACH = 0.7;
/** Largest free span of a footbridge between two bearings in meters. */
export const SPANNWEITE = 13;
/** A flight climbs one floor (4 m): shorter would be a ladder, longer a ramp. */
export const LAUF_MIN = 2.6,
	LAUF_MAX = 10;

export type Netz = {
	/** Nodes as [build cell, level]. */
	knoten: [string, number][];
	kanten: [number, number][];
	tour: Vec3[];
	schleifen: number;
	laeufe: number;
	/** Meters above the ground. */
	laenge: number;
	dachwege: number;
	ebenen: number[];
};

/** Small binary heap for Dijkstra. */
class Heap {
	private keys: number[] = [];
	private vals: number[] = [];
	get size() {
		return this.keys.length;
	}
	push(key: number, val: number) {
		let i = this.keys.length;
		this.keys.push(key);
		this.vals.push(val);
		while (i > 0) {
			const up = (i - 1) >> 1;
			if (this.keys[up] <= key) break;
			this.keys[i] = this.keys[up];
			this.vals[i] = this.vals[up];
			i = up;
		}
		this.keys[i] = key;
		this.vals[i] = val;
	}
	pop(): [number, number] {
		const top: [number, number] = [this.keys[0], this.vals[0]],
			key = this.keys.pop()!,
			val = this.vals.pop()!,
			n = this.keys.length;
		if (n) {
			let i = 0;
			for (;;) {
				let c = 2 * i + 1;
				if (c >= n) break;
				if (c + 1 < n && this.keys[c + 1] < this.keys[c]) c++;
				if (this.keys[c] >= key) break;
				this.keys[i] = this.keys[c];
				this.vals[i] = this.vals[c];
				i = c;
			}
			this.keys[i] = key;
			this.vals[i] = val;
		}
		return top;
	}
}

/**
 * Lays the path network into the occupancy. The graph is the patch: nodes are build cells per level,
 * edges the mesh edges. Costs count in mean edge lengths, not in grid steps.
 * `schleifen`: desired number of additional connections.
 */
export function wege(r: Lage, b: Belegung, schleifen: number): Netz {
	const { samples } = b,
		L = TOP + 1,
		ids = r.patch.vertices.map((v) => v.id),
		n = ids.length,
		vOfId = new Map(ids.map((id, v) => [id, v])),
		pts = r.patch.vertices.map((v) => v.point),
		node = (v: number, l: number) => v * L + l;
	// Occupancy as an array (0 free, 1 occupied, 2 path): the search asks millions of times, strings would be too slow.
	const H = MAX_LEVEL + 3,
		feld = new Uint8Array(n * H);
	for (let v = 0; v < n; v++)
		for (let l = 0; l <= MAX_LEVEL; l++) {
			const q = samples[address(ids[v], l)];
			if (q) feld[v * H + l + 1] = q.group === WEG ? 2 : 1;
		}
	const sample = (v: number, l: number) => (l < 0 ? 0 : feld[v * H + l + 1]);
	const isWeg = (v: number, l: number) => l >= 0 && feld[v * H + l + 1] === 2;
	const wasser = ids.map((id) => b.boden.get(id) === 'wasser'),
		garten = ids.map((id) => b.boden.get(id) === 'garten');
	const inner = (v: number) => !r.patch.vertices[v].boundary;
	const nb = r.patch.vertices.map((v) => v.neighbors.map((w) => vOfId.get(w)!)),
		lang = (v: number, w: number) => Math.hypot(pts[w][0] - pts[v][0], pts[w][1] - pts[v][1]),
		// Measure of cost: mean edge length. Long edges cost more, short ones less.
		pitch =
			nb.reduce((s, ws, v) => s + ws.reduce((t, w) => t + lang(v, w), 0), 0) /
			Math.max(
				1,
				nb.reduce((s, ws) => s + ws.length, 0)
			);

	/** Cells that a flight must keep free (below the upper and above the lower end). */
	const gesperrt = new Set<number>();
	const usable = (v: number, l: number) => {
		if (l < 0 || l > TOP || !inner(v)) return false;
		if (isWeg(v, l)) return true;
		return (
			!sample(v, l) &&
			!sample(v, l + 1) &&
			!isWeg(v, l - 1) &&
			!gesperrt.has(node(v, l)) &&
			// Not into the water at ground level.
			(l > 0 || !wasser[v])
		);
	};
	const cost = (v: number, l: number) =>
		l > 0 && sample(v, l - 1) && !isWeg(v, l - 1)
			? DACH
			: // Paths over gardens are a nuisance.
				EBENE[l] * (l > 0 && garten[v] ? 1.3 : 1);
	const kanten = new Map<string, [number, number]>();
	const key = (a: number, c: number) => (a < c ? `${a}-${c}` : `${c}-${a}`);
	const inNet = new Set<number>();

	const dist = new Float64Array(n * L),
		prev = new Int32Array(n * L),
		marke = new Uint32Array(n * L);
	let lauf = 0;
	/** Cheapest path from the sources to a target, at most `limit` expensive. */
	function suche(quellen: number[], ziel: (k: number) => boolean, limit = Infinity) {
		const heap = new Heap(),
			quelle = new Set(quellen);
		lauf++;
		const far = (k: number) => (marke[k] === lauf ? dist[k] : Infinity);
		for (const q of quellen) {
			marke[q] = lauf;
			dist[q] = 0;
			prev[q] = -1;
			heap.push(0, q);
		}
		while (heap.size) {
			const [d, k] = heap.pop();
			if (d > far(k)) continue;
			if (d > limit) break;
			if (ziel(k) && !quelle.has(k)) {
				const path = [k];
				while (prev[path[0]] >= 0) path.unshift(prev[path[0]]);
				// A column carries only one path level per segment, with clear height above it.
				const saeulen = new Map<number, number>();
				let frei = true;
				for (const q of path) {
					const s = Math.floor(q / L),
						h = saeulen.get(s);
					if (h !== undefined && Math.abs(h - (q % L)) < 2) frei = false;
					saeulen.set(s, q % L);
				}
				if (!frei) continue;
				return { path, cost: d };
			}
			const v = Math.floor(k / L),
				l = k % L;
			const step = (w: number, m: number, extra: number) => {
				const t = node(w, m);
				if (!usable(w, m)) return;
				// No turning on the spot: not back into the column the path just came from.
				if (prev[k] >= 0 && Math.floor(prev[k] / L) === w) return;
				const len = lang(v, w);
				// Span: a footbridge above the ground only bears from bearing to bearing.
				if ((l > 0 || m > 0) && len > SPANNWEITE) return;
				if (m !== l && (len < LAUF_MIN || len > LAUF_MAX)) return;
				const c = d + ((cost(v, l) + cost(w, m)) / 2) * (0.5 + (0.5 * len) / pitch) + extra;
				if (c < far(t)) {
					marke[t] = lauf;
					dist[t] = c;
					prev[t] = k;
					heap.push(c, t);
				}
			};
			for (const w of nb[v]) {
				step(w, l, 0);
				// Flight up: the cell below the upper end and above the lower end stays free.
				if (l < TOP && !sample(w, l) && !sample(v, l + 1)) step(w, l + 1, LAUF);
				if (l > 0 && !sample(v, l - 1) && !sample(w, l)) step(w, l - 1, LAUF);
			}
		}
		return undefined;
	}
	function lege(path: number[]) {
		for (let s = 0; s < path.length; s++) {
			const k = path[s],
				v = Math.floor(k / L),
				l = k % L;
			inNet.add(k);
			samples[address(ids[v], l)] = { occupied: true, group: WEG } satisfies Sample;
			feld[v * H + l + 1] = 2;
			if (s === 0) continue;
			const q = path[s - 1],
				w = Math.floor(q / L),
				m = q % L;
			kanten.set(key(q, k), [q, k]);
			if (m !== l) {
				const [lowV, lowL, highV] = m < l ? [w, m, v] : [v, l, w];
				gesperrt.add(node(highV, lowL));
				gesperrt.add(node(lowV, lowL + 1));
			}
		}
	}

	/* ── Targets ── */
	type Ziel = { id: string; kandidaten: number[]; anker?: number };
	const ziele: Ziel[] = [];
	const vOf = (id: string) => vOfId.get(id)!;
	const neben = (cells: [string, number][], level: number) => [
		...new Set(
			cells
				.filter(([, l]) => l === level)
				.flatMap(([id]) => nb[vOf(id)])
				.filter((v) => usable(v, level))
				.map((v) => node(v, level))
		)
	];
	for (const e of b.eingriffe) {
		if (e.art === 'hofhaus') continue;
		const stufen = e.art === 'aufstockung' ? [e.base] : KLASSEN.filter((l) => l <= e.top);
		for (const l of stufen) {
			const kern = e.kern ? nb[vOf(e.kern)].filter((v) => usable(v, l)).map((v) => node(v, l)) : [];
			const kandidaten = kern.length ? kern : neben(e.cells, l);
			if (kandidaten.length) ziele.push({ id: `${e.id}@${l}`, kandidaten });
		}
	}
	// Ground: square, platform, gardens and basins.
	const boden = (id: string, vs: number[]) => {
		const kandidaten = vs.filter((v) => usable(v, 0)).map((v) => node(v, 0));
		if (kandidaten.length) ziele.push({ id, kandidaten });
	};
	// The square is the free block nearest to the center.
	const platz = [...r.blocks]
		.filter((x) => b.arten.get(x.id) === 'platz')
		.sort((x, y) => y.naehe - x.naehe || y.cells.length - x.cells.length)[0];
	const zur = (x: typeof platz, id: string) =>
		Math.hypot(r.point.get(id)![0] - x.center[0], r.point.get(id)![1] - x.center[1]);
	const mitte = (x: typeof platz) =>
		vOf([...x.cells].sort((p, q) => zur(x, p) - zur(x, q) || (p < q ? -1 : 1))[0]);
	const start = node(mitte(platz), 0);
	boden('bahnsteig', r.bahnsteig.map(vOf));
	for (const x of r.blocks) {
		const art = b.arten.get(x.id);
		if (art === 'garten') boden(`garten-${x.id}`, [mitte(x)]);
		// Basins: two spots on the shore, facing each other.
		if (art === 'wasser') {
			const ufer = x.cells.filter((id) => x.tiefe.get(id) === 1).sort(),
				gegen = [...ufer].sort(
					(p, q) => lang(vOf(q), vOf(ufer[0])) - lang(vOf(p), vOf(ufer[0])) || (p < q ? -1 : 1)
				)[0];
			if (ufer.length) boden(`becken-${x.id}`, [vOf(ufer[0]), vOf(gegen)]);
		}
	}

	/* ── Spanning tree ── */
	lege([start]);
	const pos = (k: number) => pts[Math.floor(k / L)];
	const luft = (a: number, c: number) => {
		const [p0, p1] = [pos(a), pos(c)];
		return Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
	};
	const fern = (z: Ziel) => luft(z.kandidaten[0], start);
	for (const z of [...ziele].sort((a, c) => fern(a) - fern(c) || (a.id < c.id ? -1 : 1))) {
		const frei = z.kandidaten.filter((k) => usable(Math.floor(k / L), k % L));
		if (!frei.length) continue;
		const hit = frei.find((k) => inNet.has(k));
		if (hit !== undefined) {
			z.anker = hit;
			continue;
		}
		const found = suche(frei, (k) => inNet.has(k));
		if (!found) continue;
		z.anker = found.path[0];
		lege(found.path);
	}

	/* ── Loops by detour gain ── */
	const nachbarn = () => {
		const adj = new Map<number, number[]>();
		for (const [a, c] of kanten.values()) {
			adj.set(a, [...(adj.get(a) ?? []), c]);
			adj.set(c, [...(adj.get(c) ?? []), a]);
		}
		return adj;
	};
	/** Edge count in the network from `from` to all nodes. */
	const schritte = (adj: Map<number, number[]>, from: number) => {
		const d = new Map([[from, 0]]),
			prev = new Map<number, number>(),
			queue = [from];
		for (let i = 0; i < queue.length; i++)
			for (const w of adj.get(queue[i]) ?? [])
				if (!d.has(w)) {
					d.set(w, d.get(queue[i])! + 1);
					prev.set(w, queue[i]);
					queue.push(w);
				}
		return { d, prev };
	};
	const anker = [...new Set(ziele.filter((z) => z.anker !== undefined).map((z) => z.anker!))];
	for (let round = 0; round < schleifen; round++) {
		const adj = nachbarn();
		// Candidates: close in the air, far in the network.
		const paare: { from: number; to: number; netz: number; umweg: number }[] = [];
		for (let a = 0; a < anker.length; a++) {
			const { d } = schritte(adj, anker[a]);
			for (let c = a + 1; c < anker.length; c++) {
				const netz = d.get(anker[c]) ?? 0,
					direkt = luft(anker[a], anker[c]);
				if (netz >= 10 && direkt < 70)
					paare.push({ from: anker[a], to: anker[c], netz, umweg: (netz * 5) / (direkt + 10) });
			}
		}
		paare.sort((x, y) => y.umweg - x.umweg || x.from - y.from || x.to - y.to);
		let best: { gain: number; path: number[] } | undefined;
		for (const q of paare.slice(0, 8)) {
			const neu = suche([q.from], (k) => k === q.to, q.netz * 1.6);
			if (!neu) continue;
			const fresh = neu.path.filter((k) => !inNet.has(k)).length,
				gain = q.netz / (neu.path.length - 1);
			if (fresh >= 2 && gain > 1.4 && (!best || gain > best.gain)) best = { gain, path: neu.path };
		}
		if (!best) break;
		lege(best.path);
	}

	/* ── Metrics and walkthrough ── */
	const knoten = [...inNet].sort((a, c) => a - c),
		at = new Map(knoten.map((k, i) => [k, i])),
		edges = [...kanten.values()].map(([a, c]) => [at.get(a)!, at.get(c)!] as [number, number]);
	const adj = nachbarn();
	/** Farthest node in the network, on the ground if there is one: the walkthrough starts and ends below. */
	const weit = (from: number, boden: boolean) => {
		const { d, prev } = schritte(adj, from);
		let far = from;
		for (const [k, n] of d) {
			const besser = boden && (k % L === 0) !== (far % L === 0) ? k % L === 0 : n > d.get(far)!;
			if (k !== from && (far === from || besser)) far = k;
		}
		const path = [far];
		while (prev.has(path[0])) path.unshift(prev.get(path[0])!);
		return path;
	};
	const runde = (boden: boolean) => weit(weit(start, boden).at(-1)!, boden);
	// If only the square on the ground is in the network, the walkthrough would be a stub: then the longest route.
	let strecke = knoten.length > 1 ? runde(true) : [];
	if (strecke.length < 8 && knoten.length > 1) {
		const frei = runde(false);
		if (frei.length > strecke.length) strecke = frei;
	}
	const tour = strecke.map((k): Vec3 => {
		const q = pos(k),
			l = k % L;
		return [q[0], q[1], l * HEIGHT_STEP + (l ? WEG_D : 0.08) + AUGE];
	});
	let laenge = 0,
		laeufe = 0,
		dachwege = 0;
	for (const [a, c] of kanten.values()) {
		const [la, lc] = [a % L, c % L];
		if (la !== lc) laeufe++;
		if (la > 0 || lc > 0) laenge += luft(a, c);
	}
	for (const k of knoten) {
		const v = Math.floor(k / L),
			l = k % L;
		if (l > 0 && sample(v, l - 1) && !isWeg(v, l - 1)) dachwege++;
	}
	return {
		knoten: knoten.map((k) => [ids[Math.floor(k / L)], k % L]),
		kanten: edges,
		tour,
		// Cycle count of the network: a connection that touches the network twice closes two loops.
		schleifen: edges.length - (knoten.length - 1),
		laeufe,
		laenge: Math.round(laenge),
		dachwege,
		ebenen: [...new Set(knoten.map((k) => k % L).filter((l) => l > 0))].sort((a, c) => a - c)
	};
}
