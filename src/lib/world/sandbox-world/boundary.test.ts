import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import { bounds } from '../../core/object';
import { equalRefs } from '../../core/ref';
import { boundaryExample } from './example';

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
		expect(row.geometry).toEqual(spatial[i].geometry);
		const object = spatial[i].object;
		if (object) {
			const { min, max } = bounds(object);
			expect(row.extent).toEqual([min.slice(0, 2), max.slice(0, 2)]);
			expect(row.topZ).toBe(max[2]);
		}
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
	for (const { geometry } of parts) {
		if (!('storeyRefs' in geometry)) throw new Error('Expected a part address');
		for (const storey of geometry.storeyRefs)
			expect(storeys.some((ref) => equalRefs(ref, storey))).toBe(true);
	}

	fixture.growGrove();
	const edited = JSON.parse(JSON.stringify(fixture.readExchange())) as typeof exchange;
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
	expect(planAfter.find(({ ref }) => equalRefs(ref, fixture.grove))?.topZ).toBe(
		bounds(groveAfter).max[2]
	);
	expect(planAfter.find(({ ref }) => equalRefs(ref, fixture.grove))?.parts).not.toEqual(
		plan.find(({ ref }) => equalRefs(ref, fixture.grove))?.parts
	);
	const editedStoreys = edited.refs.filter(({ kind }) => kind === 'storey');
	expect(editedStoreys).toEqual(storeys);
	for (const neighbor of [fixture.house, fixture.peer]) {
		expect(planAfter.find(({ ref }) => equalRefs(ref, neighbor))).toEqual(
			plan.find(({ ref }) => equalRefs(ref, neighbor))
		);
		expect(spatialAfter.find(({ ref }) => equalRefs(ref, neighbor))).toEqual(
			spatial.find(({ ref }) => equalRefs(ref, neighbor))
		);
	}
}, 30_000);
