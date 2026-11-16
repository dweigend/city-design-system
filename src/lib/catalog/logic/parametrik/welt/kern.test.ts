import { required } from '../../required';
// @ts-expect-error Bun test API is provided at runtime.
import { expect, test } from 'bun:test';
// main 502f60d: 27 outputs match with the kernel disabled. The historical research
// hashes predate 7cf65bf: the author's removal of the separate cycle function
// changes cycle colors and heads. Keep that research evidence unchanged.
import MAIN from './main-hashes.json';
import { welt, weltDefaults, rasterarten } from './index';
import { KERN_AUS } from './typen';
export const hash = (s: string) => {
	let h = 2166136261;
	for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	return (h >>> 0).toString(16).padStart(8, '0');
};
for (const { id: raster } of rasterarten)
	for (const seed of [1, 19, 45])
		test(`switch off = main ${raster}:${seed}`, () => {
			expect(hash(JSON.stringify(welt({ ...weltDefaults, raster, seed, kern: KERN_AUS })))).toBe(
				MAIN[`${raster}:${seed}` as keyof typeof MAIN]
			);
		});

import { KERN_AN } from './typen';
import { lageKern, absicht, WELT_GRENZEN } from './kernlage';
import { lage } from './lage';
import { netz } from './netze';
import { belegung } from './belegung';
import { wegeKern } from './ports';
import { SPANNWEITE, LAUF_MIN, LAUF_MAX } from './wege';
import {
	compile,
	validateModel,
	quadsOf,
	interiorOf,
	transact,
	encode,
	decode,
	connectTerminals,
	type PortNetwork
} from '../raster/universal/kern';
import { address, WEG } from '../eckraster/state';
for (const { id: raster } of rasterarten)
	for (const seed of [1, 19, 45])
		test(`kernel: invariants ${raster}:${seed}`, () => {
			const p = { ...weltDefaults, raster, seed, kern: KERN_AN },
				r = lageKern({ ...p, feld: true });
			if (r.kern) validateModel(r.kern.model);
			console.log(`${raster}:${seed} stage ${r.guete.stufe}`);
			for (const x of r.blocks) {
				expect(x.saum.length).toBeGreaterThan(2);
				expect(new Set(x.saum).size).toBe(x.saum.length);
				for (const id of x.cells) expect(r.blockOf.get(id)).toBe(x);
			}
			const b = belegung(r, p),
				before = Object.entries(b.samples).filter(([, s]) => s.group === 'bestand'),
				n = wegeKern(r, b, 2);
			const adj = n.knoten.map(() => [] as number[]);
			for (const [a, c] of n.kanten) {
				adj[a].push(c);
				adj[c].push(a);
				const [v, l] = n.knoten[a],
					[w, m] = n.knoten[c],
					A = required(r.point.get(v), 'r.point.get(v)'),
					B = required(r.point.get(w), 'r.point.get(w)'),
					d = Math.hypot(A[0] - B[0], A[1] - B[1]);
				if (l || m) expect(d).toBeLessThanOrEqual(SPANNWEITE + 1e-6);
				if (l !== m) {
					expect(Math.abs(l - m)).toBe(1);
					expect(d).toBeGreaterThanOrEqual(LAUF_MIN);
					expect(d).toBeLessThanOrEqual(LAUF_MAX);
					expect(r.nb.get(v)).toContain(w);
				} else
					expect(
						required(r.nb.get(v), 'r.nb.get(v)').includes(w) ||
							r.patch.faces.some((f) => f.vertices.includes(v) && f.vertices.includes(w))
					).toBe(true);
			}
			const seen = new Set([n.start]),
				q = [n.start];
			for (let i = 0; i < q.length; i++)
				for (const w of adj[q[i]])
					if (!seen.has(w)) {
						seen.add(w);
						q.push(w);
					}
			expect(seen.size).toBe(n.knoten.length);
			for (const [v, l] of n.knoten) {
				expect(b.samples[address(v, l + 1)]?.group).not.toBe(WEG);
			}
			for (const f of r.patch.faces)
				for (let l = 0; l <= 5; l++) {
					const cross = [0, 1].filter((i) =>
						b.samples[address(f.vertices[i], l)]?.quer?.includes(f.vertices[i + 2])
					);
					expect(cross.length).toBeLessThanOrEqual(1);
				}
			expect(Object.entries(b.samples).filter(([, s]) => s.group === 'bestand')).toEqual(before);
			expect(n.tour.length).toBeGreaterThanOrEqual(2);
			expect(n.tour.flat().every(Number.isFinite)).toBe(true);
		});
for (const raster of ['quadrat', 'achsen', 'dreieck', 'sechseck'] as const)
	test(`kernel preserves cell sets ${raster}`, () => {
		const p = { ...weltDefaults, raster, relax: 0 },
			a = lage(p),
			b = lageKern(p),
			points = (r: typeof a) =>
				r.patch.vertices.map((v) => v.point.map((n) => n.toFixed(6)).join(',')).sort();
		expect(points(b)).toEqual(points(a));
		expect(b.blocks.length).toBe(a.blocks.length);
	});
test('parts: area, interior points, transaction and JSON', () => {
	const p = { ...weltDefaults, relax: 0 },
		i = absicht(netz(p), 45, WELT_GRENZEN).intent,
		m = compile(i),
		first = [...m.chunks.keys()][0];
	expect(quadsOf(m).filter((q) => q.chunk === first).length).toBe(36);
	expect(interiorOf(m, first).length).toBe(25);
	const v = required(
			interiorOf(m, first).find((v) => i.positions.has(v)),
			'interiorOf(m, first).find((v) => i.positions.has(v))'
		),
		old = required(i.positions.get(v), 'i.positions.get(v)'),
		tx = transact(m, { positions: new Map([[v, [old[0] + 0.05, old[1]]]]) });
	expect(tx.dirty).toEqual([first]);
	expect(encode(tx.after)).toBe(encode(compile(tx.after.intent)));
	validateModel(tx.after);
	expect(encode(decode(encode(m)))).toBe(encode(m));
	const f = required(i.faces.get(first), 'i.faces.get(first)');
	const broken = { ...f, parts: required(f.parts, 'f.parts').slice(1) };
	expect(() =>
		compile({
			...i,
			faces: new Map([...i.faces].map(([id, v]) => [id, id === first ? broken : v]))
		})
	).toThrow('parts-boundary');
});
test('Steiner: shared trunk, permutation, exclusions, unreachable', () => {
	const ids = ['r', 's', 'a', 'b'],
		ports = ids.map((id) => ({ id, owner: id, level: 0, channel: 'walk' as const }));
	const edge = (a: string, b: string) => ({
		id: a + b,
		a,
		b,
		cost: 1,
		width: 2,
		capacity: 2,
		kind: 'horizontal' as const,
		clear: true,
		span: 1,
		maxSpan: 13
	});
	const net: PortNetwork = { ports, edges: [edge('r', 's'), edge('s', 'a'), edge('s', 'b')] },
		terminals = [
			{ id: 'root', ports: ['r'] },
			{ id: 'a', ports: ['a'] },
			{ id: 'b', ports: ['b'] }
		],
		hint = new Map(ids.map((id, i) => [id, [i, 0, 0] as const])),
		o = {
			minWidth: 1.2,
			ownerGap: 2,
			loops: 0,
			ratio: 1.4,
			fresh: 2,
			pairs: 8,
			perMetre: 1,
			bias: 2
		};
	const a = connectTerminals(net, terminals, [], hint, o),
		b = connectTerminals(
			{ ports: [...ports].reverse(), edges: [...net.edges].reverse() },
			terminals,
			[],
			hint,
			o
		);
	expect(a).toEqual(b);
	expect(a.edges.length).toBe(3);
	const blocked = connectTerminals(net, terminals, [['sa', 'sb']], hint, o);
	expect(blocked.unreachable).toEqual(['b']);
	expect(blocked.edges.length).toBe(2);
});

test('frontage counts matching level and shared edge length', () => {
	const fronts = [
		{
			id: 'unten',
			a: [0, 0] as const,
			b: [10, 0] as const,
			level: 0,
			width: 3,
			kind: 'alley' as const
		},
		{
			id: 'oben',
			a: [0, 5] as const,
			b: [10, 5] as const,
			level: 1,
			width: 3,
			kind: 'highway' as const
		}
	];
	const result = frontage(
		[
			[0, 0],
			[10, 0],
			[10, 5],
			[0, 5]
		],
		fronts,
		{ level: 0, minWidth: 1, minFront: 2.5, minArea: 1, maxArea: 100, maxDepth: 0 }
	);
	expect(result).toEqual([{ front: 'unten', level: 0, length: 10 }]);
});
import { frontage, relax } from '../raster/universal/kern';
import { slots } from '../eckraster/derive';
import { eckModul } from '../formen/eck';
test('diagonal footbridge: exactly one extra prism, positive area', () => {
	const r = lage({ ...weltDefaults, relax: 0 }),
		f = required(
			r.patch.faces.find((f) => f.vertices.every((v) => !r.rand.has(v))),
			'r.patch.faces.find((f) => f.vertices.every((v) => !r.rand.has(v)))'
		),
		a = f.vertices[0],
		c = f.vertices[2];
	const samples = {
		[address(a, 2)]: { occupied: true, group: WEG, quer: [c] },
		[address(c, 2)]: { occupied: true, group: WEG, quer: [a] }
	};
	const slot = required(
		slots(r.patch, samples).find((s) => s.context.wegQuer),
		'slots(r.patch, samples).find((s) => s.context.wegQuer)'
	);
	const old = eckModul({ ...slot, context: { ...slot.context, wegQuer: 0 } }),
		fresh = eckModul(slot),
		prisms = fresh.filter((p) => p.kind === 'prism');
	expect(prisms.length - old.filter((p) => p.kind === 'prism').length).toBe(1);
	for (const p of prisms)
		if (p.kind === 'prism')
			expect(
				p.polygon.reduce((s, a, i) => {
					const b = p.polygon[(i + 1) % p.polygon.length];
					return s + a[0] * b[1] - a[1] * b[0];
				}, 0)
			).toBeGreaterThan(0);
	expect(new Set(fresh.map((p) => p.id)).size).toBe(fresh.length);
});
test('relaxation keeps the outer boundary and stays compilable', () => {
	const intent = absicht(netz({ ...weltDefaults, verzug: 0.3 }), 45, WELT_GRENZEN).intent;
	expect(relax(intent, 0)).toBe(intent);
	const next = relax(intent, 6);
	validateModel(compile(next));
	const counts = new Map<string, number>();
	for (const f of intent.faces.values())
		for (const ring of f.parts ?? [f.ring])
			ring.forEach((a, i) => {
				const key = [a, ring[(i + 1) % ring.length]].sort().join('|');
				counts.set(key, (counts.get(key) ?? 0) + 1);
			});
	for (const [key, n] of counts)
		if (n === 1)
			for (const id of key.split('|'))
				expect(next.positions.get(id)).toEqual(intent.positions.get(id));
});

for (const { id: raster } of rasterarten)
	for (const seed of [1, 19, 45])
		test(`kernel world finite and deterministic ${raster}:${seed}`, () => {
			const p = { ...weltDefaults, raster, seed, kern: KERN_AN },
				w = welt(p);
			const finite = (value: unknown): boolean =>
				typeof value === 'number'
					? Number.isFinite(value)
					: Array.isArray(value)
						? value.every(finite)
						: value && typeof value === 'object'
							? Object.values(value).every(finite)
							: true;
			expect(finite(w)).toBe(true);
			expect(new Set(w.primitives.map((p) => p.id)).size).toBe(w.primitives.length);
			if (raster !== 'organisch')
				expect(hash(JSON.stringify(welt({ ...p, kern: { ...KERN_AUS, feld: true } })))).toBe(
					MAIN[`${raster}:${seed}` as keyof typeof MAIN]
				);
		});

test('Steiner loop needs cost ratio and fresh ports', () => {
	const ids = ['r', 'a', 'b', 'x', 'y'],
		ports = ids.map((id) => ({ id, owner: id, level: 0, channel: 'walk' as const }));
	const edge = (a: string, b: string, cost: number) => ({
		id: a + b,
		a,
		b,
		cost,
		width: 2,
		capacity: 2,
		kind: 'horizontal' as const,
		clear: true,
		span: 1,
		maxSpan: 13
	});
	const net = {
			ports,
			edges: [
				edge('r', 'a', 10),
				edge('r', 'b', 10),
				edge('a', 'x', 4),
				edge('x', 'y', 4),
				edge('y', 'b', 4)
			]
		},
		terminals = ['r', 'a', 'b'].map((id) => ({ id, ports: [id] })),
		hint = new Map(ids.map((id, i) => [id, [i, 0, 0] as const]));
	const options = {
		minWidth: 1.2,
		ownerGap: 2,
		loops: 1,
		ratio: 1.4,
		fresh: 2,
		pairs: 8,
		perMetre: 1,
		bias: 2
	};
	expect(connectTerminals(net, terminals, [], hint, options).loops).toBe(1);
	expect(connectTerminals(net, terminals, [], hint, { ...options, ratio: 2 }).loops).toBe(0);
});
test('Steiner ownerGap prevents a tight return into a column', () => {
	const ids = ['r', 'a0', 'x', 'y', 'a1', 'b'],
		ports = ids.map((id) => ({
			id,
			owner: id.startsWith('a') ? 'a' : id,
			level: id === 'a1' || id === 'b' ? 1 : 0,
			channel: 'walk' as const
		}));
	const edges = ids.slice(1).map((b, i) => ({
		id: ids[i] + b,
		a: ids[i],
		b,
		cost: 1,
		width: 2,
		capacity: 2,
		kind: 'ramp' as const,
		clear: true,
		span: 1,
		maxSpan: 13
	}));
	const options = {
			minWidth: 1.2,
			ownerGap: 2,
			loops: 0,
			ratio: 1.4,
			fresh: 2,
			pairs: 8,
			perMetre: 1,
			bias: 2
		},
		ts = [
			{ id: 'r', ports: ['r'] },
			{ id: 'b', ports: ['b'] }
		],
		hint = new Map(ids.map((id, i) => [id, [i, 0, 0] as const]));
	expect(connectTerminals({ ports, edges }, ts, [], hint, options).unreachable).toEqual(['b']);
	expect(
		connectTerminals({ ports, edges }, ts, [], hint, { ...options, ownerGap: 1 }).unreachable
	).toEqual([]);
});

test('Steiner also sorts rejected candidates deterministically', () => {
	const ports = ['a', 'b', 'c'].map((id) => ({
		id,
		owner: id,
		level: 0,
		channel: 'walk' as const
	}));
	const edges = [
		{
			id: 'z',
			a: 'a',
			b: 'b',
			cost: 1,
			width: 2,
			capacity: 2,
			kind: 'horizontal' as const,
			clear: false,
			span: 1,
			maxSpan: 13
		},
		{
			id: 'x',
			a: 'a',
			b: 'c',
			cost: 1,
			width: 0.5,
			capacity: 2,
			kind: 'horizontal' as const,
			clear: true,
			span: 1,
			maxSpan: 13
		}
	];
	const ts = [
			{ id: 'root', ports: ['a'] },
			{ id: 'ziel', ports: ['b'] }
		],
		hint = new Map(ports.map((p, i) => [p.id, [i, 0, 0] as const])),
		o = {
			minWidth: 1.2,
			ownerGap: 2,
			loops: 0,
			ratio: 1.4,
			fresh: 2,
			pairs: 8,
			perMetre: 1,
			bias: 2
		};
	expect(connectTerminals({ ports, edges }, ts, [], hint, o)).toEqual(
		connectTerminals({ ports: [...ports].reverse(), edges: [...edges].reverse() }, ts, [], hint, o)
	);
});
