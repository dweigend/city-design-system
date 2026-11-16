// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, test, expect } from 'bun:test';
import { createPatch } from './topology';
import {
	apply,
	blockrand,
	GERUEST,
	initialOccupancy,
	isBestand,
	MAX_LEVEL,
	occupied,
	type Occupancy
} from './state';
import { slots, LEVELS, SLOT_LEVELS } from './derive';
import { fixture, fixtureNames } from './fixtures';
import { haeuser } from './bestand';
import { erschliessung, TURM } from './erschliessung';
import { heads } from './koepfe';
import { presentation } from './presentation';
import { eckModul, GERUEST_TOKEN } from '../formen/eck';
import { bestandDetails } from '../formen/eckbestand';
import { treppe } from '../formen/eckerschliessung';
import type { Primitive } from '../types';

const p = createPatch();
const put = (o: Occupancy, id: string, h: number, group = 'wohnen', frame = false) =>
	apply(p, o, { vertexId: id, level: h, occupied: true, group, frame });
const take = (o: Occupancy, id: string, h: number) =>
	apply(p, o, { vertexId: id, level: h, occupied: false, group: 'wohnen' });

describe('Round 2: existing stock, structural frame, circulation, height', () => {
	test('historic perimeter block: parcels of rim and rear cell, 3–5 floors, protected', () => {
		const rand = blockrand(p);
		expect(rand.length).toBeGreaterThanOrEqual(10);
		for (const b of rand) {
			expect(b.levels).toBeGreaterThanOrEqual(3);
			expect(b.levels).toBeLessThanOrEqual(5);
			expect(rand.find((x) => x.id === b.parcel)!.levels).toBe(b.levels);
		}
		const o = initialOccupancy(p);
		const { id, levels } = rand[0];
		expect(take(o, id, 0)).toEqual(o);
		expect(put(o, id, 1)).toEqual(o);
		expect(
			apply(p, {}, { vertexId: 'origin', level: 0, occupied: true, group: 'bestand' })
		).toEqual({});
		// Rooftop extension is allowed.
		expect(occupied(put(o, id, levels), id, levels)).toBe(true);
	});

	test('existing stock: punched facade only on exposed pieces, roof only without rooftop extension', () => {
		const o = initialOccupancy(p);
		const houses = haeuser(p, o);
		expect(houses.length).toBe(6);
		expect(houses.filter((h) => h.dach === 'sattel').length).toBeGreaterThanOrEqual(4);
		expect(houses.some((h) => h.dach === 'eckturm')).toBe(true);
		const windows = (x: Occupancy) =>
			haeuser(p, x)
				.flatMap(bestandDetails)
				.filter((q) => q.kind === 'polyline').length;
		const h = houses.find((h) => h.dach === 'sattel')!;
		const back = h.cells.find((c) => c !== h.id)!;
		const inner = p.vertices
			.find((v) => v.id === back)!
			.neighbors.find((n) => !isBestand(o, n, 0))!;
		// An annex covers windows; a rooftop extension takes the roof.
		expect(windows(put(o, inner, 0))).toBeLessThan(windows(o));
		const raised = put(o, back, h.levels);
		expect(haeuser(p, raised).find((x) => x.id === h.id)!.dach).toBeNull();
		for (const q of houses.flatMap(bestandDetails)) expect(q.role).toBe('bestand');
	});

	test('frame: set, insert module, remove is reversible', () => {
		let o: Occupancy = {};
		o = put(o, 'origin', 2, 'wasser', true);
		expect(o['origin@2']).toEqual({ occupied: true, group: GERUEST, frame: true });
		o = put(o, 'origin', 2, 'energie');
		expect(o['origin@2']).toEqual({ occupied: true, group: 'energie', frame: true });
		o = take(o, 'origin', 2);
		expect(o['origin@2']).toEqual({ occupied: true, group: GERUEST, frame: true });
		expect(take(o, 'origin', 2)).toEqual({});
		// Frame around an existing volume.
		const body = put({}, 'origin', 0, 'wohnen');
		expect(put(body, 'origin', 0, 'x', true)['origin@0']).toEqual({
			occupied: true,
			group: 'wohnen',
			frame: true
		});
	});

	test('frame modules: empty only struts, plug-in module with volume, no duplicate bays', () => {
		const hollow = put({}, 'origin', 1, 'x', true);
		const out = slots(p, hollow).flatMap(eckModul);
		expect(out.filter((q) => q.kind === 'prism').length).toBe(0);
		const frames = out.filter((q) => q.kind === 'frame');
		expect(frames.length).toBeGreaterThan(5);
		expect(frames.every((q) => q.token === GERUEST_TOKEN)).toBe(true);
		expect(frames.some((q) => q.kind === 'frame' && q.braced)).toBe(true);
		// Every bay exactly once (position, length, height), across all slots.
		const key = (q: Primitive) =>
			q.kind === 'frame'
				? [...q.position, ...q.size, q.rotation ?? 0].map((n) => n.toFixed(2)).join(',')
				: '';
		const tower = slots(p, fixture(p, 'geruestturm', 1))
			.flatMap(eckModul)
			.filter((q) => q.kind === 'frame' && q.size[2] > 3);
		expect(new Set(tower.map(key)).size).toBe(tower.length);
		const insert = put(hollow, 'origin', 1, 'energie');
		const solids = slots(p, insert)
			.flatMap(eckModul)
			.filter((q) => q.kind === 'prism');
		expect(solids.some((q) => q.token === '--cat-mobility')).toBe(true);
	});

	test('height: levels 0 … 6, level 7 rejected, slots up to 6', () => {
		expect(MAX_LEVEL).toBeGreaterThanOrEqual(6);
		expect(LEVELS.at(-1)).toBe(MAX_LEVEL);
		expect(SLOT_LEVELS[0]).toBe(-1);
		expect(occupied(put({}, 'origin', 6), 'origin', 6)).toBe(true);
		expect(put({}, 'origin', MAX_LEVEL + 1)).toEqual({});
		const tower = LEVELS.reduce((o, h) => put(o, 'origin', h, 'wasser'), {} as Occupancy);
		const top = slots(p, tower)
			.flatMap(eckModul)
			.filter((q) => q.kind === 'prism');
		expect(Math.max(...top.map((q) => (q.kind === 'prism' ? q.z + q.height : 0)))).toBeGreaterThan(
			(MAX_LEVEL + 1) * 4 - 0.01
		);
		expect(heads(p, tower)).toEqual([expect.objectContaining({ level: MAX_LEVEL })]);
	});

	test('circulation: emergent, deterministic, in free columns, never twice', () => {
		for (const { id } of fixtureNames) {
			const o = fixture(p, id);
			const stairs = erschliessung(p, o);
			expect(erschliessung(p, o)).toEqual(stairs);
			expect(new Set(stairs.map((t) => t.vertexId)).size).toBe(stairs.length);
			for (const t of stairs) {
				expect(LEVELS.every((h) => !occupied(o, t.vertexId, h))).toBe(true);
				expect(p.vertices.find((v) => v.id === t.vertexId)!.neighbors).toContain(t.anchor);
			}
		}
		// Tower from TURM + 1 own floors, flight at walkway ends.
		const tower = Array.from({ length: TURM + 1 }, (_, h) => h).reduce(
			(o, h) => put(o, 'origin', h, 'wasser'),
			{} as Occupancy
		);
		expect(erschliessung(p, tower).map((t) => t.art)).toEqual(['turm']);
		expect(erschliessung(p, put({}, 'origin', 0)).length).toBe(0);
		expect(erschliessung(p, fixture(p, 'hochweg')).some((t) => t.art === 'lauf')).toBe(true);
		// Rooftop extension uses the stairwell of the existing stock; floating without existing stock: spiral.
		const [b] = blockrand(p);
		expect(erschliessung(p, put(initialOccupancy(p), b.id, b.levels)).length).toBe(0);
		expect(erschliessung(p, put({}, 'origin', 2)).map((t) => t.art)).toEqual(['wendel']);
	});

	test('stair form reaches the exit height and stays in its cell', async () => {
		const { cellOutline } = await import('./bestand');
		const { contains } = await import('../formen/geom');
		const o = fixture(p, 'hochweg-turm');
		for (const t of erschliessung(p, o)) {
			const outline = cellOutline(p, t.vertexId);
			const prims = treppe({
				id: t.id,
				art: t.art,
				outline,
				toward: p.vertices.find((v) => v.id === t.anchor)!.point,
				z: t.z,
				token: '--cat-business'
			});
			const top = Math.max(
				...prims.map((q) =>
					q.kind === 'box' || q.kind === 'wedge' ? q.position[2] + q.size[2] : 0
				)
			);
			expect(top).toBeCloseTo(t.z, 3);
			for (const q of prims)
				if (q.kind === 'wedge') {
					const [x, y] = q.position;
					expect(contains(outline, [x + q.size[0] / 2, y + q.size[1] / 2])).toBe(true);
				}
		}
	});

	test('build phases of the frame tower: frame → core → plug-in modules → crown', () => {
		const phase = (n: number) => {
			const o = fixture(p, 'geruestturm', n);
			return presentation(p, o, slots(p, o), eckModul, false, false, { koepfe: n >= 4 });
		};
		const body = (n: number) =>
			phase(n).filter((q) => q.kind === 'prism' && q.role === 'neu' && q.id !== 'ground');
		expect(body(1).length).toBe(0);
		expect(body(2).length).toBeGreaterThan(0);
		const colours = (n: number) => new Set(body(n).map((q) => q.token)).size;
		expect(colours(3)).toBeGreaterThan(colours(2));
		expect(phase(4).some((q) => q.id.startsWith('kopf:'))).toBe(true);
		expect(phase(3).some((q) => q.id.startsWith('kopf:'))).toBe(false);
	});
});
