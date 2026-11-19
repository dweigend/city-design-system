import { test, expect } from 'bun:test';
import { squareGrid } from '../quad-grid';
import type { HouseSite } from '../composed-house';
import type { HouseUse } from '../../data/house-body';
import {
	composeHouse,
	planBridges,
	planEnsemble,
	checkFit,
	typologies,
	type HouseComposition
} from './index';
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
					mix === 0 ? 'living' : uses[(seed + i + k) % uses.length]
				)
			])
		)
	};
}
const vol = (s: number[]) => s.reduce((v, d) => v * d, 1);
function audit(h: HouseComposition) {
	for (const l of h.levels) {
		const share = l.bodies.reduce((sum, b) => sum + b.size[0] * b.size[1], 0) / l.deckArea;
		if (!(share >= 0.55 && share <= 0.85))
			return 'deck share ' + share + ' ' + l.bodies.map((b) => b.objectId);
		if ((l.position[2] - h.datum) % 2 !== 0) return 'off datum';
	}
	const bodies = h.levels.flatMap((l) => l.bodies);
	const volume = bodies.reduce((sum, b) => sum + vol(b.size), 0);
	const total = h.parts.reduce((sum, p) => sum + vol(p.size), 0);
	if (!(volume / total >= 0.55)) return 'body share ' + volume / total;
	const structure =
		h.parts
			.filter((p) => !['body', 'capsule', 'crown'].includes(p.joint))
			.reduce((s, p) => s + vol(p.size), 0) / total;
	if (structure < 0.2 || structure > 0.35) return 'structure share ' + structure;
	if (h.levels.at(-1)!.position[2] - h.ground > 8 && !h.supports.some((p) => p.joint === 'brace'))
		return 'missing brace';
	const finding = checkFit(h.parts)[0];
	if (finding) return JSON.stringify(finding);
	if (h.levels.length >= 3 && h.levels.every((l) => l.programme.every((u) => u === 'living'))) {
		const capsules = bodies.filter((b) => b.kind === 'capsule');
		if (capsules.length < 2 || capsules[0].size[1] + capsules[1].size[1] <= h.core.width)
			return 'capsule stack';
	}
}
test('mass, deck coverage, joints and finite coordinates across painted sites', () => {
	const counts = new Map<string, number>(),
		failures = new Map<string, string>();
	let cases = 0;
	for (let seed = 0; seed < 32; seed++)
		for (let n = 1; n <= 9; n++)
			for (let h = 1; h <= 10; h++)
				for (const district of districts)
					for (let mix = 0; mix < 2; mix++) {
						const result = composeHouse(site(seed, n, h, district, mix));
						const error = audit(result);
						if (error && !failures.has(result.typology))
							failures.set(result.typology, [seed, n, h, district, mix, error].join(' '));
						counts.set(result.typology, (counts.get(result.typology) ?? 0) + 1);
						cases++;
					}
	console.info('Surveyed houses', cases, Object.fromEntries([...counts].sort()));
	expect(Object.fromEntries(failures)).toEqual({});
	expect([...counts.keys()].sort()).toEqual([...typologies].sort());
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
		const high = houses.find((h) => h.role === 'high')!;
		const top = (h: HouseComposition) => h.crown.position[2] + h.crown.size[2];
		expect(houses.filter((h) => h !== high).every((h) => top(h) < top(high))).toBe(true);
		expect(context).toEqual(planEnsemble([...sites].reverse()));
		expect(houses[0]).toEqual(composeHouse(sites[0], context));
		for (const h of houses) expect(audit(h)).toBeUndefined();
		const counts = new Map<string, number>();
		for (const h of houses) counts.set(h.typology, (counts.get(h.typology) ?? 0) + 1);
		expect([...counts.values()].filter((n) => n > 1)).toHaveLength(2);
		expect(counts.size).toBeLessThanOrEqual(3);
		const bridges = planBridges(houses);
		expect(bridges.length).toBeGreaterThanOrEqual(7);
		expect(bridges.length).toBeLessThanOrEqual(8);
		for (const h of houses)
			expect(bridges.filter((b) => b.a === h.id || b.b === h.id).length).toBeLessThanOrEqual(2);
		for (const b of bridges) {
			const a = houses.find((h) => h.id === b.a)!,
				other = houses.find((h) => h.id === b.b)!;
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
