import { expect, test } from 'bun:test';
import { assetRegistry, buildObject } from '../../logic/assets';
import { build } from '../primitive-geometry';
import { Box3 } from 'three/webgpu';
import type { Vec3 } from '../../logic/parametrik/types';

const entries = assetRegistry.filter((a) => a.id.startsWith('kit-scatter-'));
const decks = entries.filter((a) => !a.id.startsWith('kit-scatter-plaza-'));
type Asset = ReturnType<typeof buildObject>;
test('six single-tone scatter registrations fit flat narrow decks', () => {
	expect(decks.length).toBe(6);
	for (const a of decks) {
		expect(a.slotNames).toEqual(['body']);
		expect(a.footprint[1]).toBeLessThanOrEqual(2);
	}
});
function checkBounds(obj: Asset, tolerance: number) {
	const bounds = new Box3();
	for (const p of obj.parts) {
		if (p.kind === 'polyline') throw Error('Expected solid staffage');
		const mesh = build(p),
			g = mesh.geometry;
		g.rotateY(mesh.rotation).translate(mesh.position.x, mesh.position.y, mesh.position.z);
		g.computeBoundingBox();
		if (g.boundingBox) bounds.union(g.boundingBox);
		g.dispose();
	}
	expect(Math.abs(bounds.min.y)).toBeLessThan(0.002);
	const margin = [
		obj.footprint[0] - bounds.max.x + bounds.min.x,
		obj.footprint[1] - bounds.max.z + bounds.min.z
	];
	for (const m of margin) expect(Math.abs(m - 0.3)).toBeLessThan(tolerance);
}
function checkSpacing(heads: Vec3[], variant: string) {
	for (const h of heads) {
		const nearest = Math.min(
			...heads.filter((p) => p !== h).map((p) => Math.hypot(p[0] - h[0], p[1] - h[1]))
		);
		expect(nearest, variant + ' head ' + heads.indexOf(h)).toBeWithin(0.6, 1.2);
	}
}
function checkCast(id: string, v: string, seed: number, count: number) {
	const obj = buildObject(id, v, seed);
	expect(obj.geometry).toEqual(buildObject(id, v, seed).geometry);
	expect(obj.anchors).toEqual([{ attachment: 'deck', position: [0, 0, 0], normal: [0, 0, 1] }]);
	expect(obj.geometry.every((p) => p.slot === 'body')).toBe(true);
	const heads = obj.geometry.flatMap((p) => (p.kind === 'sphere' ? [p.position] : []));
	expect(heads.length).toBe(count);
	checkBounds(obj, count === 1 ? 0.065 : 0.025);
	if (count > 1) checkSpacing(heads, v);
	return obj.geometry;
}
for (const entry of entries)
	test(entry.id + ' fits its reservation in all poses', () => {
		const count = Number(entry.id.split('-').at(-1)) || 1;
		const variants = new Set<string>();
		for (const v of entry.variants)
			for (const seed of [0, 17, 4294967295]) {
				const g = checkCast(entry.id, v, seed, count);
				if (seed === 0) variants.add(JSON.stringify(g));
			}
		expect(variants.size).toBe(3);
	});

test('court reservations retain an open centre or a gap between gatherings', () => {
	const plazas = entries.filter((a) => a.id.startsWith('kit-scatter-plaza-'));
	expect(plazas.map((a) => a.footprint)).toEqual([
		[3.5, 3],
		[5.5, 4.5]
	]);
	for (const a of plazas) {
		const [w, d] = a.footprint;
		for (const h of buildObject(a.id, 'ring', 17).geometry)
			if (h.kind === 'sphere')
				expect(Math.hypot(h.position[0] / (w / 2), h.position[1] / (d / 2))).toBeGreaterThan(0.66);
		const xs = buildObject(a.id, 'two-knots', 17)
			.geometry.flatMap((p) => (p.kind === 'sphere' ? [p.position[0]] : []))
			.sort((a, b) => a - b);
		expect(Math.max(...xs.slice(1).map((x, i) => x - xs[i]))).toBeGreaterThan(1.0);
	}
});
