import { expect, test } from 'bun:test';
import { Box3, Vector3 } from 'three/webgpu';
import { assetRegistry, buildAsset } from '../../logic/assets';
import { build } from '../primitive-geometry';

function measure(id: string, variant: string, seed: number) {
	const parts = buildAsset(id, variant, seed);
	const bounds = new Box3();
	for (const p of parts) {
		if (p.kind === 'polyline') continue;
		const { geometry, rotation, position } = build(p);
		geometry.rotateY(rotation).translate(...position.toArray());
		geometry.computeBoundingBox();
		bounds.union(geometry.boundingBox!);
		geometry.dispose();
	}
	const size = bounds.getSize(new Vector3());
	return { parts: parts.length, ratios: [size.x / size.y, size.z / size.y, size.x / size.z] };
}
function differs(a: ReturnType<typeof measure>, b: ReturnType<typeof measure>) {
	return (
		a.parts !== b.parts ||
		a.ratios.some((r, i) => Math.max(r, b.ratios[i]) >= 1.18 * Math.min(r, b.ratios[i]))
	);
}

for (const entry of assetRegistry.filter(
	(a) => a.variants[0] === 'compact' && a.variants[1] === 'standard' && a.variants[2] === 'extended'
)) {
	test(entry.id + ' changes proportions or element count after thumbnail fitting', () => {
		for (const seed of [0, 17, 4294967295]) {
			const [compact, standard, extended] = entry.variants.map((v) => measure(entry.id, v, seed));
			expect(differs(compact, standard)).toBe(true);
			expect(differs(standard, extended)).toBe(true);
			expect(differs(compact, extended)).toBe(true);
		}
	});
}
