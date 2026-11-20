import { specimen } from '../house-typology/specimens';
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
test('compact kit spans stay rigid, and the undersize fallback carries a one-metre window band', () => {
	const variants = new Set<string>();
	for (const width of [1.8, 5.6])
		for (const seed of [0, 1, 2]) {
			const cells = squareGrid(1, 1, width).cells;
			const house = planHouse({ cells, seed, stacks: new Map([[cells[0].id, ['living']]]) });
			const body = house.composition.levels[0].bodies[0],
				parts = sectionParts(house);
			expect(
				house.composition.crown.position[2] + house.composition.crown.size[2] - house.base[2]
			).toBeGreaterThanOrEqual(6);
			if (width === 1.8) {
				expect(body.band?.modules).toBeUndefined();
				const glass = parts.find(
					(p) => p.id.startsWith(body.id + '/') && p.id.includes('/window-')
				);
				if (glass?.kind !== 'prism') throw Error('Missing recessed window');
				expect(glass.z - body.position[2]).toBeCloseTo(1);
				expect(glass.height).toBeCloseTo(1);
			} else {
				expect(body.objectId).toBe('kit-band-body-1s-5m');
				expect(body.scale).toBeWithin(0.85, 1.15);
				expect(parts.find((p) => p.id.endsWith('/plinth'))?.source.objectId).toBe(
					'kit-plinth-chamfer-5m'
				);
				variants.add(body.variant);
			}
		}
	expect(variants.size).toBe(3);
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
			expect(s.top).toBe(cells[0].pad + n * STORY);
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
test('a continuous living programme stacks capsules by count and cell order preserves the composition', () => {
	for (let n = 1; n <= 12; n++) {
		const input = site(n, 12, true);
		const capsules = planHouse(input).slots.filter((s) => s.kind === 'capsule' || s.band);
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
			sectionParts(section).map((p) => {
				const replaced = { ...p, ...replacement, material: 'wood' as const };
				if (replaced.kind === 'prism') delete replaced.topToken;
				return replaced;
			})
		);
	}
});

test('explicit shell, glazing and capsule rim assignments survive projection across capsule variants', () => {
	const section = specimen(1, 'capsule-stack', 2, 0);
	const palette = {
		...houseSurfaces,
		water: { token: '--signal', finish: 'holz-natur' } as const,
		pane: { token: '--paper', finish: 'glas-klar' } as const
	};
	const parts = sectionParts(section, palette);
	const rims = sectionParts(section).filter((p) => p.source.slot === 'edge' && p.kind === 'ring');
	expect(rims.length).toBeGreaterThan(0);
	for (const rim of rims) {
		expect(rim).toMatchObject({ token: '--ink', finish: 'metal' });
		expect(parts.find((p) => p.id === rim.id)).toMatchObject(palette.water);
	}
	for (const l of section.composition.levels) {
		const body = parts.filter((p) => p.id.startsWith(l.bodies[0].id + '/'));
		expect(body.length).toBeGreaterThan(0);
		for (const p of body)
			expect(p).toMatchObject(
				p.source.slot === 'glass' && /^kit-capsule-(ribbon|porthole|door)-/.test(p.source.objectId)
					? palette.pane
					: palette.water
			);
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

test('compact pods keep a caged ladder until a full public stair fits its geometry and mass budget', () => {
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
			expect(h.typology).toBe('block');
			expect(parts.some((p) => p.id.includes('/stair/rung/'))).toBe(true);
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
	const shallow = house(4, 12, 0);
	if (!shallow.compact) expect(circulation(shallow).width).toBe(2.5);
	expect(circulation(specimen(1, 'round-tower')).width).toBe(2.5);
});

test('the capsule reference has no dark or sub-half-metre pieces resting on a deck or tread', () => {
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
	expect(decks.every((p) => p.finish === 'beton-terrazzo')).toBe(true);
	const treads = parts.filter((p) => p.source.objectId === 'stairs' && p.kind === 'prism');
	expect(treads.length).toBeGreaterThan(0);
	expect(treads.every((p) => p.kind === 'prism' && p.topToken === houseSurfaces.access.token)).toBe(
		true
	);
	const hits = parts.filter((p) => {
		const b = bounds(p);
		if (p.token !== '--ink' && Math.max(...b.max.map((v, k) => v - b.min[k])) >= 0.5) return false;
		return surfaces.some((surface) => {
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
