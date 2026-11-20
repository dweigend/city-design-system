import { specimen } from '../house-typology/specimens';
import { planHouse, sectionParts } from './index';
import { squareGrid } from '../quad-grid';
import { expect, test } from 'bun:test';
import { assetRegistry, buildObject } from '../assets';
import { bounds } from '../ansicht/geometrie';
import { place } from './asset-fit';
import { houseObject } from './house-object';

test('every registered object variant mounts as a house fitting with finite geometry', () => {
	const kinds = new Set<string>();
	let variants = 0;
	for (const asset of assetRegistry)
		for (const variant of asset.variants) {
			const slots = Object.fromEntries(
				asset.slotNames.map((name) => [name, { token: '--paper', finish: 'metal' } as const])
			);
			const { parts } = houseObject(asset.id, variant, 17, { instanceId: 'fit', slots });
			const fitted = place(parts, [0, 0, 0], [12, -7, 8], [1.1, 1.1, 1.1], 0.6);
			expect(fitted).toHaveLength(parts.length);
			for (const part of fitted) {
				kinds.add(part.kind);
				const box = bounds(part);
				expect([...box.min, ...box.max].every(Number.isFinite)).toBe(true);
			}
			variants++;
		}
	expect(variants).toBeGreaterThan(1000);
	expect(kinds.size).toBeGreaterThan(8);
});

function pipe<T extends { kind: string }>(p: T) {
	if (p.kind !== 'pipe') throw Error('Expected a rail member');
	return p as Extract<T, { kind: 'pipe' }>;
}

test('switchback and winding handrails follow the tread edges with one vertical post per station', () => {
	for (const type of ['round-tower', 'deck-tower'] as const) {
		const rails = sectionParts(specimen(1, type))
			.filter((p) => p.source.objectId === 'railing')
			.map(pipe);
		const tops = rails.filter((p) => p.source.member === 0),
			posts = rails.filter((p) => p.source.member !== 0);
		expect(tops.some((p) => p.points.length > 2)).toBe(true);
		const vertices = new Set(tops.flatMap((p) => p.points.map((q) => q.join(','))));
		const seats = new Set<string>();
		for (const p of posts) {
			const [foot, top] = p.points;
			expect(seats.has(top.join(','))).toBe(false);
			seats.add(top.join(','));
			expect(vertices.has(top.join(','))).toBe(true);
			expect(foot.slice(0, 2)).toEqual(top.slice(0, 2));
			expect(top[2] - foot[2]).toBeCloseTo(0.92, 8);
		}
	}
});
test('the narrow block ladder bears against the inside of its folded facade', () => {
	const cells = squareGrid(1, 1, 4).cells;
	const s = planHouse({
		cells,
		seed: 1,
		stacks: new Map([[cells[0].id, ['living', 'living', 'living']]])
	});
	const parts = sectionParts(s);
	const stile = parts.find((p) => p.id.includes('/stair/ladder/'));
	if (stile?.kind !== 'pipe') throw Error('Missing ladder stile');
	const [x, y, z] = stile.points[0];
	const walls = parts.filter((p) => p.id.includes('/ladder-housing'));
	expect(
		walls.some(
			(p) =>
				p.kind === 'prism' &&
				p.z <= z &&
				p.z + p.height >= z &&
				p.polygon.some(([u, v], i, ring) => {
					const [a, b] = ring[(i + 1) % ring.length];
					return (
						v === b &&
						Math.min(u, a) <= x &&
						x <= Math.max(u, a) &&
						Math.abs(Math.abs(v - y) - stile.radius) <= 0.02
					);
				})
		)
	).toBe(true);
});

test('winding terrain approaches mount each complete ramp at its native size and grade', () => {
	for (const [cells, height, variant] of [
		[1, 3, 'standard'],
		[1, 6, 'medium'],
		[4, 6, 'long']
	] as const) {
		const section = specimen(cells, 'round-tower', height, 7);
		const ramp = sectionParts(section).filter((p) => p.source.objectId === 'ramp');
		const stock = buildObject('ramp', variant, section.seed).parts;
		expect(ramp).toHaveLength(stock.length);
		for (const [i, p] of ramp.entries()) {
			const local = stock[i];
			if (p.kind !== 'wedge' || local.kind !== 'wedge') throw Error('Expected a mounted ramp');
			expect(p.source.variant).toBe(variant);
			expect(p.structuralRole).toBe('bearing');
			expect(p.size).toEqual(local.size);
			expect(p.low).toBe(local.low);
		}
	}
});
