import { expect, test } from 'bun:test';
import { bounds } from '../ansicht/geometrie';
import { houseSurfaces, planHouse, sectionParts, structureHouse } from '../composed-house';
import { composeHouse, planEnsemble } from '../house-typology';
import { squareGrid } from '../quad-grid';
import type { HouseUse } from '../../data/house-body';
import {
	checkHouseStructure,
	exoskeletonHouse,
	fannedTrussHouse,
	houseThreshold,
	mastHouse,
	tentMastHouse,
	scaffoldHouse,
	skinFrame,
	structureParts,
	supportedNodes,
	type HouseStructure,
	type Plot
} from './index';

const GROUND = 2;
/** An irregular convex parcel: no builder may rely on a square. */
const plot: Plot = {
	id: 'plot',
	ensemble: 'court',
	use: 'living',
	ground: GROUND,
	parcel: {
		polygon: [
			[0, 0],
			[11, 1],
			[12, 9],
			[1, 10]
		],
		holes: []
	}
};
const elements = (house: HouseStructure, element: string) =>
	structureParts(house).filter((part) => part.element === element);
const rules = (house: HouseStructure) => checkHouseStructure(house).map((f) => f.rule);

function painted(storeys: number, seed: number, span = 10) {
	const cell = squareGrid(4, 3, span).cellsById.get('1/1');
	if (!cell) throw new RangeError('Missing test cell');
	const stack = Array<HouseUse>(storeys).fill('living');
	return { cells: [cell], stacks: new Map([[cell.id, stack]]), seed };
}

test('example 1: a layered block is one case of the contract and keeps every body', () => {
	const section = planHouse(painted(8, 7));
	const { structure, levels, crown } = section.composition;
	expect(structure.principle).toBe('layers');
	expect(checkHouseStructure(structure)).toEqual([]);
	expect(structure.platforms.filter((p) => p.room)).toHaveLength(8);
	expect(structure.platforms.map((p) => p.datum)).toEqual([
		...levels.map((l) => l.position[2]),
		section.top
	]);
	expect(section.slots).toEqual([...levels.flatMap((l) => l.bodies), crown]);
});

const reach = (p: number[]) => Math.hypot(p[0] - 6, p[1] - 5);

test('example 2: a single mast stands two decks inside a calyx of cloth that flares to its brim', () => {
	const house = mastHouse(plot, { height: 12, datums: [3, 6] });
	expect(checkHouseStructure(house)).toEqual([]);
	expect(house.platforms.map((p) => p.datum)).toEqual([GROUND + 3, GROUND + 6]);
	expect(elements(house, 'room')).toHaveLength(0);
	// The mast and one slender hem post per corner are all that stands on the ground.
	expect(house.nodes.filter((n) => n.founded)).toHaveLength(5);
	expect(house.skins.map((s) => s.slot)).toEqual(['shell', 'shell', 'shell', 'shell']);
	for (const cloth of house.skins) {
		const { boundary, edges } = skinFrame(house, cloth.id);
		expect(boundary.map((p) => p[2])).toEqual([0.4, 0.4, 11.2, 11.2].map((h) => GROUND + h));
		expect(reach(boundary[3])).toBeGreaterThan(reach(boundary[0]) + 2);
		expect(edges).toEqual(['cable', 'seam', 'cable', 'seam']);
	}
	expect(house.roof).toBeUndefined();
	expect(elements(house, 'tie')).toHaveLength(4);
});

test('a free-standing mast holds one high lookout in a cone of cloth that lifts over the way in', () => {
	const walk = { from: [6, 5] as [number, number], to: [6, 0.55] as [number, number], width: 1.25 };
	const house = tentMastHouse(plot, { height: 13, lookout: 8, walk });
	expect(checkHouseStructure(house)).toEqual([]);
	expect(house.platforms.map((p) => p.datum)).toEqual([GROUND + 8]);
	// Nothing but the mast and the ladder stands between the ground and the lookout.
	expect(elements(house, 'room')).toHaveLength(0);
	const hems = house.skins.map((gore) => skinFrame(house, gore.id).boundary.map((p) => p[2]));
	// One gore per face reaches the tip; no cloth rests on the ground, and the walked face lifts.
	expect(hems).toEqual([
		[GROUND + 3, GROUND + 3, GROUND + 13],
		...[1, 2, 3].map(() => [GROUND + 0.4, GROUND + 0.4, GROUND + 13])
	]);
	expect(tentMastHouse(plot, { height: 13, lookout: 8 }).nodes).toHaveLength(
		house.nodes.length - 2
	);
});

test('example 3: an exoskeleton hangs platforms at two datums inside a lantern of cushions', () => {
	const house = exoskeletonHouse(plot, { height: 12, datums: [4, 8] });
	expect(checkHouseStructure(house)).toEqual([]);
	expect(house.platforms.map((p) => p.datum)).toEqual([GROUND + 4, GROUND + 8]);
	expect(house.platforms.map((p) => Boolean(p.room))).toEqual([true, false]);
	const posts = house.nodes.filter((n) => n.founded).map((n) => n.position);
	for (const platform of house.platforms)
		for (const [i, corner] of platform.outline.entries())
			expect(reach(corner)).toBeLessThan(reach(posts[i]) - 1);
	expect(house.skins).toHaveLength(4);
	for (const cushion of house.skins) {
		const { boundary } = skinFrame(house, cushion.id);
		// Inflated cloth from the hem to a head ring half as wide as the parcel.
		expect(cushion.slot).toBe('shell');
		expect(cushion.membrane?.pressure).toBeGreaterThan(0);
		expect(boundary.map((p) => p[2])).toEqual([0.4, 0.4, 12, 12].map((h) => GROUND + h));
		expect(reach(boundary[3])).toBeLessThan(0.6 * reach(boundary[0]));
	}
});

test('example 4: a fanned truss winds one cloth per face up to a turned crown', () => {
	const house = fannedTrussHouse(plot, { datums: [3, 6], height: 11 });
	expect(checkHouseStructure(house)).toEqual([]);
	expect(house.roof).toBeUndefined();
	expect(house.platforms).toHaveLength(2);
	expect(house.skins).toHaveLength(4);
	for (const sail of house.skins) {
		const { boundary } = skinFrame(house, sail.id);
		expect(boundary.map((p) => p[2])).toEqual([0.4, 0.4, 11, 11].map((h) => GROUND + h));
		// The crown is small and turned half a face step against the hem below it.
		expect(reach(boundary[3])).toBeLessThan(0.35 * reach(boundary[0]));
		const angle = (p: number[]) => Math.atan2(p[1] - 5, p[0] - 6);
		const turn = (angle(boundary[3]) - angle(boundary[0]) + 2 * Math.PI) % (2 * Math.PI);
		expect(turn).toBeGreaterThan(0.5);
		expect(turn).toBeLessThan(1.1);
	}
	// Under every deck four struts fan from the collar below.
	expect(house.rods.filter((r) => r.id.endsWith('/fan'))).toHaveLength(8);
});

test('example 5: a scaffold occupies only the datums it is told to', () => {
	const house = scaffoldHouse(plot, { bay: 3, bays: 5, occupied: [2, 4], rooms: [4] });
	expect(checkHouseStructure(house)).toEqual([]);
	expect(house.principle).toBe('scaffold');
	expect(house.platforms.map((p) => p.datum)).toEqual([GROUND + 6, GROUND + 12]);
	expect(house.platforms.map((p) => Boolean(p.room))).toEqual([false, true]);
	expect(house.roof).toBeUndefined();
	const tower = scaffoldHouse(plot, { bay: 3, bays: 12, occupied: [4, 8, 12], rooms: [] });
	expect(tower.principle).toBe('tower');
	expect(tower.roof).toEqual({ kind: 'terrace', platform: 'plot/level/12' });
	expect(checkHouseStructure(tower)).toEqual([]);
});

test('every painted house states a buildable structure on its own parcel', () => {
	for (const span of [4.5, 10])
		for (const storeys of [1, 3, 8, 16])
			for (const seed of [1, 7, 23, 41])
				expect(checkHouseStructure(composeHouse(painted(storeys, seed, span)).structure)).toEqual(
					[]
				);
	const sites = squareGrid(8, 1, 10).cells.map((cell, i) => ({
		cells: [cell],
		seed: 28,
		stacks: new Map([[cell.id, Array<HouseUse>(i + 2).fill('living')]])
	}));
	const context = planEnsemble(sites);
	for (const site of sites) {
		const { structure, levels, accessSide } = composeHouse(site, context);
		expect(checkHouseStructure(structure)).toEqual([]);
		// The threshold is a movement port on the access face at entrance floor level.
		const port = houseThreshold(structure);
		if (!port) throw new Error('Missing threshold');
		expect(port.id).toBe(structure.id + '/threshold');
		expect(port.kind).toBe('entrance');
		expect(port.position[2]).toBe(levels[0].landing[2]);
		expect(port.heading).toBe(((accessSide === 'north' ? 1 : -1) * Math.PI) / 2);
		expect(port.width).toBeGreaterThan(1);
		expect(port.headroom).toBeGreaterThan(2);
		expect(structure.ensemble).toBe(sites[0].cells[0].id);
	}
});

test('free-standing painted houses take every principle and draw no solid storeys', () => {
	const seen = new Set<string>();
	let lookouts = 0;
	for (let seed = 1; seed <= 40; seed++) {
		const section = planHouse(painted(3, seed));
		const { structure } = section.composition;
		seen.add(structure.principle);
		if (structure.principle === 'layers') continue;
		const parts = sectionParts(section);
		expect(parts.some((p) => p.id.includes('/body/'))).toBe(false);
		expect(parts.some((p) => p.kind === 'mesh' && p.buildingSurface)).toBe(true);
		// Every platform lies on a storey datum the stair serves, and the highest is the roof datum.
		const served = [...section.decks.map((d) => d.position[2]), section.top];
		const datums = structure.platforms.map((p) => p.datum);
		expect(datums.every((z) => served.includes(z))).toBe(true);
		expect(datums[datums.length - 1]).toBe(section.top);
		expect(checkHouseStructure(structure)).toEqual([]);
		lookouts += Number(datums.length === 1);
		expect(parts.every((p) => bounds(p).max.every(Number.isFinite))).toBe(true);
	}
	expect(seen).toEqual(new Set(['layers', 'mast', 'fanned-truss', 'exoskeleton']));
	expect(lookouts).toBeGreaterThan(0);
});

test('a tie carries only what hangs below a supported node', () => {
	const base = mastHouse(plot, { height: 12, datums: [] });
	const head = base.nodes.find((n) => n.position[2] === GROUND + 12);
	if (!head) throw new Error('Missing mast head');
	const hung: HouseStructure = {
		...base,
		nodes: [
			...base.nodes,
			{ id: 'pod', position: [6, 5, GROUND + 7] },
			{ id: 'kite', position: [6, 5, GROUND + 15] }
		],
		rods: [
			...base.rods,
			{ id: 'hanger', from: head.id, to: 'pod', radius: 0.02, action: 'tie' },
			{ id: 'string', from: head.id, to: 'kite', radius: 0.02, action: 'tie' }
		]
	};
	const supported = supportedNodes(hung);
	expect(supported.has('pod')).toBe(true);
	expect(supported.has('kite')).toBe(false);
	expect(checkHouseStructure(hung)).toEqual([{ rule: 'no-load-path', subject: 'kite' }]);
});

test('each broken invariant is reported by its rule', () => {
	const house = exoskeletonHouse(plot, { height: 12, datums: [4, 8] });
	const floating = { ...house, nodes: house.nodes.map(({ id, position }) => ({ id, position })) };
	expect(new Set(rules(floating))).toEqual(
		new Set(['no-load-path', 'loose-grip', 'unborne-platform'])
	);
	expect(rules({ ...house, access: house.access.slice(0, 1) })).toEqual(['unreached-platform']);
	const lifted = house.access.map((way) => ({ ...way, head: [way.head[0], way.head[1], 0] }));
	expect(rules({ ...house, access: lifted as HouseStructure['access'] })).toEqual([
		'access-off-datum',
		'access-off-datum'
	]);
	const wide = house.platforms.map((p) => ({ ...p, outline: plot.parcel.polygon.map(grow) }));
	expect(rules({ ...house, platforms: wide })).toEqual(['outside-parcel', 'outside-parcel']);
	const open = house.skins.map((skin) => ({ ...skin, boundary: skin.boundary.slice(0, 2) }));
	expect(new Set(rules({ ...house, skins: open }))).toEqual(new Set(['open-skin']));
	expect(rules({ ...house, roof: { kind: 'skin', patches: ['none'] } })).toEqual([
		'unknown-reference'
	]);
});
function grow([x, y]: [number, number]): [number, number] {
	return [6 + (x - 6) * 1.2, 5 + (y - 5) * 1.2];
}

test('one engine draws every principle from registry stock in role slots', () => {
	const houses = [
		mastHouse(plot, { height: 12, datums: [3, 6] }),
		exoskeletonHouse(plot, { height: 12, datums: [4, 8] }),
		fannedTrussHouse(plot, { datums: [3, 6], height: 11 }),
		scaffoldHouse(plot, { bay: 3, bays: 5, occupied: [2, 4], rooms: [4] })
	];
	for (const house of houses) {
		const neutral = structureParts(house);
		const parts = structureHouse(house);
		expect(parts.map((p) => p.id)).toEqual(neutral.map((p) => p.id));
		expect(neutral.every((p) => p.surface.ensemble === 'court')).toBe(true);
		for (const [i, part] of parts.entries()) {
			const way = neutral[i].element === 'access';
			expect(part.source.objectId.length).toBeGreaterThan(0);
			// The access colour is reserved for ways; everything else is coloured by its slot.
			expect(part.token === houseSurfaces.access.token).toBe(way);
			expect(part.buildingSurface).toEqual(way ? undefined : neutral[i].surface);
			if (part.kind !== 'mesh') continue;
			// The tensioned cloth is finer than the straight fan and stays finite.
			expect(part.points.length).toBeGreaterThan(house.nodes.length);
			expect(part.points.flat().every(Number.isFinite)).toBe(true);
		}
	}
});
