import {
	connectTerminals,
	type PortNetwork,
	type Connection,
	type Port,
	type Terminal
} from '../raster/universal/kern';
import { address, HEIGHT_STEP, WEG } from '../eckraster/state';
import type { Lage } from './lage';
import type { Belegung } from './belegung';
import { auswertung, DACH, EBENE, LAUF, LAUF_MIN, LAUF_MAX, SPANNWEITE, TOP } from './wege';
import { wegZiele } from './ziele';
export type Wegeplan = {
	net: PortNetwork;
	terminals: Terminal[];
	exclusive: [string, string][];
	hint: Map<string, [number, number, number]>;
	pitch: number;
};
export function wegeplan(r: Lage, b: Belegung): Wegeplan {
	const ports: Port[] = [],
		edges: Connection[] = [],
		exclusive: [string, string][] = [],
		hint = new Map<string, [number, number, number]>(),
		exists = new Set<string>();
	const sample = (v: string, l: number) => b.samples[address(v, l)];
	for (const v of r.patch.vertices)
		for (let l = 0; l <= TOP; l++)
			if (
				!v.boundary &&
				!sample(v.id, l) &&
				!sample(v.id, l + 1) &&
				(l > 0 || b.boden.get(v.id) !== 'wasser')
			) {
				const id = address(v.id, l);
				ports.push({ id, owner: v.id, level: l, channel: 'walk' });
				exists.add(id);
				hint.set(id, [...v.point, l * HEIGHT_STEP]);
			}
	const len = (a: string, c: string) =>
		Math.hypot(r.point.get(a)![0] - r.point.get(c)![0], r.point.get(a)![1] - r.point.get(c)![1]);
	const lengths = r.patch.vertices.flatMap((v) => v.neighbors.map((w) => len(v.id, w))),
		pitch = lengths.reduce((a, b) => a + b, 0) / lengths.length;
	const cost = (v: string, l: number) =>
		l > 0 && sample(v, l - 1) ? DACH : EBENE[l] * (l > 0 && b.boden.get(v) === 'garten' ? 1.3 : 1);
	const key = (a: string, c: string) => (a < c ? `${a}>${c}` : `${c}>${a}`);
	const add = (v: string, l: number, w: string, m: number, width: number) => {
		const a = address(v, l),
			c = address(w, m),
			span = len(v, w);
		if (!exists.has(a) || !exists.has(c)) return undefined;
		const e: Connection = {
			id: key(a, c),
			a,
			b: c,
			cost: ((cost(v, l) + cost(w, m)) / 2) * (0.5 + (0.5 * span) / pitch) + (l !== m ? LAUF : 0),
			width,
			capacity: width,
			kind: l === m ? 'horizontal' : 'stair',
			span: l || m ? span : 0,
			maxSpan: SPANNWEITE,
			clear: true
		};
		edges.push(e);
		return e.id;
	};
	for (const v of r.patch.vertices) {
		for (let l = 0; l < TOP; l++)
			if (exists.has(address(v.id, l)) && exists.has(address(v.id, l + 1)))
				exclusive.push([address(v.id, l), address(v.id, l + 1)]);
		for (const w of v.neighbors) {
			if (v.id < w) for (let l = 0; l <= TOP; l++) add(v.id, l, w, l, 2.4);
			const d = len(v.id, w);
			if (d >= LAUF_MIN && d <= LAUF_MAX)
				for (let l = 0; l < TOP; l++)
					if (!sample(w, l) && !sample(v.id, l + 1)) {
						const id = add(v.id, l, w, l + 1, 1.2);
						if (id) exclusive.push([id, address(w, l)], [id, address(v.id, l + 1)]);
					}
		}
	}
	for (const f of r.patch.faces)
		for (let l = 0; l <= TOP; l++) {
			const ds: (string | undefined)[] = [];
			for (let i = 0; i < 2; i++) {
				const [a, c, d, e] = [
					f.vertices[i],
					f.vertices[i + 2],
					f.vertices[(i + 1) % 4],
					f.vertices[(i + 3) % 4]
				];
				if (
					!sample(d, l) &&
					!sample(d, l + 1) &&
					!sample(e, l) &&
					!sample(e, l + 1) &&
					len(a, c) <= 0.8 * Math.min(len(a, d) + len(d, c), len(a, e) + len(e, c))
				)
					ds.push(add(a, l, c, l, 1.7));
				else ds.push(undefined);
			}
			if (ds[0] && ds[1]) exclusive.push([ds[0], ds[1]]);
		}
	return {
		net: { ports, edges },
		terminals: wegZiele(r, b, (v, l) => exists.has(address(v, l))),
		exclusive,
		hint,
		pitch
	};
}
export function wegeKern(r: Lage, b: Belegung, schleifen: number) {
	const p = wegeplan(r, b),
		result = connectTerminals(p.net, p.terminals, p.exclusive, p.hint, {
			minWidth: 1.2,
			ownerGap: 2,
			loops: schleifen,
			ratio: 1.4,
			fresh: 2,
			pairs: 8,
			perMetre: 1 / p.pitch,
			bias: 2
		});
	const byId = new Map(p.net.ports.map((v) => [v.id, v])),
		knoten = result.ports.map(
			(id) => [byId.get(id)!.owner, byId.get(id)!.level] as [string, number]
		),
		ix = new Map(result.ports.map((id, i) => [id, i]));
	for (const id of result.ports) b.samples[id] = { occupied: true, group: WEG };
	for (const e of result.edges) {
		const a = byId.get(e.a)!,
			c = byId.get(e.b)!;
		if (a.level === c.level && !r.nb.get(a.owner)!.includes(c.owner))
			for (const [id, other] of [
				[e.a, c.owner],
				[e.b, a.owner]
			])
				b.samples[id] = { ...b.samples[id], quer: [...(b.samples[id].quer ?? []), other].sort() };
	}
	return {
		...auswertung(
			r,
			b,
			knoten,
			result.edges.map((e) => [ix.get(e.a)!, ix.get(e.b)!]),
			ix.get(result.anchors.get('platz')!) ?? 0,
			[...result.anchors]
				.filter(([id]) => id !== 'platz')
				.map(([id, p]) => ({ id, knoten: ix.get(p)! }))
		),
		ohneAnschluss: result.unreachable.length
	};
}
