import { buildObject } from '../assets';
import { expect, test } from 'bun:test';
import { STORY } from '../../data/grid';
import { squareGrid } from '../quad-grid';
import type { HouseUse } from '../../data/house-body';
import {
	houseLinks,
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
				posts = parts.filter((p) => p.id.includes('/post/') && p.kind === 'cylinder');
			expect(s.top).toBe(cells[0].pad + n * STORY);
			const roof = parts.find((p) => p.id.endsWith('/roof-walk'));
			if (roof?.kind !== 'prism') throw Error('Missing roof walk');
			expect(roof.z + roof.height).toBeCloseTo(s.top);
			expect(s.decks.length).toBe(n <= 2 ? 1 : n <= 5 ? 2 : s.decks.length);
			if (n >= 4) expect(s.decks.filter((d) => d.kind === 'void')).toHaveLength(1);
			const levels = new Set<number>();
			for (const p of parts) {
				if (p.kind === 'prism') expect(p.z).toBeGreaterThanOrEqual(s.base[2] - 1e-8);
				if (p.id.includes('/stair/') && p.kind === 'prism')
					levels.add(Math.round((p.z + p.height) * 1000));
			}
			for (const [i, d] of s.decks.entries()) {
				expect(levels.has(Math.round(d.position[2] * 1000))).toBe(true);
				const inside = (x: number, y: number) => {
					const u = (2 * (x - d.position[0])) / d.width,
						v = (2 * (y - d.position[1])) / d.depth;
					return (d.round ? Math.hypot(u, v) : Math.max(Math.abs(u), Math.abs(v))) <= 1.000001;
				};
				expect(
					posts.filter(
						(p) =>
							p.kind === 'cylinder' &&
							inside(p.position[0], p.position[1]) &&
							p.position[2] + p.height >= d.position[2]
					)
				).toHaveLength(5);
				const body = s.slots.find((a) => a.id === s.id + '/tier/' + i + '/body');
				if (!body) continue;
				expect(body.position[2]).toBe(d.position[2]);
				for (const u of [-0.5, 0.5])
					for (const v of [-0.5, 0.5])
						expect(
							inside(body.position[0] + u * body.size[0], body.position[1] + v * body.size[1])
						).toBe(true);
				const row = s.slots.filter(
					(a) => a.id.startsWith(body.id) && a.position[2] === d.position[2]
				);
				const area =
					row.reduce((sum, a) => sum + a.size[0] * a.size[1], 0) /
					(d.width * d.depth * (d.round ? Math.PI / 4 : 1));
				expect(area).toBeGreaterThanOrEqual(0.5);
				expect(area).toBeLessThanOrEqual(0.8);
			}
			expect(levels.has(Math.round(s.top * 1000))).toBe(true);
		}
});
test('a continuous living programme stacks capsules by count and cell order preserves the composition', () => {
	for (let n = 1; n <= 12; n++) {
		const input = site(n, 12, true);
		const capsules = planHouse(input).slots.filter((s) => s.kind === 'capsule');
		expect(capsules.every((c) => c.size[2] === capsules[0].size[2])).toBe(true);
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
		Array.from({ length: 32 }, (_, seed) =>
			planHouse({ ...paint, seed })
				.decks.map((d) => d.kind)
				.join('/')
		)
	);
	expect(compositions.size).toBeGreaterThan(1);
	expect(planHouse(site(4, 2)).typology).toBe('house');
	expect(planHouse(site(5, 2)).typology).toBe('tower');
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
	const glass = before.filter((p) => p.id.includes('/living-capsule/') && p.finish === 'glas-klar');
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
	const parts = [
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
		'primitive-cylinder',
		'primitive-box',
		'primitive-slab',
		'primitive-pipe',
		'lattice-mast',
		'stairs'
	])
		expect(objects.has(id)).toBe(true);
});
