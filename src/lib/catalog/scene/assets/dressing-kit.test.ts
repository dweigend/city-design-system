import { expect, test } from 'bun:test';
import { Box3, Vector3 } from 'three/webgpu';
import { assetRegistry, buildObject } from '../../logic/assets';
import { build } from '../primitive-geometry';

const groups = { 'street-life-': 116, 'kit-': 144, 'person-': 40 };
const seeds = [0, 1, 17, 2147483648, 4294967295];
const override = { finish: 'holz-natur', token: '--signal' } as const;

function projectedBounds(part: ReturnType<typeof buildObject>['parts'][number], reservation: Box3) {
	if (part.kind === 'polyline') throw new Error('Expected a solid');
	const { geometry, position, rotation } = build(part);
	geometry.rotateY(rotation).translate(position.x, position.y, position.z);
	geometry.computeBoundingBox();
	const box = geometry.boundingBox;
	if (!box || !reservation.containsBox(box))
		throw new Error([part.id, JSON.stringify(box)].join(' '));

	geometry.dispose();
	return box;
}

test('a 2.5 m capsule seats between the cradle cheeks', () => {
	const cabin = buildObject('kit-capsule-door-5m', 'round-shoulder', 17);
	const cradle = buildObject('kit-capsule-cradle-5m', 'standard', 17);
	const bed = cradle.geometry.find((p) => p.kind === 'prism');
	const cheeks = cradle.geometry.filter((p) => p.kind === 'box');
	expect(cheeks).toHaveLength(2);
	expect(cheeks[1].position[1] - cheeks[0].position[1] - cheeks[0].size[1]).toBeCloseTo(
		cabin.footprint[1]
	);
	expect(cheeks[0].position[2]).toBeCloseTo(bed?.height ?? NaN);
});

test('a three-bay rack keeps 5 m column centres and a 4 m deck bearing', () => {
	const rack = buildObject('kit-rack-bay-15m', 'standard', 17);
	const uprights = rack.geometry.filter(
		(p) => p.kind === 'box' && p.size[2] > 2 && p.position[1] < 0
	);
	expect(uprights.map((p) => p.kind === 'box' && p.position[0] + p.size[0] / 2)).toEqual([
		-7.5, -2.5, 2.5, 7.5
	]);
	const beam = rack.geometry.find((p) => p.kind === 'box' && p.position[2] === 3.7);
	expect(beam && beam.kind === 'box' && beam.position[2] + beam.size[2]).toBe(4);
});

type Entry = (typeof assetRegistry)[number];
type Asset = ReturnType<typeof buildObject>;
function checkReservation(entry: Entry) {
	const [w, d] = entry.footprint;
	expect(w % 1.25).toBe(0);
	expect(d % 1.25).toBe(0);
	const variants = entry.variants.map((v) => JSON.stringify(buildObject(entry.id, v, 0).geometry));
	expect(new Set(variants).size).toBe(3);
	return new Box3(
		new Vector3(-w / 2 - 0.02, -0.00001, -d / 2 - 0.02),
		new Vector3(w / 2 + 0.02, Infinity, d / 2 + 0.02)
	);
}
function checkAsset(entry: Entry, variant: string, seed: number) {
	const base = buildObject(entry.id, variant, seed);
	expect(base.anchors).toEqual([{ attachment: 'deck', position: [0, 0, 0], normal: [0, 0, 1] }]);
	expect(base).toEqual(buildObject(entry.id, variant, seed));
	expect(base.parts.length).toBeGreaterThan(0);
	expect(base.parts.length).toBeLessThanOrEqual(25);
	expect(JSON.stringify(base.geometry)).not.toContain('null');
	return base;
}
function checkProjection(
	entry: Entry,
	variant: string,
	base: Asset,
	reservation: Box3,
	used: Set<string>,
	prefix: string
) {
	const bounds = new Box3();
	for (const [i, part] of base.parts.entries()) {
		const member = base.geometry[i];
		used.add(member.slot);
		expect(entry.slotNames).toContain(member.slot);
		expect(entry.slotDefaults[variant][member.slot]).toBeDefined();
		for (const field of ['token', 'finish', 'material', 'topToken', 'overprint', 'printBand'])
			expect(member).not.toHaveProperty(field);
		bounds.union(projectedBounds(part, reservation));
	}
	expect(Math.abs(bounds.min.y)).toBeLessThan(0.02);
	if (prefix === 'person-') {
		expect(bounds.max.y).toBeGreaterThanOrEqual(1.05);
		expect(bounds.max.y).toBeLessThanOrEqual(1.85);
	}
}
function checkDressing(entry: Entry, variant: string, seed: number, base: Asset) {
	for (const slot of entry.slotNames) {
		const dressed = buildObject(entry.id, variant, seed, { slots: { [slot]: override } });
		expect(dressed.geometry).toEqual(base.geometry);
		for (const [i, part] of dressed.parts.entries()) {
			const expected =
				base.geometry[i].slot === slot
					? { ...base.parts[i], ...override, material: 'wood' as const }
					: base.parts[i];
			expect(part).toEqual(expected);
		}
	}
}
for (const [prefix, count] of Object.entries(groups)) {
	const entries = assetRegistry.filter((entry) => entry.id.startsWith(prefix));
	test(prefix + ' registry inventory', () => expect(entries).toHaveLength(count));
	for (const entry of entries)
		test(entry.id + ' builds and dresses within its reservation', () => {
			const reservation = checkReservation(entry);
			const used = new Set<string>();
			for (const variant of entry.variants)
				for (const seed of seeds) {
					const base = checkAsset(entry, variant, seed);
					checkProjection(entry, variant, base, reservation, used, prefix);
					checkDressing(entry, variant, seed, base);
				}
			expect([...used].sort()).toEqual([...entry.slotNames].sort());
		});
}
