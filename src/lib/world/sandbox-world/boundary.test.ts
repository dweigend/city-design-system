import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import { bounds } from '../../core/object';
import type { PlaceableObject } from '../../core/object';
import { equalRefs, type Ref } from '../../core/ref';
import { boundaryExample } from './example';

function readCrownRings(object: PlaceableObject) {
	const { shape } = required(
		object.parts.find(({ slot }) => slot === 'canopy'),
		'crown mesh'
	);
	if (shape.kind !== 'mesh') throw new Error('Expected triangulated crowns');
	const rings = [];
	for (let start = 0; start < shape.positions.length; start += 18)
		rings.push(
			[0, 3, 6, 9].map((offset) => shape.positions.slice(start + offset, start + offset + 2))
		);
	return rings;
}

test('plan and spatial consumers reopen the same addressed sandbox/3 exchange', () => {
	const fixture = boundaryExample();
	const exchange = fixture.readExchange();
	const wire = JSON.stringify(exchange);
	const replay = () => JSON.parse(wire) as typeof exchange;
	expect(replay()).toEqual(exchange);
	expect(JSON.parse(exchange.document).format).toBe('sandbox/3');
	expect(new Set(exchange.refs.map(({ kind }) => kind))).toEqual(
		new Set(['parcel', 'placement', 'storey', 'house-part', 'lane', 'bridge', 'rail', 'ground'])
	);
	expect(new Set(exchange.refs.map((ref) => JSON.stringify(ref))).size).toBe(exchange.refs.length);
	const plan = fixture.readPlan(replay());
	const spatial = fixture.readSpatial(replay());
	expect(plan).toEqual(fixture.readPlan(exchange));
	expect(spatial).toEqual(fixture.readSpatial(exchange));
	for (const [i, row] of plan.entries()) {
		expect(row.ref).toEqual(exchange.refs[i]);
		expect(row.ref).toEqual(spatial[i].ref);
		expect<unknown>(row.geometry).toEqual(spatial[i].geometry);
		expect(row.span).toEqual(spatial[i].span);
	}
	const storeys = exchange.refs.filter(({ kind }) => kind === 'storey');
	for (const { key } of storeys) {
		const [, , anchor, datumIndex] = JSON.parse(key) as [string, string, string, number];
		expect(anchor).toBe('d');
		expect(Number.isSafeInteger(datumIndex)).toBe(true);
	}
	const parts = spatial.filter(({ ref }) => ref.kind === 'house-part');
	expect(parts.length).toBeGreaterThanOrEqual(4);
	expect(
		new Set(spatial.flatMap(({ geometry }) => ('assetId' in geometry ? [geometry.assetId] : [])))
	).toEqual(new Set(['house/court-neutral', 'park/grove']));
	for (const { geometry, span } of parts) {
		if (!('storeyRefs' in geometry)) throw new Error('Expected a part address');
		for (const storey of geometry.storeyRefs)
			expect(storeys.some((ref) => equalRefs(ref, storey))).toBe(true);
		const metric = required(span, 'part span');
		expect(metric.topZ).toBeGreaterThan(metric.bottomZ);
		expect(metric.footprints).toHaveLength(geometry.storeyRefs.length);
	}

	fixture.growGrove();
	const edited = JSON.parse(
		JSON.stringify({ ...fixture.readExchange(), refs: replay().refs })
	) as typeof exchange;
	const planAfter = fixture.readPlan(edited);
	const spatialAfter = fixture.readSpatial(edited);
	const groveAfter = required(
		spatialAfter.find(({ ref }) => equalRefs(ref, fixture.grove))?.object,
		'edited grove'
	);
	const groveBefore = required(
		spatial.find(({ ref }) => equalRefs(ref, fixture.grove))?.object,
		'original grove'
	);
	expect(bounds(groveAfter).max[2]).toBeGreaterThan(bounds(groveBefore).max[2]);
	const canopies = (rows: typeof plan) =>
		rows.find(({ ref }) => equalRefs(ref, fixture.grove))?.canopies;
	expect(canopies(plan)).toEqual(readCrownRings(groveBefore));
	expect(canopies(planAfter)).toEqual(readCrownRings(groveAfter));
	expect(canopies(planAfter)).not.toEqual(canopies(plan));
	const children: readonly Ref[] = exchange.refs.filter(
		({ kind }) => kind === 'storey' || kind === 'house-part'
	);
	for (const neighbor of [fixture.house, fixture.peer, ...children]) {
		expect(planAfter.find(({ ref }) => equalRefs(ref, neighbor))).toEqual(
			plan.find(({ ref }) => equalRefs(ref, neighbor))
		);
		expect(spatialAfter.find(({ ref }) => equalRefs(ref, neighbor))).toEqual(
			spatial.find(({ ref }) => equalRefs(ref, neighbor))
		);
	}
}, 30_000);
