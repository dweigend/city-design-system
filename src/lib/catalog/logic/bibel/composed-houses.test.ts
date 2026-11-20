import { expect, test } from 'bun:test';
import { composedHousePlates } from './composed-houses';

const plates = composedHousePlates();
const singles = [
	['Inflated vessel', 'inflated-cushion', 4],
	['Pleated tower', 'pleated-sheet', 4],
	['Woven lantern', 'woven-basket', 8],
	['Service spiral', 'helical-services', 5],
	['Ribbed longhouse', 'arch-ribs', 4]
] as const;
for (const [i, [title, system, storeys]] of singles.entries()) {
	test(title + ' carries its envelope across every inhabited floor', () => {
		const plate = plates[i];
		expect(plate.title).toBe(title);
		const walls = plate.primitives.filter((p) => p.id.includes('/exterior/') && p.kind === 'mesh');
		expect(walls.length).toBeGreaterThanOrEqual(4);
		const roof = plate.primitives.find((p) => p.kind === 'prism' && p.id.endsWith('/roof-walk'));
		if (roof?.kind !== 'prism') throw Error('Missing roof deck');
		for (const wall of walls) {
			if (wall.kind !== 'mesh') throw Error('Missing wall mesh');
			expect(wall.id).toContain(system);
			expect(Math.max(...wall.points.map((p) => p[2]))).toBeCloseTo(roof.z + roof.height);
		}
		expect(
			plate.primitives.filter((p) => p.id.includes('/level/') && p.id.endsWith('/deck'))
		).toHaveLength(storeys - 1);
	});
}
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
