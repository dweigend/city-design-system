import { expect, test } from 'bun:test';
import { composedHousePlates } from './composed-houses';

const plates = composedHousePlates();
const decks = (i: number) =>
	plates[i].primitives.filter((p) => p.id.includes('/level/') && p.id.endsWith('/deck'));

test('capsule stack carries four console landings', () => {
	expect(plates.map((p) => p.title)).toEqual([
		'Capsule stack',
		'Deck tower',
		'Round tower',
		'Cluster mast',
		'Portal house',
		'Three neighbours',
		'One public walkway'
	]);
	expect(decks(0)).toHaveLength(0);
	expect(
		plates[0].primitives.filter((p) => p.id.includes('/level/') && p.id.endsWith('/landing'))
	).toHaveLength(4);
	expect(plates[0].primitives.some((p) => p.id.includes('kit-capsule-ribbon'))).toBe(true);
});
test('deck tower carries a solar crown and an articulated front frame', () => {
	const parts = plates[1].primitives;
	expect(parts.some((p) => p.id.includes('kit-crown-solar-sail'))).toBe(true);
	expect(parts.some((p) => p.id.includes('/front/post/'))).toBe(true);
});
test('round tower carries circular decks and glazed drums', () => {
	expect(decks(2).every((p) => p.kind === 'prism' && p.polygon.length === 64)).toBe(true);
	expect(
		plates[2].primitives.some(
			(p) => p.id.includes('/kit-crown-lantern-') && p.finish === 'glas-klar'
		)
	).toBe(true);
});
test('cluster mast carries inhabited capsules on alternating axes', () => {
	const parts = plates[3].primitives.filter(
		(p) => p.kind === 'box' && p.id.includes('/kit-capsule-ribbon-')
	);
	expect(new Set(parts.map((p) => p.rotation)).size).toBeGreaterThan(1);
});
test('three neighbours share two level spans', () => {
	const spans = plates[5].primitives.filter((p) => p.id.startsWith('link/') && p.kind === 'prism');
	expect(new Set(spans.map((p) => p.id.split('/').slice(0, 4).join('/'))).size).toBe(2);
	expect(spans.some((p) => p.id.includes('stair-bridge'))).toBe(false);
});

test('five separate roofs share a branching public walkway and registry pedestrians', () => {
	const parts = plates[6].primitives;
	expect(parts.filter((p) => p.id.endsWith('/roof-walk'))).toHaveLength(5);
	const walk = parts.filter((p) => p.id.startsWith('network/'));
	expect(walk.some((p) => p.kind === 'mesh')).toBe(true);
	expect(walk.some((p) => p.id.includes('/plaza/'))).toBe(true);
	expect(walk.some((p) => p.id.includes('/person-'))).toBe(true);
});
