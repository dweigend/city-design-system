import { describe, expect, test } from 'bun:test';
import { rasterReihe, rasterSchichten } from './raster';
import { teile, teilformen, teilungsBild } from './viereckteilung';
import {
	GRENZWINKEL,
	messe,
	naechsteEcke,
	netzBei,
	punkt,
	spielraum,
	traeger,
	ziehe,
	zulaessig
} from './spielraum';
import { weltDefaults } from '../parametrik/welt';

const params = { ...weltDefaults, raster: 'sechseck' as const };

describe('Grid strip and layers', () => {
	test('nine grids from strict to organic, all with blocks and cells', () => {
		const reihe = rasterReihe();
		expect(reihe.map((r) => r.id)).toEqual([
			'quadrat',
			'achsen',
			'dreieck',
			'sechseck',
			'polar',
			'kontur',
			'voronoi',
			'viereck',
			'organisch'
		]);
		for (const r of reihe) {
			expect(r.bloecke.length).toBeGreaterThan(0);
			expect(r.zellen).not.toContain('NaN');
		}
	});
	test('same seed, same layers', () => {
		expect(rasterSchichten(params)).toEqual(rasterSchichten(params));
	});
	test('every layer is non-empty, all quads have four corners', () => {
		const s = rasterSchichten(params);
		expect(s.bloecke.length).toBeGreaterThan(0);
		expect(s.zellen.length).toBeGreaterThanOrEqual(s.bloecke.length);
		expect(s.vierecke.every((q) => q.length === 4)).toBe(true);
		expect(s.bauecken.length).toBeGreaterThan(0);
		expect(s.gassenecken.length).toBeGreaterThan(0);
	});
});

describe('Quad subdivision', () => {
	test('n-gon → n quads', () => {
		const n = teilformen.slice(0, 4).map((f) => teile(f.polygone).vierecke.length);
		expect(n).toEqual([3, 4, 6, 5]);
	});
	test('neighbors share their edge midpoint: two shared edges, no seam', () => {
		const t = teile(teilformen[4].polygone);
		expect(t.vierecke.length).toBe(6 + 4 + 3);
		expect(t.kantenmitten.filter((k) => k.geteilt).length).toBe(2);
		expect(t.speichen.length).toBe(13);
	});
	test('schedule: empty at the start, fully built in the middle, monotonic while building', () => {
		expect(teilungsBild(0)).toEqual({
			umriss: 0,
			mitte: 0,
			kantenmitten: 0,
			speichen: 0,
			vierecke: 0,
			hub: 0
		});
		const voll = teilungsBild(0.75);
		expect([voll.umriss, voll.mitte, voll.kantenmitten, voll.speichen, voll.vierecke]).toEqual([
			1, 1, 1, 1, 1
		]);
		for (let u = 0; u < 0.9; u += 0.05)
			expect(teilungsBild(u + 0.05).speichen).toBeGreaterThanOrEqual(teilungsBild(u).speichen);
	});
});

describe('Corner leeway', () => {
	const t = traeger(19);
	test('carrier: 8 × 8 quads, 49 free corners, the core accepts the whole motion', () => {
		expect(t.basis.faces.length).toBe(64);
		expect(t.frei.length).toBe(49);
		for (let s = 0; s <= 1; s += 0.125) expect(netzBei(t, s).quality.minAngle).toBeGreaterThan(20);
	});
	test('same seed, same positions; IDs persist through the motion', () => {
		expect([...traeger(19).ziel]).toEqual([...t.ziel]);
		const ids = (s: number) => netzBei(t, s).faces.map((f) => f.id);
		expect(ids(1)).toEqual(ids(0));
	});
	test('a small move is free, one too far stops at the boundary and stays valid', () => {
		const p = netzBei(t, 0.5),
			id = naechsteEcke(p, t.frei, [0, 0]),
			a = punkt(p, id);
		expect(ziehe(p, id, [a[0] + 0.5, a[1]]).amRand).toBe(false);
		const weit = ziehe(p, id, [a[0] + 40, a[1]]);
		expect(weit.amRand).toBe(true);
		expect(zulaessig(p, id, weit.punkt)).toBe(true);
		expect(weit.punkt[0]).toBeGreaterThan(a[0] + 0.5);
	});
	test('at the edge of the leeway a quad is almost acute or almost straight', () => {
		const p = netzBei(t, 0.5),
			id = naechsteEcke(p, t.frei, [0, 0]);
		const vorher = messe(p, id);
		expect(vorher.kleinster).toBeGreaterThan(GRENZWINKEL);
		expect(vorher.groesster).toBeLessThan(180);
		for (const ziel of [
			[40, 0],
			[0, 40],
			[-30, -30]
		] as const) {
			const a = punkt(p, id),
				r = ziehe(p, id, [a[0] + ziel[0], a[1] + ziel[1]]).punkt;
			const q = messe(
				{ ...p, vertices: p.vertices.map((v) => (v.id === id ? { ...v, point: r } : v)) },
				id
			);
			const spitz = q.kleinster >= GRENZWINKEL - 0.05 && q.kleinster < GRENZWINKEL + 1;
			expect(spitz || q.groesster > 178).toBe(true);
			expect(q.groesster).toBeLessThan(180);
		}
	});
	test('leeway encloses the corner', () => {
		const p = netzBei(t, 0.5),
			id = t.frei[24],
			r = spielraum(p, id, 24);
		expect(r.length).toBe(24);
		expect(r.every((q) => zulaessig(p, id, q))).toBe(true);
	});
});
