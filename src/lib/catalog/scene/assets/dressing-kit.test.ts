import { expect, test } from 'bun:test';
import { Box3, Vector3 } from 'three/webgpu';
import { assetRegistry, buildObject } from '../../logic/assets';
import { build } from '../primitive-geometry';

const groups = { 'person-': 40 };
const seeds = [0, 1, 17, 2147483648, 4294967295];
const override = { finish: 'holz-natur', token: '--signal' } as const;

for (const [prefix, count] of Object.entries(groups)) {
	const entries = assetRegistry.filter((entry) => entry.id.startsWith(prefix));
	test(prefix + ' registry inventory', () => expect(entries).toHaveLength(count));
	for (const entry of entries)
		test(entry.id + ' builds and dresses within its reservation', () => {
			const [w, d] = entry.footprint;
			const reservation = new Box3(
				new Vector3(-w / 2 - 0.02, -0.00001, -d / 2 - 0.02),
				new Vector3(w / 2 + 0.02, Infinity, d / 2 + 0.02)
			);
			const used = new Set<string>();
			for (const variant of entry.variants)
				for (const seed of seeds) {
					const base = buildObject(entry.id, variant, seed);
					expect(base.anchors).toEqual([
						{ attachment: 'deck', position: [0, 0, 0], normal: [0, 0, 1] }
					]);
					expect(base).toEqual(buildObject(entry.id, variant, seed));
					expect(base.parts.length).toBeGreaterThan(0);
					expect(base.parts.length).toBeLessThanOrEqual(25);
					expect(JSON.stringify(base.geometry)).not.toContain('null');
					const bounds = new Box3();
					for (const [i, part] of base.parts.entries()) {
						const member = base.geometry[i];
						used.add(member.slot);
						expect(entry.slotNames).toContain(member.slot);
						expect(entry.slotDefaults[variant][member.slot]).toBeDefined();
						for (const field of [
							'token',
							'finish',
							'material',
							'topToken',
							'overprint',
							'printBand'
						])
							expect(member).not.toHaveProperty(field);
						if (part.kind === 'polyline') throw new Error('Expected a solid');
						const { geometry, position, rotation } = build(part);
						geometry.rotateY(rotation).translate(position.x, position.y, position.z);
						geometry.computeBoundingBox();
						const box = geometry.boundingBox;
						if (!box || !reservation.containsBox(box))
							throw new Error([entry.id, variant, seed, part.id, JSON.stringify(box)].join(' '));
						bounds.union(box);
						geometry.dispose();
					}
					expect(Math.abs(bounds.min.y)).toBeLessThan(0.02);
					if (prefix === 'person-') {
						expect(bounds.max.y).toBeGreaterThanOrEqual(1.05);
						expect(bounds.max.y).toBeLessThanOrEqual(1.85);
					}
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
			expect([...used].sort()).toEqual([...entry.slotNames].sort());
		});
}
