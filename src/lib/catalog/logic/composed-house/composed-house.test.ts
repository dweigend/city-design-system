import { buildObject } from '../assets';
import { expect, test } from 'bun:test';
import { checkFit } from '../house-typology';
import { accessShare } from './access-budget';
import { bounds } from '../ansicht/geometrie';
import { STORY } from '../../data/grid';
import { squareGrid } from '../quad-grid';
import type { HouseUse } from '../../data/house-body';
import {
	houseLinks,
	circulation,
	houseSurfaces,
	type HouseSurfaces,
	composedGroups,
	composedHouse,
	planHouse,
	sectionParts
} from './index';

const grid = squareGrid(9, 3, 12);
const cells = [grid.cells[0], grid.cells[1]];
const uses: HouseUse[] = ['water', 'living', 'food', 'energy', 'material'];
function site(n: number, seed: number, mono = false) {
	const floors = Array.from({ length: n }, (_, i) =>
		mono ? ('living' as const) : uses[(seed + i) % uses.length]
	);
	return { cells, stacks: new Map(cells.map((c) => [c.id, floors])), seed };
}
test('frame bearings, supported volumes, walking surfaces and roof datum through every height', () => {
	for (let n = 1; n <= 12; n++)
		for (let seed = 0; seed < 5; seed++) {
			const s = planHouse(site(n, seed)),
				parts = sectionParts(s),
				route = circulation(s);
			expect(s.top).toBe(cells[0].pad + n * STORY);
			expect(checkFit(s.composition.parts)).toEqual([]);
			expect(accessShare(parts)).toBeLessThanOrEqual(0.1);
			expect(route.docks.map((d) => d.door).slice(1)).toEqual(
				[...s.composition.levels].reverse().map((l) => l.landing)
			);
			expect(route.stops.length).toBe(s.decks.length + 2);
			expect(s.composition.people.length).toBeGreaterThanOrEqual(2);
			expect(s.composition.people.length).toBeLessThanOrEqual(6);
			for (const [i, p] of s.composition.people.entries()) {
				const feet = parts.filter((part) => part.id.startsWith(s.id + '/people/' + i + '/'));
				expect(Math.min(...feet.map((f) => bounds(f).min[2]))).toBeCloseTo(
					s.decks[p.level].position[2]
				);
			}
			expect(parts.every((p) => bounds(p).max.every(Number.isFinite))).toBe(true);
		}
});
test('a continuous living programme stacks capsules by count and cell order preserves the composition', () => {
	for (let n = 1; n <= 12; n++) {
		const input = site(n, 12, true);
		const capsules = planHouse(input).slots.filter((s) => s.kind === 'capsule');
		expect(capsules.every((c) => c.scale >= 0.85 && c.scale <= 1.15)).toBe(true);
		if (n >= 3) expect(new Set(capsules.map((c) => c.position[2])).size).toBeGreaterThanOrEqual(2);
		expect(composedHouse(input)).toEqual(composedHouse({ ...input, cells: [...cells].reverse() }));
	}
});
test('an edit keeps independent houses and their mutual link byte-identical', () => {
	const stacks = new Map<string, HouseUse[]>([
		['0/0', ['water']],
		['2/0', ['food', 'living']],
		['3/0', ['material', 'living']],
		['8/0', ['water']]
	]);
	const before = composedGroups(grid, stacks, 17);
	const after = composedGroups(grid, new Map(stacks).set('0/0', ['water', 'energy']), 17);
	for (const old of before.filter((g) => !g.cells.includes('0/0')))
		expect(after.find((g) => g.id === old.id)?.parts()).toEqual(old.parts());
	expect(before.some((g) => g.id === 'link/2/0~3/0')).toBe(true);
});

test('the same mixed paint allows distinct WFC compositions by seed', () => {
	const paint = site(9, 2);
	const compositions = new Set(
		Array.from({ length: 32 }, (_, seed) => planHouse({ ...paint, seed }).typology)
	);
	expect(compositions.size).toBeGreaterThan(1);
});

test('replacing every named surface changes no generated geometry', () => {
	const replacement = { finish: 'wood', token: '--signal' } as const;
	const palette = { ...houseSurfaces };
	for (const slot of Object.keys(palette) as (keyof HouseSurfaces)[]) palette[slot] = replacement;
	for (const seed of [0, 1, 2, 3, 4]) {
		const section = planHouse(site(9, seed));
		expect(sectionParts(section, palette)).toEqual(
			sectionParts(section).map((p) => ({ ...p, ...replacement, material: 'wood' }))
		);
	}
});

test('reassigning the capsule glass leaves its shell and the continuous frame untouched', () => {
	const input = site(2, 7, true);
	const before = composedHouse(input);
	const after = composedHouse(input, {
		...houseSurfaces,
		pane: { token: '--signal', finish: 'holz-natur' }
	});
	const glass = before.filter(
		(p) => p.source.objectId.startsWith('kit-capsule') && p.finish === 'glas-klar'
	);
	expect(glass.length).toBeGreaterThan(0);
	for (const [i, part] of before.entries()) {
		if (part.finish === 'glas-klar')
			expect(after[i]).toMatchObject({ id: part.id, finish: 'holz-natur', token: '--signal' });
		else expect(after[i]).toEqual(part);
	}
});

test('every house and bridge part traces to a colour-free registry member and its assigned slot', () => {
	const houses = [
		planHouse(site(12, 3)),
		planHouse({
			...site(5, 4),
			cells: [grid.cells[2]],
			stacks: new Map([[grid.cells[2].id, uses]])
		})
	];
	const palette = { ...houseSurfaces };
	const assignment = { token: '--signal', finish: 'wood' } as const;
	for (const slot of Object.keys(palette) as (keyof HouseSurfaces)[]) palette[slot] = assignment;
	const bridges = houseLinks(grid, houses, 17, [], palette);
	expect(bridges.length).toBeGreaterThan(0);
	const plate = squareGrid(1, 1, 15).cells[0];
	const tower = planHouse({
		cells: [plate],
		stacks: new Map([
			[plate.id, ['water', 'water', 'living', 'living', 'food', 'food', 'energy', 'energy']]
		]),
		seed: 2
	});
	const parts = [
		...sectionParts(tower, palette),
		...houses.flatMap((h) => sectionParts(h, palette)),
		...bridges.flatMap((b) => b.parts)
	];
	const objects = new Set<string>();
	for (const part of parts) {
		const { objectId, variant, seed, member, slot } = part.source;
		const source = buildObject(objectId, variant, seed).geometry[member];
		expect(source).toMatchObject({ kind: part.kind, slot });
		for (const key of ['token', 'material', 'finish', 'overprint', 'topToken', 'printBand'])
			expect(source).not.toHaveProperty(key);
		expect(part).toMatchObject(assignment);
		objects.add(objectId);
	}
	for (const id of [
		'kit-column-foot-0p5m',
		'kit-column-head-0p5m',
		'kit-column-shaft-2m',
		'kit-capsule-cradle-2p5m',
		'primitive-slab',
		'stairs'
	])
		expect(objects.has(id)).toBe(true);
});

test('a seated pod takes a stair in a clear elongated bay and a caged ladder with four-metre rests on a square', () => {
	const unit = squareGrid(1, 1, 1).cells[0];
	function house(depth: number, width = 4, pad = 8) {
		const corners = unit.corners.map(
			([x, y, z]) => [x * width, y * depth, z] as [number, number, number]
		);
		const [a, b, c, d] = corners;
		const cell = { ...unit, pad, corners: [a, b, c, d] as const };
		return planHouse({
			cells: [cell],
			stacks: new Map([[cell.id, Array(4).fill('living')]]),
			seed: 2
		});
	}
	let stair = false;
	for (let depth = 4; depth <= 12; depth += 0.25) {
		const h = house(depth),
			route = circulation(h);
		if (stair) expect(h.compact).toBe(false);
		if (depth === 4) expect(h.compact).toBe(true);
		if (h.compact) {
			expect(
				route.legs.every((l) => l.kind === 'ladder' && Math.abs(l.to[2] - l.from[2]) <= 4)
			).toBe(true);
			const parts = sectionParts(h);
			expect(parts.some((p) => p.id.includes('/stair/cage/'))).toBe(true);
			for (const l of route.legs.slice(0, -1))
				expect(
					parts.some(
						(p) =>
							p.kind === 'prism' &&
							p.id.includes('/stair/landing/') &&
							Math.abs(p.z + p.height - l.to[2]) < 0.001
					)
				).toBe(true);
		} else {
			stair = true;
			expect(route.legs.some((l) => l.kind === 'ladder')).toBe(false);
		}
	}
	expect(stair).toBe(true);
	expect(house(4, 12, 0).compact).toBe(false);
});
