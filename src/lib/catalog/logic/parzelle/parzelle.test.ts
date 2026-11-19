import { describe, expect, test } from 'bun:test';
import {
	accessOf,
	areaTolerance,
	chronik,
	createBlock,
	DEFAULT_RULES,
	diameter,
	encodeState,
	evolve,
	isPublic,
	parcelArea,
	parcelize,
	points,
	setProtection,
	splitParcel,
	mergeParcels,
	validateState,
	type BlockSpec,
	type Outcome,
	type ParcelState,
	type Point
} from './index';
const rules = DEFAULT_RULES,
	drivers = { split: 0.35, merge: 0.15, convert: 0.2 };
const rectangle: BlockSpec = {
	id: 'block',
	ring: [
		[0, 0],
		[72, 0],
		[72, 48],
		[0, 48]
	],
	edges: Array(4).fill('footway')
};
// A longer stop edge (67 m) prevents colliding miters of the remnants.
// Interior angles stay between 90° and 150°; hence an extent of 110 × 85 m.
const hexagon: BlockSpec = {
	id: 'hex',
	ring: [
		[0, 0],
		[65, 0],
		[110, 50],
		[110, 85],
		[30, 85],
		[0, 55]
	],
	edges: ['square', 'footway', 'skywalk', 'water', 'party', 'green'],
	stops: [{ edge: 1, t: 0.5 }]
};
function value<T>(o: Outcome<T>): T {
	if (!o.ok) throw new Error(`${o.code}: ${o.detail}`);
	return o.value;
}
function valid(s: ParcelState): ParcelState {
	expect(validateState(s)).toEqual([]);
	return s;
}
function genesis(spec = rectangle, seed = 7) {
	const result = value(parcelize(valid(value(createBlock(spec, seed)))));
	valid(result.state);
	return result;
}
function privateRules(s: ParcelState) {
	const access = accessOf(s);
	for (const p of s.parcels.filter((p) => !isPublic(p.use))) {
		expect(access.get(p.id)?.levels.length).toBeGreaterThan(0);
		expect(access.get(p.id)?.front).toBeGreaterThanOrEqual(rules.frontMin);
		expect(parcelArea(s, p.id)).toBeGreaterThanOrEqual(rules.areaMin);
	}
}
describe('Rectangular block 72 × 48 m, alleys all around', () => {
	test('subdivision, access and seed', () => {
		const { state: s, issues } = genesis();
		expect(issues).toEqual([]);
		expect(s.parcels.filter((p) => p.use === 'commons')).toHaveLength(1);
		expect(s.parcels.some((p) => p.use === 'passage')).toBe(true);
		privateRules(s);
		for (const a of accessOf(s).values()) expect(a.levels).toContain(0);
		expect(encodeState(genesis().state)).toBe(encodeState(s));
		expect(encodeState(genesis(rectangle, 8).state)).not.toBe(encodeState(s));
	});
});
describe('Car-free edge classes', () => {
	test('transit stop, elevated walkway and public waterfront', () => {
		const { state: s, issues } = genesis(hexagon);
		expect(issues).toEqual([]);
		privateRules(s);
		const owns = (id: string, cls: string) => {
			const p = s.parcels.find((p) => p.id === id);
			return p?.ring.some((a, i) =>
				s.boundary.some(
					(e) => e.from === a && e.to === p.ring[(i + 1) % p.ring.length] && e.access === cls
				)
			);
		};
		expect(s.parcels.some((p) => p.use === 'hub' && owns(p.id, 'stop'))).toBe(true);
		expect(s.parcels.some((p) => p.use === 'commons' && owns(p.id, 'water'))).toBe(true);
		// Elevated walkway parcels have access on level 1; via the courtyard they also get level 0.
		// "Level 1 only" is checked by the edge-case test on the pure elevated walkway block.
		const access = accessOf(s),
			skywalk = s.parcels.filter((p) => owns(p.id, 'skywalk'));
		expect(skywalk.length).toBeGreaterThan(0);
		for (const p of skywalk) expect(access.get(p.id)?.levels).toContain(1);
		// Waterfront: only the ends of the neighboring strips touch it (length ≈ strip depth / sin α); the commons hold the rest.
		const shore = (keep: (use: string) => boolean) =>
			s.parcels
				.filter((p) => keep(p.use))
				.flatMap((p) => p.ring.map((a, i) => [a, p.ring[(i + 1) % p.ring.length]]))
				.filter(([a, b]) =>
					s.boundary.some((e) => e.from === a && e.to === b && e.access === 'water')
				)
				.reduce((sum, [a, b]) => {
					const [pa, pb] = points(s, { ring: [a, b] });
					return sum + Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
				}, 0);
		expect(shore((use) => use === 'commons')).toBeGreaterThan(shore((use) => use !== 'commons'));
	});
});
describe('Minimum frontage only on access edges', () => {
	test('the courtyard side gives access but does not count as frontage', () => {
		// An edge parcel is split along the alley: the rear piece lies only on the courtyard.
		const { state: s } = genesis();
		const access = accessOf(s);
		const amHof = s.parcels.filter(
			(p) => !isPublic(p.use) && (access.get(p.id)?.frontage ?? 0) > (access.get(p.id)?.front ?? 0)
		);
		expect(amHof.length).toBeGreaterThan(0);
		// The edge parcel with the longest courtyard side.
		const hof = (id: string) => (access.get(id)?.frontage ?? 0) - (access.get(id)?.front ?? 0);
		const p = amHof
			.filter((p) => (access.get(p.id)?.front ?? 0) > 0)
			.sort((a, b) => hof(b.id) - hof(a.id) || (a.id < b.id ? -1 : 1))[0];
		if (!p) throw new Error('Edge parcel on the courtyard expected');
		const ps = points(s, p),
			// The longest outer edge is the alley frontage; cut parallel to it at half depth.
			edge = ps
				.map((a, i) => [a, ps[(i + 1) % ps.length]] as const)
				.filter(([a, b]) =>
					s.boundary.some((e) => {
						const [pa, pb] = points(s, { ring: [e.from, e.to] });
						return (
							e.access === 'footway' &&
							pa[0] === a[0] &&
							pa[1] === a[1] &&
							pb[0] === b[0] &&
							pb[1] === b[1]
						);
					})
				)
				.sort(
					([a, b], [c, d]) =>
						Math.hypot(d[0] - c[0], d[1] - c[1]) - Math.hypot(b[0] - a[0], b[1] - a[1])
				)[0];
		if (!edge) throw new Error('Alley edge expected');
		const [a, b] = edge,
			cx = ps.reduce((t, q) => t + q[0], 0) / ps.length,
			cy = ps.reduce((t, q) => t + q[1], 0) / ps.length;
		const geteilt = valid(
			value(splitParcel(s, p.id, { point: [cx, cy], direction: [b[0] - a[0], b[1] - a[1]] }))
		);
		const nach = accessOf(geteilt);
		const hinten = [`${p.id}.0`, `${p.id}.1`].find((id) => (nach.get(id)?.front ?? 0) === 0);
		if (!hinten) throw new Error('Rear piece without frontage expected');
		// Reachable via the courtyard, with access length but without frontage: the minimum frontage is violated.
		expect(nach.get(hinten)?.levels).toContain(0);
		expect(nach.get(hinten)?.frontage).toBeGreaterThanOrEqual(rules.frontMin);
		expect(nach.get(hinten)?.front).toBe(0);
	});
	test('after genesis and evolution every private parcel keeps its frontage on access edges', () => {
		let s = genesis(hexagon).state;
		privateRules(s);
		s = valid(value(evolve(genesis().state, rules, drivers, 8)));
		privateRules(s);
		for (const p of s.parcels.filter((p) => !isPublic(p.use))) {
			const a = accessOf(s).get(p.id);
			expect(a?.front).toBeLessThanOrEqual((a?.frontage ?? 0) + 1e-9);
		}
	});
});
describe('Remnant areas are merged', () => {
	test('acute trapezoid with genesis merges', () => {
		const { state: s } = genesis({
			id: 'trapezoid',
			ring: [
				[0, 0],
				[130, 0],
				[65, 50],
				[20, 50]
			],
			edges: Array(4).fill('footway')
		});
		expect(s.log.some((e) => e.kind === 'merge' && e.epoch === 0)).toBe(true);
		privateRules(s);
	});
});
describe('Evolution with existing stock', () => {
	test('eight epochs keep protected rings and provenance', () => {
		let s = genesis().state;
		const ids = s.parcels
			.filter((p) => !isPublic(p.use))
			.slice(0, 3)
			.map((p) => p.id);
		s = valid(value(setProtection(s, ids, true)));
		const before = structuredClone(s),
			roots = new Set(s.parcels.map((p) => p.id));
		const ancestry = new Map<string, string[]>(s.parcels.map((p) => [p.id, p.parents]));
		for (let i = 0; i < 8; i++) {
			const prior = s;
			s = valid(value(evolve(s, rules, drivers, 1)));
			for (const event of s.log.slice(prior.log.length))
				if (event.kind === 'split')
					for (const id of event.resultIds) ancestry.set(id, event.parcelIds);
		}
		for (const kind of ['split', 'merge', 'convert'])
			expect(s.log.some((e) => e.kind === kind)).toBe(true);
		for (const id of ids) {
			const a = before.parcels.find((p) => p.id === id),
				b = s.parcels.find((p) => p.id === id);
			expect(b?.isProtected).toBe(true);
			expect(b?.use).toBe(a?.use);
			if (!a || !b) throw new Error(id);
			expect(b.ring.filter((v) => a.ring.includes(v))).toEqual(a.ring);
			expect(Math.abs(parcelArea(s, id) - parcelArea(before, id))).toBeLessThanOrEqual(
				areaTolerance(parcelArea(before, id))
			);
			const ps = points(before, a),
				tol = 1e-9 * diameter(ps);
			for (const [i, v] of b.ring.entries()) {
				const p = points(s, b)[i];
				if (a.ring.includes(v)) {
					expect(p).toEqual(points(before, { ring: [v] })[0]);
					continue;
				}
				expect(
					ps.some((q, j) => {
						const r = ps[(j + 1) % ps.length],
							dx = r[0] - q[0],
							dy = r[1] - q[1];
						return Math.abs(dx * (p[1] - q[1]) - dy * (p[0] - q[0])) / Math.hypot(dx, dy) <= tol;
					})
				).toBe(true);
			}
		}
		const hasRoot = (id: string, seen = new Set<string>()): boolean => {
			if (roots.has(id)) return true;
			if (seen.has(id)) return false;
			seen.add(id);
			return (ancestry.get(id) ?? []).some((p) => hasRoot(p, seen));
		};
		for (const p of s.parcels) expect(hasRoot(p.id)).toBe(true);
	});
});
describe('Past and future, one operator', () => {
	test('continuation, permutation and identical no-op', () => {
		const s = genesis().state,
			a = valid(value(evolve(s, rules, drivers, 6))),
			b = valid(value(evolve(value(evolve(s, rules, drivers, 3)), rules, drivers, 3)));
		expect(encodeState(a)).toBe(encodeState(b));
		expect(
			encodeState(
				value(
					evolve(
						{ ...s, parcels: [...s.parcels].reverse(), vertices: [...s.vertices].reverse() },
						rules,
						drivers,
						6
					)
				)
			)
		).toBe(encodeState(a));
		expect(value(evolve(s, rules, drivers, 0))).toBe(s);
		valid(value(evolve(a, rules, { split: 0.05, merge: 0.4, convert: 0.3 }, 4)));
	});
});
describe('Edge cases', () => {
	test('a cut splits boundary and protected neighbor edges; merge stays atomic', () => {
		const block = valid(value(createBlock(rectangle, 7))),
			encoded = encodeState(block);
		const first = valid(value(splitParcel(block, 'block', { point: [36, 0], direction: [0, 1] })));
		expect(encodeState(block)).toBe(encoded);
		const protectedState = valid(value(setProtection(first, ['block.0'], true)));
		const second = valid(
			value(splitParcel(protectedState, 'block.1', { point: [0, 24], direction: [1, 0] }))
		);
		expect(second.parcels.find((p) => p.id === 'block.0')?.ring).toContain('block.1#1');
		const merged = valid(value(mergeParcels(first, 'block.0', 'block.1')));
		expect(parcelArea(merged, 'block.0')).toBe(72 * 48);
		const invalid = structuredClone(first);
		invalid.vertices.push({ id: 'orphan', x: 1, y: 1 });
		expect(validateState(invalid).some((i) => i.code === 'orphan-vertex')).toBe(true);
		const skywalk = valid(
			value(createBlock({ ...rectangle, edges: ['skywalk', 'party', 'water', 'party'] }, 7))
		);
		expect(accessOf(skywalk).get('block')?.levels).toEqual([1]);
	});
	test('errors are atomic', () => {
		const narrow = {
			...rectangle,
			ring: [
				[0, 0],
				[100, 0],
				[100, 16],
				[0, 16]
			] as Point[]
		};
		expect(parcelize(value(createBlock(narrow, 7)))).toMatchObject({
			ok: false,
			code: 'skeleton-event'
		});
		expect(createBlock({ ...rectangle, ring: [...rectangle.ring].reverse() }, 7)).toMatchObject({
			ok: false,
			code: 'not-ccw'
		});
		expect(
			parcelize(
				value(createBlock({ ...rectangle, edges: ['party', 'water', 'party', 'water'] }, 7))
			)
		).toMatchObject({ ok: false, code: 'landlocked-block' });
		expect(createBlock(rectangle, 1.5)).toMatchObject({ ok: false, code: 'invalid-seed' });
		const s = value(setProtection(value(createBlock(rectangle, 7)), ['block'], true)),
			encoded = encodeState(s);
		expect(splitParcel(s, 'block', { point: [30, 0], direction: [0, 1] })).toMatchObject({
			ok: false,
			code: 'protected'
		});
		expect(encodeState(s)).toBe(encoded);
		expect(parcelize(s)).toMatchObject({ ok: false, code: 'protected' });
		expect(encodeState(s)).toBe(encoded);
	});
});
describe('Chronicle for the Bible', () => {
	test('founding and three eras: valid, existing stock untouched, frontage on access edges', () => {
		const zeiten = [
			{ schritte: 0 },
			{ schritte: 2, treiber: { split: 0.45, merge: 0.05, convert: 0.1 } },
			{ schritte: 1, treiber: { split: 0.05, merge: 0.4, convert: 0.1 } },
			{ schritte: 1, treiber: { split: 0.1, merge: 0.05, convert: 0.5 } }
		];
		for (const spec of [rectangle, hexagon]) {
			const a = value(chronik(spec, 7, 3, zeiten));
			expect(a).toHaveLength(zeiten.length);
			const bestand = a[0].state.parcels.filter((p) => p.isProtected);
			expect(bestand).toHaveLength(3);
			for (const z of a) {
				valid(z.state);
				privateRules(z.state);
				for (const b of bestand)
					expect(z.state.parcels.find((p) => p.id === b.id)?.isProtected).toBe(true);
				for (const id of z.geaendert)
					expect(z.state.parcels.find((p) => p.id === id)?.isProtected).toBe(false);
			}
			expect(a.slice(1).some((z) => z.geaendert.length > 0)).toBe(true);
			expect(JSON.stringify(value(chronik(spec, 7, 3, zeiten)))).toBe(JSON.stringify(a));
		}
	});
});
