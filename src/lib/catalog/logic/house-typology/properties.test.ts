import { checkParcel } from '../composed-house/parcel-assertions.test-support';
import { shellSystems } from '../../data/house-shells';
import { required } from '../required';
import { test, expect } from 'bun:test';
import { squareGrid, ringArea } from '../quad-grid';
import { planHouse, sectionParts, circulation, type HouseSite } from '../composed-house';
import type { HouseSlot } from './index';
import { bounds } from '../ansicht/geometrie';
import { accessShare } from '../composed-house/access-budget';
import type { HouseUse } from '../../data/house-body';
import { composeHouse, planBridges, planEnsemble, checkFit, type HouseComposition } from './index';
const grids = [squareGrid(3, 3, 10), squareGrid(1, 9, 10), squareGrid(9, 1, 10)];
const uses: HouseUse[] = ['living', 'water', 'energy', 'food', 'material'];
const districts = ['bank', 'slope', 'infill'] as const;
function site(
	seed: number,
	n: number,
	h: number,
	district: HouseSite['district'],
	mix: number
): HouseSite {
	const cells = grids[seed % grids.length].cells.slice(0, n);
	return {
		seed,
		cells,
		district,
		stacks: new Map(
			cells.map((c, k) => [
				c.id,
				Array.from({ length: h }, (_, i) =>
					mix === 0 ? 'living' : uses[(mix === 1 ? seed + i + k : seed) % uses.length]
				)
			])
		)
	};
}
const vol = (s: number[]) => s.reduce((v, d) => v * d, 1);
function audit(h: HouseComposition) {
	const shell = h.exterior;
	if (
		!shell ||
		shell.bottom !== h.ground ||
		shell.top !== h.crown.position[2] ||
		shell.stations.length !== h.levels.length + 1
	)
		return 'exterior datums';
	const area = (polygon: [number, number][]) => Math.abs(ringArea(polygon));
	const plot = h.cells.reduce((sum, c) => sum + area(c.corners.map(([x, y]) => [x, y])), 0);
	const foot = h.levels[0].outline.map(([x, y]): [number, number] => [x, y]);
	if (Math.abs(area(foot) - plot) > 1e-6 && h.ensembleSize === 1) return 'occupied parcel foot';
	for (const [i, l] of h.levels.entries()) {
		if (
			l.position[2] >= shell.stations[i + 1].z ||
			l.landing[2] !== l.position[2] ||
			l.deckArea <= 0
		)
			return 'occupied level';
		if (!l.bodies.some((b) => b.position[2] === l.position[2])) return 'unsupported level';
		for (const b of l.bodies) {
			const band = b.band;
			if (
				!band?.footprint ||
				!band.lining ||
				b.position[2] < l.position[2] ||
				b.position[2] + b.size[2] > shell.stations[i + 1].z + 1e-7 ||
				b.size[2] <= 0
			)
				return 'occupied contour';
			if (area(band.lining) > area(band.footprint.polygon) + 1e-7)
				return 'lining beyond bearing outline';
		}
	}
	if (h.people.some((p) => p.count !== 1 && p.count !== 2) || h.crown.anchor !== 'roof')
		return 'occupation';
	const base = h.parts.find((p) => p.slot === 'base');
	if (
		base?.kind !== 'prism' ||
		Math.abs(base.z - h.ground) > 1e-7 ||
		base.height < 0.6 - 1e-7 ||
		base.height > 1.2
	)
		return 'ground bearing';
	const finding = checkFit(h.parts)[0];
	if (finding) return JSON.stringify(finding);
}
function* paintedSites() {
	for (let seed = 0; seed < 32; seed++)
		for (let n = 1; n <= 9; n++)
			for (let h = 1; h <= 10; h++)
				for (const district of districts)
					for (let mix = 0; mix < 3; mix++) yield [seed, n, h, district, mix] as const;
}
test('mass, deck coverage, joints and finite coordinates across painted sites', () => {
	const counts = new Map<string, number>(),
		failures = new Map<string, string>();
	let cases = 0;
	for (const [seed, n, h, district, mix] of paintedSites()) {
		const input = site(seed, n, h, district, mix);
		if (mix === 2) input.envelope = { system: shellSystems[(seed + n + h) % shellSystems.length] };
		let result: HouseComposition;
		try {
			result = composeHouse(input);
		} catch (error) {
			const type = [...planEnsemble([input]).houses.values()][0].typology;
			if (!failures.has(type))
				failures.set(type, [seed, n, h, district, mix, String(error)].join(' '));
			continue;
		}
		const error = audit(result);
		if (error && !failures.has(result.typology))
			failures.set(result.typology, [seed, n, h, district, mix, error].join(' '));
		const system = required(result.exterior, 'exterior').system;
		counts.set(system, (counts.get(system) ?? 0) + 1);
		cases++;
	}
	console.info('Surveyed houses', cases, Object.fromEntries([...counts].sort()));
	expect(Object.fromEntries(failures)).toEqual({});
	expect(cases).toBe(25920);
	expect([...counts.keys()].sort()).toEqual([...shellSystems].sort());
}, 180000);
test('128 ensembles retain their roles, palette and direct level spans under input permutation', () => {
	const cells = squareGrid(4, 2, 10).cells;
	for (let seed = 0; seed < 128; seed++) {
		const sites = cells.map((c, i) => ({
			...site(seed, 1, 4, districts[i % 3], 1),
			cells: [c],
			stacks: new Map([[c.id, Array.from({ length: 2 + i }, (_, k) => uses[(k + i) % 5])]])
		}));
		const context = planEnsemble(sites),
			houses = sites.map((s) => composeHouse(s, context));
		const high = required(
			houses.find((h) => h.role === 'high'),
			'ensemble house'
		);
		const top = (h: HouseComposition) => h.crown.position[2] + h.crown.size[2];
		expect(houses.filter((h) => h !== high).every((h) => top(h) < top(high))).toBe(true);
		expect(context).toEqual(planEnsemble([...sites].reverse()));
		expect(houses[0]).toEqual(composeHouse(sites[0], context));
		for (const h of houses) expect(audit(h)).toBeUndefined();
		expect(new Set(houses.map((h) => h.exterior?.system))).toEqual(
			new Set([context.leadingSystem])
		);
		expect(houses.every((h) => h.shellUse === context.shellUse)).toBe(true);
		const bridges = planBridges(houses);
		expect(bridges.length).toBeGreaterThanOrEqual(7);
		expect(bridges.length).toBeLessThanOrEqual(8);
		for (const h of houses)
			expect(bridges.filter((b) => b.a === h.id || b.b === h.id).length).toBeLessThanOrEqual(2);
		for (const b of bridges) {
			const a = required(
					houses.find((h) => h.id === b.a),
					'ensemble house'
				),
				other = required(
					houses.find((h) => h.id === b.b),
					'ensemble house'
				);
			expect(a.cells[0].neighbors).toContain(other.cells[0].id);
			expect(b.span).toBeLessThanOrEqual(b.pier ? 20 : 12);
			expect(b.from[2]).toEqual(b.to[2]);
		}
	}
});
test('new seeds can change the fixed house and part decisions', () => {
	const a = site(1, 2, 4, 'bank', 0);
	expect(
		new Set(
			Array.from({ length: 20 }, (_, seed) => JSON.stringify(composeHouse({ ...a, seed }).levels))
		).size
	).toBeGreaterThan(1);
});

function narrowSite(
	width: number,
	height: number,
	seed: number,
	district: HouseSite['district'],
	mix: number
) {
	const cell = squareGrid(1, 1, width).cells[0];
	const stretch = (p: HouseSlot['position']): HouseSlot['position'] => [
		p[0],
		(p[1] * 3.3) / width,
		p[2]
	];
	const [a, b, c, d] = cell.corners.map(stretch);
	const plot = { ...cell, corners: [a, b, c, d] as const };
	const input = {
		cells: [plot],
		stacks: new Map([
			[
				plot.id,
				Array.from({ length: height }, (_, i) =>
					mix === 0 ? ('living' as const) : uses[(seed + (mix === 1 ? i : 0)) % uses.length]
				)
			]
		]),
		district,
		seed
	};
	return input;
}
function auditNarrow(input: HouseSite) {
	const house = planHouse(input),
		h = house.composition,
		route = circulation(house);

	expect(checkFit(h.parts)).toEqual([]);
	expect(audit(h)).toBeUndefined();
	const body = h.levels.flatMap((l) => l.bodies).reduce((sum, b) => sum + vol(b.size), 0);
	expect(body / h.parts.reduce((sum, p) => sum + vol(p.size), 0)).toBeGreaterThanOrEqual(0.55);
	const parts = sectionParts(house);
	checkParcel(house, parts);
	expect(h.typology).toBe('block');
	expect(h.levels.length).toBe(
		required(input.stacks.get(input.cells[0].id), 'painted levels').length
	);
	const foundation = h.parts.find((p) => p.id.endsWith('/plinth'));
	expect(foundation?.kind).toBe('prism');
	expect(foundation?.size[2]).toBeGreaterThanOrEqual(0.6);
	expect(foundation?.size[2]).toBeLessThanOrEqual(1.2);
	expect(h.levels[0].position[2]).toBeCloseTo(h.ground + (foundation?.size[2] ?? 0));
	expect(h.levels.every((l) => l.bodies.every((b) => b.band?.footprint && b.band.lining))).toBe(
		true
	);
	expect(accessShare(parts)).toBeLessThanOrEqual(0.1);
	expect(parts.every((p) => bounds(p).max.every(Number.isFinite))).toBe(true);
	expect(route.docks.slice(1).map((d) => d.door)).toEqual(
		[...h.levels].reverse().map((l) => l.landing)
	);
	expect(
		route.legs.every(
			(leg, i) => !i || leg.from.every((v, k) => Math.abs(v - route.legs[i - 1].to[k]) < 1e-7)
		)
	).toBe(true);
	for (const [i, p] of h.people.entries()) {
		const feet = parts.filter((part) => part.id.startsWith(h.id + '/people/' + i + '/'));
		const level = h.levels[p.level] ?? {
			position: [h.bay.x, h.bay.y, h.crown.position[2]],
			width: h.bay.width,
			depth: h.bay.depth
		};
		expect(Math.min(...feet.map((f) => bounds(f).min[2]))).toBeCloseTo(level.position[2]);
		expect(Math.abs(p.position[0] - level.position[0])).toBeLessThanOrEqual(level.width / 2);
		expect(Math.abs(p.position[1] - level.position[1])).toBeLessThanOrEqual(level.depth / 2);
	}
	return h.typology;
}
test('1,350 narrow painted houses keep their block, access route and people on the surveyed assembly', () => {
	const counts = new Map<string, number>();
	const bays = [1.8, 2.5, 3, 4, 5].flatMap((width) =>
		Array.from({ length: 10 }, (_, i) => ({ width, height: i + 1 }))
	);
	for (const { width, height } of bays)
		for (const seed of [2, 7, 19])
			for (const { district, mix } of districts.flatMap((district) =>
				[0, 1, 2].map((mix) => ({ district, mix }))
			)) {
				const input = narrowSite(width, height, seed, district, mix);
				const type = auditNarrow(input);
				counts.set(type, (counts.get(type) ?? 0) + 1);
				if (height === 1 && seed === 2) expect(planHouse(input)).toEqual(planHouse(input));
			}
	console.info('Narrow houses', Object.fromEntries(counts));
}, 120000);
