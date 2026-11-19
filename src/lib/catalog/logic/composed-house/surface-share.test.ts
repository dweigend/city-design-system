import { expect, test } from 'bun:test';
import { Color } from 'three';
import { batch } from '../../scene/batch';
import { typologies } from '../house-typology';
import { specimen } from '../house-typology/specimens';
import { houseSurfaces, sectionParts } from './index';

type XY = [number, number, number];
const density = 8;
function inTriangle(t: number, s: number) {
	return t >= 0 && s >= 0 && t + s <= 1;
}
function coverTriangle(pixels: Map<number, [number, number]>, a: XY, b: XY, c: XY, slot: number) {
	const det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
	if (Math.abs(det) < 1e-8) return;
	for (let y = Math.ceil(Math.min(a[1], b[1], c[1])); y <= Math.max(a[1], b[1], c[1]); y++)
		for (let x = Math.ceil(Math.min(a[0], b[0], c[0])); x <= Math.max(a[0], b[0], c[0]); x++) {
			const t = ((x - a[0]) * (c[1] - a[1]) - (y - a[1]) * (c[0] - a[0])) / det;
			const s = ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) / det;
			if (!inTriangle(t, s)) continue;
			const key = y * 65536 + x,
				depth = a[2] + t * (b[2] - a[2]) + s * (c[2] - a[2]);
			if (depth > (pixels.get(key)?.[0] ?? -Infinity)) pixels.set(key, [depth, slot]);
		}
}
function sample(positions: number[], slots: number[], axis: number, sign: number) {
	const u = (axis + 1) % 3,
		v = (axis + 2) % 3;
	const pixel = (i: number): XY => [
		positions[i + u] * density,
		positions[i + v] * density,
		positions[i + axis] * sign
	];
	const pixels = new Map<number, [number, number]>();
	for (let i = 0; i < positions.length; i += 9) {
		const a = pixel(i),
			b = pixel(i + 3),
			c = pixel(i + 6);
		coverTriangle(pixels, a, b, c, slots[i]);
	}
	const hits = [0, 0, 0, 0];
	for (const [, slot] of pixels.values()) hits[slot]++;
	return hits;
}
function shares(s: ReturnType<typeof specimen>) {
	const palette = {
		...houseSurfaces,
		shell: { ...houseSurfaces.shell, token: '--signal' as const }
	};
	const painted = new Set(
		[
			palette.shell,
			palette.water,
			palette.energy,
			palette.living,
			palette.food,
			palette.material
		].map((p) => p.token)
	);
	const out = batch(sectionParts(s, palette), (p) =>
		new Color().setRGB(
			p.token === palette.shell.token
				? 3
				: painted.has(p.token)
					? 0
					: p.token === palette.deck.token || p.token === palette.frame.token
						? 1
						: 2,
			0,
			0
		)
	);
	const faces = [out.neu, out.alt, out.glas, out.blatt];
	const pos = faces.flatMap((f) => f.p),
		slots = faces.flatMap((f) => f.c);
	const totals = [0, 0, 0, 0];
	for (const [axis, sign] of [
		[0, 1],
		[0, -1],
		[2, 1],
		[2, -1],
		[1, 1]
	])
		sample(pos, slots, axis, sign).forEach((n, i) => (totals[i] += n));
	return totals.map((n) => (100 * n) / totals.reduce((a, b) => a + b));
}
test('programme and structure shares across four elevations and the roof', () => {
	const failures = [];
	for (const [height, seed] of [
		[3, 19],
		[6, 7]
	])
		for (const type of typologies) {
			const cells =
				type === 'courtyard-house'
					? 4
					: ['bridge-house', 'terrace-house', 'portal-house', 'twin-stack', 'slab-house'].includes(
								type
						  )
						? 2
						: 1;
			const [lead, structure, , shell] = shares(specimen(cells, type, height, seed));
			const paint = lead + shell;
			console.info(
				type,
				height,
				paint.toFixed(1),
				structure.toFixed(1),
				((100 * lead) / paint).toFixed(1)
			);
			if (paint < 55 || structure > 25 || lead < shell) failures.push(type + '/' + height);
		}
	expect(failures).toEqual([]);
}, 45000);
