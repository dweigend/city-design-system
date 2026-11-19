import { expect, test } from 'bun:test';
import { Box3, Vector3 } from 'three/webgpu';
import { build } from '../primitive-geometry';
import { assetRegistry, buildAsset, type AssetCategory } from '../../logic/assets';

/** Exercises every registered asset in one category, including its projected metre reservation. */
export function checkAssets(category: AssetCategory) {
	for (const entry of assetRegistry.filter((asset) => asset.category === category)) {
		test(entry.id + ' variants fit their attachment planes', () => {
			expect(entry.variants.length).toBeGreaterThanOrEqual(3);
			const [x, y] = entry.footprint;
			const facade = entry.anchors.some((a) => a.attachment === 'facade');
			const low = new Vector3(facade ? 0 : -x / 2, 0, -y / 2);
			const high = new Vector3(facade ? x : x / 2, Infinity, y / 2);
			const reservation = new Box3(low, high).expandByScalar(1e-5); // Float32 projection tolerance in metres.
			for (const a of entry.anchors) {
				expect(a.position).toEqual([0, 0, 0]);
				expect(a.normal).toEqual(a.attachment === 'facade' ? [1, 0, 0] : [0, 0, 1]);
			}
			for (const variant of entry.variants)
				for (const seed of [0, 17, 4294967295]) {
					const parts = buildAsset(entry.id, variant, seed);
					expect(parts.length).toBeGreaterThan(0);
					expect(parts).toEqual(buildAsset(entry.id, variant, seed));
					expect(new Set(parts.map((p) => p.id)).size).toBe(parts.length);
					for (const part of parts) {
						expect(JSON.stringify(part)).not.toContain('null');
						if (part.kind === 'polyline') continue;
						const { geometry, position, rotation } = build(part);
						geometry.rotateY(rotation).translate(position.x, position.y, position.z);
						geometry.computeBoundingBox();
						const box = geometry.boundingBox;
						if (!box) throw new Error('missing bounds');
						expect(reservation.containsBox(box)).toBe(true);
						geometry.dispose();
					}
				}
		});
	}
}
