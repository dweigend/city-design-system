import { expect, test } from 'bun:test';
import { composedHousePlates } from './composed-houses';
const plates = composedHousePlates();
const ids = (i: number) => plates[i].primitives.map((p) => p.id);
test('two-storey energy pavilion has one occupied deck and a solar crown', () => {
	expect(plates.map((p) => p.id)).toEqual([
		'pavilion',
		'house',
		'rectangular',
		'round',
		'ensemble'
	]);
	expect(ids(0).filter((id) => id.includes('/deck/'))).toHaveLength(1);
	expect(ids(0)).toContain('0/0/tier/0/collector/solar-roof/0');
});
test('four-storey garden house frames an open lower terrace below its bell', () => {
	expect(ids(1).filter((id) => id.includes('/deck/'))).toHaveLength(2);
	expect(ids(1).some((id) => id.startsWith('0/0/tier/0/body/'))).toBe(false);
	expect(plates[1].primitives.some((p) => p.kind === 'dome' && p.finish === 'glas-klar')).toBe(
		true
	);
});
test('eight-storey rectangular tower pairs a solar workshop with trees and a windowed capsule', () => {
	const parts = plates[2].primitives;
	expect(parts.find((p) => p.id === '0/0/core')?.kind).toBe('prism');
	for (const fragment of [
		'/lattice',
		'/collector',
		'/tree-trough/',
		'/living-capsule/',
		'/windows',
		'/supply/water/pipe',
		'/stairs/'
	])
		expect(parts.some((p) => p.id.includes(fragment))).toBe(true);
});
test('twelve-storey round tower carries five circular decks around the cylindrical core', () => {
	const parts = plates[3].primitives;
	expect(parts.find((p) => p.id === '0/0/core')?.kind).toBe('cylinder');
	expect(parts.filter((p) => p.id.includes('/deck/'))).toHaveLength(5);
	expect(parts.some((p) => p.kind === 'dome' && p.finish === 'glas-klar')).toBe(true);
});
test('three different heights have one shared platform, one skyway and one stair bridge', () => {
	const spans = ids(4)
		.filter((id) => id.startsWith('link/'))
		.map((id) => id.split(':')[0]);
	expect(new Set(spans).size).toBe(3);
	for (const kind of ['skyway', 'platform', 'stair-bridge'])
		expect(spans.some((id) => id.endsWith('/' + kind))).toBe(true);
});
