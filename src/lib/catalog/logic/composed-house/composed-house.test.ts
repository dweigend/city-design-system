import { specimen } from '../house-typology/specimens';
import { buildingPalette } from '../material/building-palette';
import { buildObject } from '../assets';
import { expect, test } from 'bun:test';
import { checkFit } from '../house-typology';
import { accessShare } from './access-budget';
import { bounds } from '../ansicht/geometrie';
import { footprint, plotCovers } from './parcel-footprint';
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
test('one-storey envelopes follow their surveyed parcel and seat the crown on the roof walk', () => {
	for (const width of [1.8, 5.6])
		for (const seed of [0, 1, 2]) {
			const cells = squareGrid(1, 1, width).cells;
			const house = planHouse({ cells, seed, stacks: new Map([[cells[0].id, ['living']]]) });
			const exterior = house.composition.exterior;
			expect(exterior?.ring).toHaveLength(4);
			expect(exterior?.top).toBe(house.top);
			expect(house.composition.crown.position[2]).toBe(house.top);
			const walls = sectionParts(house).filter((p) => p.source.objectId === 'full-height-shell');
			expect(walls).toHaveLength(4);
			for (const wall of walls) expect(plotCovers(cells, footprint(wall), 0)).toBe(true);
		}
});
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
			expect(s.decks).toHaveLength(n);
			expect(s.composition.exterior?.stations[n].z).toBe(s.top);
			expect(checkFit(s.composition.parts)).toEqual([]);
			expect(accessShare(parts)).toBeLessThanOrEqual(0.1);
			expect(route.docks.map((d) => d.door).slice(1)).toEqual(
				[...s.composition.levels].reverse().map((l) => l.landing)
			);
			expect(route.stops.length).toBe(s.decks.length + 2);
			for (const [i, p] of s.composition.people.entries()) {
				const feet = parts.filter((part) => part.id.startsWith(s.id + '/people/' + i + '/'));
				expect(Math.min(...feet.map((f) => bounds(f).min[2]))).toBeCloseTo(p.position[2]);
			}
			expect(parts.every((p) => bounds(p).max.every(Number.isFinite))).toBe(true);
		}
});
test('a continuous living programme occupies successive parcel courses independent of cell order', () => {
	for (let n = 1; n <= 12; n++) {
		const input = site(n, 12, true);
		const bodies = planHouse(input).slots.filter((s) => s.band?.footprint);
		expect(bodies.length).toBeGreaterThanOrEqual(n);
		expect(bodies.every((c) => c.scale >= 0.85 && c.scale <= 1.15)).toBe(true);
		if (n >= 3) expect(new Set(bodies.map((c) => c.position[2])).size).toBeGreaterThanOrEqual(2);
		expect(composedHouse(input)).toEqual(composedHouse({ ...input, cells: [...cells].reverse() }));
	}
});
test('an edit keeps independent houses and their shared ensemble byte-identical', () => {
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
	for (const id of ['2/0', '3/0'])
		expect(before.find((g) => g.id === id)?.planningCells.toSorted()).toEqual(['2/0', '3/0']);
});

test('the same mixed paint allows distinct parcel envelopes by seed', () => {
	const paint = site(9, 2);
	const compositions = new Set(
		Array.from(
			{ length: 32 },
			(_, seed) => planHouse({ ...paint, seed }).composition.exterior?.system
		)
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
			sectionParts(section).map((p) => {
				const replaced = { ...p, ...replacement, material: 'wood' as const };
				if (replaced.kind === 'prism') delete replaced.topToken;
				return replaced;
			})
		);
	}
});

test('explicit shell and pane assignments survive projection of occupied parcel courses', () => {
	const section = planHouse(site(4, 0));
	const shell = { token: '--signal', finish: 'keramik-glasiert' } as const;
	const pane = { token: '--cat-health-3', finish: 'glas-klar' } as const;
	const parts = sectionParts(section, { ...houseSurfaces, shell, pane });
	const body = section.composition.levels.at(-1)?.bodies[0];
	if (!body) throw Error('Missing upper room');
	const walls = parts.filter(
		(p) => p.id.startsWith(body.id + '/') && p.buildingSurface?.slot === 'shell'
	);
	const panes = parts.filter(
		(p) => p.id.startsWith(body.id + '/') && p.buildingSurface?.slot === 'pane'
	);
	expect(walls.length).toBeGreaterThan(0);
	expect(panes.length).toBeGreaterThan(0);
	for (const part of walls) expect(part).toMatchObject(shell);
	for (const part of panes) expect(part).toMatchObject(pane);
});
test('every house and bridge part traces to a colour-free registry member and its assigned slot', () => {
	const houses = [
		planHouse(site(12, 3)),
		planHouse({
			...site(5, 4),
			cells: [grid.cells[3]],
			stacks: new Map([[grid.cells[3].id, uses]])
		})
	];
	const palette = { ...houseSurfaces };
	const assignment = { token: '--signal', finish: 'wood' } as const;
	for (const slot of Object.keys(palette) as (keyof HouseSurfaces)[]) palette[slot] = assignment;
	const [a, b] = houses;
	const x = (a.base[0] + b.base[0]) / 2;
	const y = (a.base[1] + b.base[1]) / 2;
	a.composition.ports = [{ level: 0, position: [x - 3, y, 5] }];
	b.composition.ports = [{ level: 0, position: [x + 3, y, 5] }];
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
		...sectionParts(specimen(1, 'capsule-stack'), palette),
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
	for (const id of ['primitive-slab', 'full-height-shell', 'ladder', 'landing'])
		expect(objects.has(id)).toBe(true);
});
test('parcel ladders connect every occupied floor across shallow and deep plots', () => {
	const unit = squareGrid(1, 1, 1).cells[0];
	for (let depth = 4; depth <= 12; depth += 0.25) {
		const [a, b, c, d] = unit.corners.map(([x, y, z]): [number, number, number] => [
			x * 4,
			y * depth,
			z
		]);
		const cell = { ...unit, corners: [a, b, c, d] as const };
		const house = planHouse({
			cells: [cell],
			stacks: new Map([[cell.id, Array(4).fill('living')]]),
			seed: 2
		});
		const route = circulation(house);
		const parts = sectionParts(house);
		expect(route.docks.slice(1).map((dock) => dock.door)).toEqual(
			[...house.composition.levels].reverse().map((deck) => deck.landing)
		);
		expect(
			route.legs
				.filter((leg) => leg.kind === 'ladder')
				.every((leg) => Math.abs(leg.to[2] - leg.from[2]) <= 4)
		).toBe(true);
		expect(parts.some((p) => p.id.includes('/stair/rung/'))).toBe(true);
		for (const { door } of route.docks)
			expect(
				parts.some(
					(p) =>
						p.kind === 'prism' &&
						p.id.includes('/stair/landing/') &&
						Math.abs(p.z + p.height - door[2]) < 1e-8
				)
			).toBe(true);
	}
});
test('parcel decks and ladder landings retain walkable finishes and clear surfaces', () => {
	const parts = sectionParts(specimen(1, 'capsule-stack', 4, 1));
	const surfaces = parts.filter(
		(p) => p.kind === 'prism' && (p.roofCell || /tread|landing/.test(p.id))
	);
	expect(surfaces.length).toBeGreaterThan(0);
	const decks = surfaces.filter(
		(p) =>
			p.id.endsWith('/deck') ||
			p.id.endsWith('/plinth') ||
			p.source.objectId === 'stairs' ||
			p.source.objectId === 'landing'
	);
	for (const p of decks) {
		const slot = p.buildingSurface?.slot;
		if (p.id.endsWith('/plinth')) expect(slot).toBe('base');
		else expect(slot === 'deck' || slot === 'frame').toBe(true);
	}
	const treads = parts.filter((p) => p.source.objectId === 'landing' && p.kind === 'prism');
	expect(treads.length).toBeGreaterThan(0);
	expect(treads.every((p) => p.buildingSurface?.slot === 'deck')).toBe(true);
	const hits = parts.filter((p) => {
		const b = bounds(p);
		const role = p.buildingSurface;
		const token = role ? buildingPalette(role.use, role.ensemble)[role.slot].token : p.token;
		if (token !== '--ink' && Math.max(...b.max.map((v, k) => v - b.min[k])) >= 0.5) return false;
		return treads.some((surface) => {
			const deck = bounds(surface);
			return (
				surface !== p &&
				Math.abs(b.min[2] - deck.max[2]) <= 0.02 &&
				[0, 1].every((k) => b.min[k] < deck.max[k] && b.max[k] > deck.min[k])
			);
		});
	});
	expect(hits.map((p) => [p.id, p.source.objectId, p.source.slot])).toEqual([]);
});
