import { describe, expect, test } from 'bun:test';
import { wegenetz, type Knoten } from './wege';
import { erhalten, flussbild } from './bilanz';
import { funktionen } from '../parametrik/eckraster/funktion';
import { bestandSzenen, koepfe, turmPhasen } from './szenen';

describe('Elevated walkway network', () => {
	const k = (id: string, x: number, y: number, ebene = 2): Knoten => ({ id, x, y, ebene });
	const knoten = [
		k('a', 0, 0),
		k('b', 10, 0),
		k('c', 20, 0),
		k('d', 20, 10),
		k('e', 10, 10),
		k('f', 0, 10)
	];
	test('spanning tree connects all nodes with n−1 edges', () => {
		const n = wegenetz(knoten, 0);
		expect(n.baum.length).toBe(knoten.length - 1);
		expect(n.schleifen.length).toBe(0);
	});
	test('loops only where they save a detour, never twice', () => {
		const n = wegenetz(knoten, 2);
		expect(n.schleifen.length).toBeGreaterThan(0);
		for (const s of n.schleifen) expect(n.baum).not.toContain(s);
	});
	test('a different level is no edge', () => {
		const n = wegenetz([k('a', 0, 0, 2), k('b', 5, 0, 4)], 1);
		expect(n.baum.length).toBe(0);
		expect(n.andereEbene.length).toBe(1);
	});
});

describe('Stock balance', () => {
	const fluesse = [
		{ von: 'Deconstruction', nach: 'Reuse', menge: 700 },
		{ von: 'Deconstruction', nach: 'Processing', menge: 200 },
		{ von: 'Deconstruction', nach: 'Rejects', menge: 100 },
		{ von: 'Processing', nach: 'Secondary material', menge: 180 },
		{ von: 'Processing', nach: 'Loss', menge: 20 }
	];
	test('quantity is conserved', () => {
		expect(erhalten(fluesse)).toBe(true);
		expect(erhalten([...fluesse.slice(0, 4)])).toBe(false);
	});
	test('bands have a height proportional to the quantity', () => {
		const b = flussbild(fluesse, 200);
		expect(b.spalten).toBe(3);
		const q = b.saeulen.find((s) => s.id === 'Deconstruction')!;
		const w = b.baender.find((x) => x.nach === 'Reuse')!;
		expect(w.h / q.h).toBeCloseTo(0.7);
	});
});

describe('Scenes', () => {
	test('function crowns show their flow color; residential vegetation stays green', () => {
		for (const k of koepfe()) {
			const f = funktionen.find((f) => f.id === k.id)!;
			if (f.token) expect(k.primitives.some((p) => p.token === f.token)).toBe(true);
			if (f.id === 'wohnen')
				expect(k.primitives.some((p) => p.token === '--cat-nature')).toBe(true);
		}
	});
	test('tower phases grow, crowns per function, existing stock not empty', () => {
		const t = turmPhasen();
		expect(t.length).toBe(4);
		expect(t[3].primitives.length).toBeGreaterThan(t[0].primitives.length);
		expect(koepfe().every((k) => k.primitives.length > 1)).toBe(true);
		expect(bestandSzenen([{ id: 'aufstockung', name: 'A' }])[0].primitives.length).toBeGreaterThan(
			0
		);
	});
});
