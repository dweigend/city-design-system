// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import { flowToken } from './focus';
import { formgruppen } from './formen';
import { uiIcons } from './icon-regeln';
import {
	ICON_RAND,
	ICON_RASTER,
	bauzonen,
	formIcons,
	kontextregeln,
	regelIcons,
	stromIcons,
	zonenIcons,
	type IconZeichnung
} from './icons';

const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

type Segment = { k: string; rel: boolean; erstes: boolean; werte: number[] };

/** Splits a path into single segments; checks the command and the number of values. */
function segmente(d: string): Segment[] {
	return [...d.matchAll(/([a-zA-Z])([^a-zA-Z]*)/g)].flatMap(([, befehl, rest]) => {
		const k = befehl.toLowerCase();
		const n = ARGS[k];
		const zahlen = (rest.match(/-?(\d+\.?\d*|\.\d+)/g) ?? []).map(Number);
		if (n === undefined) throw new Error(`Unknown command ${befehl}`);
		if (zahlen.length % (n || 1) !== 0 || n > 0 !== zahlen.length > 0)
			throw new Error(`Wrong number of values for ${befehl}: ${rest}`);
		return Array.from({ length: Math.max(1, zahlen.length / (n || 1)) }, (_, i) => ({
			k,
			rel: befehl === k,
			erstes: i === 0,
			werte: zahlen.slice(i * n, (i + 1) * n)
		}));
	});
}

/** End point of a segment, absolute. */
function ziel({ k, rel, werte }: Segment, x: number, y: number): [number, number] {
	const [a, b] = werte.slice(-2);
	if (k === 'h') return [rel ? x + a : a, y];
	if (k === 'v') return [x, rel ? y + a : a];
	return rel ? [x + a, y + b] : [a, b];
}

/** End points of all segments of a path, absolute. Control points and arc bulges do not count. */
function endpunkte(d: string): [number, number][] {
	const punkte: [number, number][] = [];
	let ort: [number, number] = [0, 0];
	let start = ort;
	for (const s of segmente(d)) {
		ort = s.k === 'z' ? start : ziel(s, ...ort);
		if (s.k === 'm' && s.erstes) start = ort;
		punkte.push(ort);
	}
	return punkte;
}

const lagen = (z: IconZeichnung) => [z.linie, z.flaeche, z.masse].filter((d) => d !== undefined);
const alle: [string, IconZeichnung][] = [
	...Object.entries(formIcons),
	...Object.entries(stromIcons),
	...Object.entries(zonenIcons),
	...Object.entries(regelIcons)
];

describe('Icon language', () => {
	test('every form group has exactly one icon under its stable ID', () => {
		expect(Object.keys(formIcons).sort()).toEqual(formgruppen.map((g) => g.id).sort());
	});

	test('every flow has a sign with a fill for its color', () => {
		expect(Object.keys(stromIcons).sort()).toEqual(Object.keys(flowToken).sort());
		for (const z of Object.values(stromIcons)) expect(z.flaeche).toBeDefined();
	});

	test('zones and context rules show what is meant as mass and carry no color', () => {
		expect(Object.keys(zonenIcons)).toEqual(bauzonen.map((z) => z.id));
		expect(Object.keys(regelIcons)).toEqual(kontextregeln.map((k) => k.id));
		for (const z of [...Object.values(zonenIcons), ...Object.values(regelIcons)]) {
			expect(z.masse).toBeDefined();
			expect(z.flaeche).toBeUndefined();
		}
	});

	test('existing stock and load-bearing structure stay neutral: no fill for color', () => {
		expect(formIcons.bestand.flaeche).toBeUndefined();
		expect(formIcons.rahmen.flaeche).toBeUndefined();
	});

	test('every drawing keeps its end points within the drawing area 2 to 22', () => {
		expect(alle.length).toBe(27);
		for (const [id, z] of alle) {
			expect(lagen(z).length).toBeGreaterThan(0);
			for (const [x, y] of lagen(z).flatMap(endpunkte)) {
				for (const v of [x, y]) {
					expect(`${id} ${v >= ICON_RAND - 1e-6}`).toBe(`${id} true`);
					expect(`${id} ${v <= ICON_RASTER - ICON_RAND + 1e-6}`).toBe(`${id} true`);
				}
			}
		}
	});

	test('fills and masses are closed', () => {
		for (const [id, z] of alle)
			for (const d of [z.flaeche, z.masse])
				if (d)
					expect(`${id} ${d.split(/(?=M)/).every((teil) => /z$/i.test(teil))}`).toBe(`${id} true`);
	});

	test('the UI selection names each Lucide name once', () => {
		const namen = uiIcons.map((u) => u.name);
		expect(new Set(namen).size).toBe(namen.length);
	});
});
