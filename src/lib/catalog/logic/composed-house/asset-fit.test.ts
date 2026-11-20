import { specimen } from '../house-typology/specimens';
import { planHouse, sectionParts } from './index';
import { squareGrid } from '../quad-grid';
import { expect, test } from 'bun:test';
import { assetRegistry, buildObject } from '../assets';
import { bounds } from '../ansicht/geometrie';
import { place } from './asset-fit';
import { houseObject, type HousePart } from './house-object';

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

function expectRailBays(rails: HousePart[]) {
	const local = buildObject('railing', 'standard', 17).parts.map(pipe);
	const members = rails.map(pipe);
	expect(members.length).toBeGreaterThan(local.length);
	const length = (points: (typeof local)[number]['points']) =>
		Math.hypot(...points[1].map((v, k) => v - points[0][k]));
	for (let i = 0; i < members.length; i += local.length) {
		const top = members[i];
		const scale = top.radius / local[0].radius;
		expect(scale).toBeWithin(0.85, 1.15);
		const bayIndex = (id: string) => Number(id.split('/').at(-2));
		if (i && bayIndex(top.id) === bayIndex(members[i - local.length].id) + 1)
			for (const k of [0, 1, 2])
				expect(top.points[0][k]).toBeCloseTo(members[i - local.length].points[1][k], 9);
		for (const [j, stock] of local.entries()) {
			const p = members[i + j];
			expect(p.source.member).toBe(j);
			expect(p.radius).toBeCloseTo(stock.radius * scale);
			expect(length(p.points)).toBeCloseTo(length(stock.points) * scale);
		}
	}
}

test('switchback and winding stairs mount complete, uniformly scaled railing bays', () => {
	for (const type of ['round-tower', 'deck-tower'] as const)
		expectRailBays(sectionParts(specimen(1, type)).filter((p) => p.source.objectId === 'railing'));
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
