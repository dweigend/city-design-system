import { routeTargets, TOP, type Ziel } from './ziele';
import { required } from '../../required';
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

/** Cost per level: ground only for arriving, classes cheap, intermediate levels expensive. */
export const EBENE = [3.2, 2.4, 1, 2.4, 1.05, 2.8];
export const LAUF = 2;
/** On a roof the path rests on it: cheap, whatever the level. */
export const DACH = 0.7;
/** Largest free span of a footbridge between two bearings in meters. */
export const SPANNWEITE = 13;
/** A flight climbs one floor (4 m): shorter would be a ladder, longer a ramp. */
export const LAUF_MIN = 2.6,
	LAUF_MAX = 10;

export type Netz = {
	/** Nodes as [build cell, level]. */
	start: number;
	ziele: { id: string; knoten: number }[];
	ohneAnschluss: number;
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

import { Heap } from '../raster/universal/kern/heap';

/**
 * Lays the path network into the occupancy. The graph is the patch: nodes are build cells per level,
 * edges the mesh edges. Costs count in mean edge lengths, not in grid steps.
 * `schleifen`: desired number of additional connections.
 * Mutates `b.samples` in place: writes every path cell as group `weg`. `r` is read only.
 * Deterministic; draws no random numbers.
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
	const nb = r.patch.vertices.map((v) =>
			v.neighbors.map((w) => required(vOfId.get(w), 'vOfId.get(w)'))
		),
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
	const vOf = (id: string) => required(vOfId.get(id), 'vOfId.get(id)');
	const { start, ziele } = routeTargets(r, b, { vOf, nb, usable, lang, node });

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

	const anker = [
		...new Set(ziele.filter((z) => z.anker !== undefined).map((z) => required(z.anker, 'z.anker')))
	];
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
		edges = [...kanten.values()].map(
			([a, c]) =>
				[required(at.get(a), 'at.get(a)'), required(at.get(c), 'at.get(c)')] as [number, number]
		);
	return {
		...auswertung(
			r,
			b,
			knoten.map((k) => [ids[Math.floor(k / L)], k % L]),
			edges,
			required(at.get(start), 'at.get(start)'),
			ziele
				.filter((z) => z.anker !== undefined)
				.map((z) => ({
					id: z.id,
					knoten: required(at.get(required(z.anker, 'z.anker')), 'at.get(z.anker!)')
				}))
		),
		ohneAnschluss: ziele.filter((z) => z.anker === undefined).length
	};
}

/** Shared evaluation for the port graph. Order remains that of the laid network. */
export function auswertung(
	r: Lage,
	b: Belegung,
	cells: [string, number][],
	edges: [number, number][],
	start: number,
	ziele: { id: string; knoten: number }[]
): Netz {
	const knoten = cells.map((_, i) => i),
		kanten = new Map(edges.map((e, i) => [String(i), e]));
	const pos = (k: number) => required(r.point.get(cells[k][0]), 'r.point.get(cells[k][0])'),
		luft = (a: number, c: number) => Math.hypot(pos(a)[0] - pos(c)[0], pos(a)[1] - pos(c)[1]);
	const sample = (v: string, l: number) => b.samples[address(v, l)],
		isWeg = (v: string, l: number) => sample(v, l)?.group === WEG;
	const adj = new Map<number, number[]>();
	for (const [a, c] of edges) {
		adj.set(a, [...(adj.get(a) ?? []), c]);
		adj.set(c, [...(adj.get(c) ?? []), a]);
	}

	/** Farthest node in the network, on the ground if there is one: the walkthrough starts and ends below. */
	const weit = (from: number, boden: boolean) => {
		const { d, prev } = schritte(adj, from);
		let far = from;
		for (const [k, n] of d) {
			const besser =
				boden && (cells[k][1] === 0) !== (cells[far][1] === 0)
					? cells[k][1] === 0
					: n > required(d.get(far), 'd.get(far)');
			if (k !== from && (far === from || besser)) far = k;
		}
		const path = [far];
		while (prev.has(path[0])) path.unshift(required(prev.get(path[0]), 'prev.get(path[0])'));
		return path;
	};
	const runde = (boden: boolean) =>
		weit(required(weit(start, boden).at(-1), 'weit(start, boden).at(-1)'), boden);
	// If only the square on the ground is in the network, the walkthrough would be a stub: then the longest route.
	let strecke = knoten.length > 1 ? runde(true) : [];
	if (strecke.length < 8 && knoten.length > 1) {
		const frei = runde(false);
		if (frei.length > strecke.length) strecke = frei;
	}
	const tour = strecke.map((k): Vec3 => {
		const q = pos(k),
			l = cells[k][1];
		return [q[0], q[1], l * HEIGHT_STEP + (l ? WEG_D : 0.08) + AUGE];
	});
	const { laenge, laeufe, dachwege } = summarizeEdges();
	return {
		start,
		ziele,
		ohneAnschluss: 0,
		knoten: cells,
		kanten: edges,
		tour,
		schleifen: edges.length - (knoten.length - 1),
		laeufe,
		laenge: Math.round(laenge),
		dachwege,
		ebenen: [...new Set(cells.map(([, l]) => l).filter((l) => l > 0))].sort((a, b) => a - b)
	};

	function summarizeEdges() {
		let laenge = 0,
			laeufe = 0,
			dachwege = 0;
		for (const [a, c] of kanten.values()) {
			const [la, lc] = [cells[a][1], cells[c][1]];
			if (la !== lc) laeufe++;
			if (la > 0 || lc > 0) laenge += luft(a, c);
		}
		for (const k of knoten) {
			const v = cells[k][0],
				l = cells[k][1];
			if (l > 0 && sample(v, l - 1) && !isWeg(v, l - 1)) dachwege++;
		}
		return { laenge, laeufe, dachwege };
	}
}

/** Edge count in the network from `from` to all nodes. */
function schritte(adj: Map<number, number[]>, from: number) {
	const d = new Map([[from, 0]]),
		prev = new Map<number, number>(),
		queue = [from];
	for (let i = 0; i < queue.length; i++)
		for (const w of adj.get(queue[i]) ?? [])
			if (!d.has(w)) {
				d.set(w, required(d.get(queue[i]), 'd.get(queue[i])') + 1);
				prev.set(w, queue[i]);
				queue.push(w);
			}
	return { d, prev };
}
