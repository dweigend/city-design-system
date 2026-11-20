import { plotCovers, footprint } from './parcel-footprint';
import { circulation, planHouse, sectionParts } from './index';
import { squareGrid } from '../quad-grid';
import { expect, test } from 'bun:test';
import { assetRegistry } from '../assets';
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

function parcel(width: number, stories: number) {
	const cells = squareGrid(1, 1, width).cells;
	return planHouse({
		cells,
		seed: 1,
		stacks: new Map([[cells[0].id, Array(stories).fill('living')]])
	});
}

test('each parcel ladder flight has two vertical stiles at the surveyed elevations', () => {
	const house = parcel(8, 4);
	const parts = sectionParts(house);
	const runs = circulation(house).legs.filter((leg) => leg.kind === 'ladder');
	for (const [i, leg] of runs.entries()) {
		const stiles = parts
			.filter((p) => p.id.startsWith(house.id + '/stair/ladder/' + i + '/'))
			.map(pipe);
		expect(stiles).toHaveLength(2);
		for (const stile of stiles) {
			const [a, b] = stile.points;
			expect(a.slice(0, 2)).toEqual(b.slice(0, 2));
			expect(a[2]).toBeCloseTo(leg.to[2]);
			expect(b[2]).toBeCloseTo(leg.from[2]);
		}
	}
});

test('narrow parcel ladders stay within the surveyed parcel from terrain to roof', () => {
	const house = parcel(1.8, 1);
	const rails = sectionParts(house)
		.filter((p) => p.id.includes('/stair/ladder/'))
		.map(pipe);
	expect(rails).toHaveLength(2);
	for (const rail of rails) {
		expect(plotCovers(house.cells, footprint(rail), 0)).toBe(true);
		expect(bounds(rail).max[2]).toBeCloseTo(house.top + rail.radius);
	}
});

test('parcel landings reach the registered door elevation at every occupied course', () => {
	for (const stories of [3, 6]) {
		const house = parcel(10, stories);
		const doors = circulation(house).docks;
		expect(doors).toHaveLength(stories + 1);
		const landings = sectionParts(house).filter(
			(p) => p.kind === 'prism' && p.source.objectId === 'landing'
		);
		for (const { door } of doors)
			expect(
				landings.some((p) => p.kind === 'prism' && Math.abs(p.z + p.height - door[2]) < 1e-8)
			).toBe(true);
	}
});
