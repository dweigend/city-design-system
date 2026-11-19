import { describe, expect, test } from 'bun:test';
import { contains } from '../formen/geom';
import { eckModul } from '../formen/eck';
import type { Slot } from '../eck';
import { slots } from '../eckraster/derive';
import { address, BESTAND, isWeg, WEG, type Occupancy } from '../eckraster/state';
import { farbcodes, rasterarten, welt, weltDefaults } from './index';
import { belegung } from './belegung';
import { lage as lageOf } from './lage';
import { netz as blocknetz } from './netze';
import { KLASSEN, LAUF_MAX, LAUF_MIN, SPANNWEITE, wege } from './wege';

const seeds = [1, 19, 45, 4294967295];
const lage = (seed: number, more = {}) => {
	const p = { ...weltDefaults, seed, ...more },
		r = lageOf(p),
		b = belegung(r, p),
		vorher = JSON.stringify(Object.entries(b.samples).filter(([, s]) => s.group === BESTAND)),
		netz = wege(r, b, 3);
	return { r, b, netz, vorher };
};

describe('L11 world', () => {
	test('same seed, same world', () => {
		for (const seed of seeds)
			expect(JSON.stringify(welt({ ...weltDefaults, seed }))).toBe(
				JSON.stringify(welt({ ...weltDefaults, seed }))
			);
		expect(JSON.stringify(welt({ ...weltDefaults, seed: 1 }).primitives)).not.toBe(
			JSON.stringify(welt({ ...weltDefaults, seed: 2 }).primitives)
		);
	});

	test('all slider extremes return finite geometry with unique IDs', () => {
		for (const seed of [1, 4294967295])
			for (const groesse of [3, 6])
				for (const v of [0, 1]) {
					const w = welt({ ...weltDefaults, seed, groesse, dichte: v, hoehe: 1 - v, schwamm: v });
					expect(JSON.stringify(w).includes('null')).toBe(false);
					expect(new Set(w.primitives.map((p) => p.id)).size).toBe(w.primitives.length);
					expect(w.primitives.length).toBeGreaterThan(500);
					expect(w.primitives.length).toBeLessThan(60000);
					for (const k of Object.values(w.bilanz)) {
						expect(k).toBeGreaterThanOrEqual(0);
						expect(k).toBeLessThanOrEqual(1);
					}
				}
	});

	test('existing stock stays: protected, gray, with houses; interventions join it', () => {
		for (const seed of seeds) {
			const { b, vorher } = lage(seed);
			// Neither interventions nor paths overwrite an existing-stock cell.
			expect(JSON.stringify(Object.entries(b.samples).filter(([, s]) => s.group === BESTAND))).toBe(
				vorher
			);
			for (const e of b.eingriffe)
				for (const [id, l] of e.cells) expect(b.samples[address(id, l)].group).not.toBe(BESTAND);
		}
		const w = welt(weltDefaults);
		for (const p of w.primitives) if (p.role === 'bestand') expect(p.token).toBe('--paper');
		expect(w.zahlen.bestand).toBeGreaterThan(20);
		expect(w.zahlen.eingriffe).toBeGreaterThan(3);
	});

	test('one system: volumes, frames and paths come from the corner modules', () => {
		const w = welt(weltDefaults);
		// Slot IDs of the corner modules carry the face of the patch (face:<macro cell>/…@<level>).
		const modul = w.primitives.filter((p) => /^face:.*@-?\d/.test(p.id));
		expect(modul.length).toBeGreaterThan(w.primitives.length * 0.5);
		expect(modul.some((p) => p.kind === 'frame')).toBe(true);
		expect(modul.some((p) => p.id.includes('-weg-') && p.kind === 'membrane')).toBe(true);
		// Interlocked: at least one intervention occupies several cells on several levels in one function.
		const { b } = lage(weltDefaults.seed);
		const stuecke = b.eingriffe.map((e) => {
			const byGroup = new Map<string, [string, number][]>();
			for (const [id, l] of e.cells) {
				const g = b.samples[address(id, l)].group;
				byGroup.set(g, [...(byGroup.get(g) ?? []), [id, l]]);
			}
			return [...byGroup.values()].some(
				(c) => new Set(c.map(([id]) => id)).size > 1 && new Set(c.map(([, l]) => l)).size > 1
			);
		});
		expect(stuecke.filter(Boolean).length).toBeGreaterThan(1);
	});

	test('paths: feasible, connected, two height classes, flights, loops, roofs', () => {
		for (const seed of seeds) {
			const { r, b, netz } = lage(seed);
			const o: Occupancy = b.samples;
			expect(netz.knoten.length).toBeGreaterThan(10);
			for (const [id, l] of netz.knoten) {
				expect(o[address(id, l)].group).toBe(WEG);
				// Clear height free, no path directly below.
				expect(o[address(id, l + 1)]).toBeUndefined();
				expect(isWeg(o, id, l - 1)).toBe(false);
			}
			// Edges: neighboring cells, at most one floor of difference.
			for (const [a, c] of netz.kanten) {
				const [ia, la] = netz.knoten[a],
					[ic, lc] = netz.knoten[c];
				expect(r.nb.get(ia)!.includes(ic)).toBe(true);
				expect(Math.abs(la - lc)).toBeLessThanOrEqual(1);
			}
			// One network: everything is reachable from node 0.
			const adj = netz.knoten.map(() => [] as number[]);
			for (const [a, c] of netz.kanten) {
				adj[a].push(c);
				adj[c].push(a);
			}
			const seen = new Set([0]),
				queue = [0];
			for (let i = 0; i < queue.length; i++)
				for (const n of adj[queue[i]])
					if (!seen.has(n)) {
						seen.add(n);
						queue.push(n);
					}
			expect(seen.size).toBe(netz.knoten.length);
			for (const k of KLASSEN) expect(netz.ebenen).toContain(k);
			expect(netz.laeufe).toBeGreaterThan(1);
			expect(netz.dachwege).toBeGreaterThan(0);
			// Spanning tree plus loops: one more edge per loop than a tree has.
			expect(netz.kanten.length - (netz.knoten.length - 1)).toBe(netz.schleifen);
			expect(netz.schleifen).toBeGreaterThan(0);
		}
	});

	test('walkthrough: starts and ends on the ground, climbs at most one floor per step', () => {
		for (const seed of seeds) {
			const w = welt({ ...weltDefaults, seed });
			expect(w.tour.length).toBeGreaterThan(6);
			expect(w.tour[0][2]).toBeLessThan(2);
			expect(w.tour.at(-1)![2]).toBeLessThan(2);
			expect(Math.max(...w.tour.map((q) => q[2]))).toBeGreaterThan(8);
			for (let i = 1; i < w.tour.length; i++) {
				const [a, c] = [w.tour[i - 1], w.tour[i]];
				expect(Math.hypot(c[0] - a[0], c[1] - a[1])).toBeLessThan(9);
				expect(Math.abs(c[2] - a[2])).toBeLessThan(4.5);
			}
			expect(w.blockers.some((poly) => contains(poly, w.stand.von))).toBe(false);
		}
	});

	test('color code and focus color through the corner modules', () => {
		// Rule "Flows": paths carry people (pink), frame is signal, track ink.
		const strom = welt(weltDefaults);
		for (const p of strom.primitives) {
			if (p.id.includes('-weg-') && p.kind !== 'polyline' && p.kind !== 'cylinder')
				expect(['--cat-business', '--paper']).toContain(p.token);
			if (p.id.includes('-geruest-')) expect(p.token).toBe('--signal');
		}
		const rot = welt({ ...weltDefaults, farbcode: '43' });
		for (const p of rot.primitives)
			if (/^face:.*@/.test(p.id))
				expect(['--paper', '--cat-hazard', '--signal']).toContain(p.token);
		const netze = welt({ ...weltDefaults, fokus: 'netze' });
		for (const p of netze.primitives)
			if (p.role === 'neu' && p.token !== '--paper')
				expect(/-weg-|^treppe:|^figur-|^bahn-/.test(p.id)).toBe(true);
		const volumen = welt({ ...weltDefaults, fokus: 'volumen' });
		for (const p of volumen.primitives) if (p.id.includes('-weg-')) expect(p.token).toBe('--paper');
		expect(farbcodes.map((f) => f.id)).toEqual(['strom', '45', '36', '43']);
	});
});

describe('Path corner module', () => {
	const slot = (mask: number, weg: number, more: Partial<Slot['context']> = {}): Slot => ({
		id: 's',
		corners: [
			[0, 0],
			[5, 0],
			[5.4, 5.2],
			[-0.3, 4.8]
		],
		zLow: 6,
		zHigh: 10,
		mask,
		seed: 1,
		context: {
			neighborFilled: [true, true, true, true],
			openAbove: true,
			ground: false,
			courtyard: false,
			span: false,
			role: 'neu',
			centered: true,
			tokens: Array.from({ length: 8 }, () => '--cat-hazard' as const),
			weg,
			...more
		}
	});

	test('path instead of volume: landing and footbridge, railing only toward the void', () => {
		const steg = eckModul(slot(0b00110000, 0b00110000));
		// Two landings, one footbridge, no wall.
		expect(steg.filter((p) => p.kind === 'prism').length).toBe(3);
		expect(steg.every((p) => p.kind === 'prism' || p.kind === 'polyline')).toBe(true);
		for (const p of steg) if (p.kind === 'prism') expect(p.height).toBeLessThan(0.5);
		// Four path bits: a platform without railing in the middle.
		const platz = eckModul(slot(0b11110000, 0b11110000));
		expect(platz.length).toBe(1);
	});

	test('one floor of height difference becomes a flight, level beside it does not', () => {
		const lauf = eckModul(slot(0b00100001, 0b00100001));
		expect(lauf.filter((p) => p.kind === 'membrane').length).toBe(1);
		const m = lauf.find((p) => p.kind === 'membrane');
		if (m?.kind === 'membrane') {
			const z = m.corners.map((c) => c[2]);
			expect(Math.max(...z) - Math.min(...z)).toBeCloseTo(4, 5);
		}
		expect(eckModul(slot(0b00110001, 0b00110001)).some((p) => p.kind === 'membrane')).toBe(false);
	});

	test('next to a new volume the path docks on, the volume stays whole', () => {
		const both = eckModul(slot(0b00110000, 0b00010000, { dock: 0b00100000 }));
		expect(both.some((p) => p.id.includes('-weg-'))).toBe(true);
		expect(both.some((p) => p.kind === 'prism' && p.height >= 2)).toBe(true);
	});

	test('L10 stays untouched: no path occupancy, no path context', () => {
		const { r, b } = lage(45);
		const ohne = Object.fromEntries(Object.entries(b.samples).filter(([, s]) => s.group !== WEG));
		for (const s of slots(r.patch, ohne).slice(0, 400)) expect(s.context.weg ?? 0).toBe(0);
	});
});

describe('Universal grid: the same city logic on every grid', () => {
	const arten = rasterarten.map((r) => r.id);

	test('nine systems, each a valid quad mesh with blocks and a closed fringe', () => {
		expect(arten.length).toBe(9);
		for (const raster of arten)
			for (const groesse of [3, 4, 6]) {
				const r = lageOf({ ...weltDefaults, raster, groesse });
				expect(r.guete.minAngle).toBeGreaterThan(5);
				expect(r.guete.minArea).toBeGreaterThan(0.5);
				expect(r.blocks.length).toBeGreaterThan(3);
				expect(r.umrisse.length).toBeGreaterThan(0);
				for (const b of r.blocks) {
					expect(b.saum.length).toBeGreaterThan(3);
					// Fringe: alley cells; every two consecutive ones are neighbors in the mesh.
					b.saum.forEach((id, k) => {
						expect(r.blockOf.has(id)).toBe(false);
						expect(r.nb.get(id)!.includes(b.saum[(k + 1) % b.saum.length])).toBe(true);
					});
					// Ring and depth cover the block; every ring cell lies in exactly one side or corner.
					const ring = b.cells.filter((c) => b.tiefe.get(c) === 1),
						verteilt = [...b.seiten.flatMap((s) => s.cells), ...b.ecken.map((e) => e.cell)];
					expect([...verteilt].sort()).toEqual([...ring].sort());
				}
			}
	});

	test('same seed and sliders: same mesh; macro cells divide every edge equally', () => {
		for (const raster of arten) {
			const p = { ...weltDefaults, raster, verzug: 0.5 };
			expect(JSON.stringify(blocknetz(p))).toBe(JSON.stringify(blocknetz(p)));
			const r = lageOf(p);
			// No seam: every inner edge belongs to exactly two faces (assemble counts neighbors).
			for (const f of r.patch.faces) expect(f.neighbors.length).toBe(4);
		}
	});

	for (const raster of arten)
		test(`world emerges on grid ${raster}: finite, unique, existing stock and interventions`, () => {
			for (const seed of [45, 7]) {
				const w = welt({ ...weltDefaults, raster, seed });
				const text = JSON.stringify(w);
				expect(text.includes('null')).toBe(false);
				expect(new Set(w.primitives.map((p) => p.id)).size).toBe(w.primitives.length);
				expect(w.zahlen.bestand).toBeGreaterThan(8);
				expect(w.zahlen.eingriffe).toBeGreaterThan(1);
				expect(w.tour.length).toBeGreaterThan(4);
			}
		});

	test('paths on every grid: one network, feasible, span and flight within limits', () => {
		for (const raster of arten) {
			const { r, b, netz, vorher } = lage(45, { raster });
			const o: Occupancy = b.samples;
			expect(JSON.stringify(Object.entries(o).filter(([, s]) => s.group === BESTAND))).toBe(vorher);
			expect(netz.knoten.length).toBeGreaterThan(8);
			for (const [id, l] of netz.knoten) {
				expect(o[address(id, l + 1)]).toBeUndefined();
				expect(isWeg(o, id, l - 1)).toBe(false);
				expect(r.rand.has(id)).toBe(false);
			}
			const adj = netz.knoten.map(() => [] as number[]);
			for (const [a, c] of netz.kanten) {
				adj[a].push(c);
				adj[c].push(a);
				const [ia, la] = netz.knoten[a],
					[ic, lc] = netz.knoten[c],
					[pa, pc] = [r.point.get(ia)!, r.point.get(ic)!],
					len = Math.hypot(pc[0] - pa[0], pc[1] - pa[1]);
				expect(r.nb.get(ia)!.includes(ic)).toBe(true);
				if (la > 0 || lc > 0) expect(len).toBeLessThanOrEqual(SPANNWEITE);
				if (la !== lc) {
					expect(len).toBeGreaterThanOrEqual(LAUF_MIN);
					expect(len).toBeLessThanOrEqual(LAUF_MAX);
				}
			}
			const seen = new Set([0]),
				queue = [0];
			for (let i = 0; i < queue.length; i++)
				for (const n of adj[queue[i]])
					if (!seen.has(n)) {
						seen.add(n);
						queue.push(n);
					}
			expect(seen.size).toBe(netz.knoten.length);
			expect(netz.ebenen.some((l) => KLASSEN.includes(l))).toBe(true);
		}
	});

	test('occupancy sliders build on the same layout: the mesh stays, only the occupancy changes', () => {
		const a = welt({ ...weltDefaults, raster: 'organisch', dichte: 0.2 }),
			b = welt({ ...weltDefaults, raster: 'organisch', dichte: 0.9 });
		expect(a.zahlen.zellen).toBe(b.zahlen.zellen);
		expect(a.extent).toBe(b.extent);
		expect(JSON.stringify(a.primitives)).not.toBe(JSON.stringify(b.primitives));
	});
});
