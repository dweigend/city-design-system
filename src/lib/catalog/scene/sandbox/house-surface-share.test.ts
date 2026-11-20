import { expect, test } from 'bun:test';
import { BODY_TOKEN } from '../../data/house-body';
import { resolveFinish } from '../../logic/material/surface';
import { batchFaces } from '../batch';
import { Color } from 'three';
import { batch } from '../batch';
import { createWorld, applyEdit } from '../../logic/sandbox';
import { buildingPlots } from '../../logic/sandbox/building-plots';
import { squareGrid } from '../../logic/quad-grid';
import { planHouse, paintedSections } from '../../logic/composed-house';
import { typologies } from '../../logic/house-typology';
import { specimen } from '../../logic/house-typology/specimens';
import { houseSurfaces, sectionParts } from '../../logic/composed-house';

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
	for (const [, slot] of pixels.values()) hits[slot] = (hits[slot] ?? 0) + 1;
	return hits;
}
function shares(s: ReturnType<typeof specimen>) {
	const parts = sectionParts(s);
	const labels: string[] = [];
	const out = batchFaces(parts, (p) => {
		if (!p.finish) throw Error('Missing finish on ' + p.id);
		const resolved = resolveFinish(p.finish, p.token);
		const finish = resolved.kind === 'diagram' ? (resolved.coating ?? p.finish) : p.finish;
		const key = [p.token, finish].join('|');
		if (!labels.includes(key)) labels.push(key);
		return new Color().setRGB(labels.indexOf(key), 0, 0);
	});
	const faces = [out.neu, out.alt, out.glas, out.blatt];
	const pos = faces.flatMap((f) => f.p),
		slots = faces.flatMap((f) => f.c);
	const totals = labels.map(() => 0);
	for (const [axis, sign] of [
		[0, 1],
		[0, -1],
		[2, 1],
		[2, -1],
		[1, 1]
	])
		sample(pos, slots, axis, sign).forEach((n, i) => {
			if (n) totals[i] += n;
		});
	const total = totals.reduce((a, b) => a + b, 0);
	const finishes = new Map<string, number>();
	const uses = s.decks.flatMap((d) => d.programme);
	const leading = [...uses].sort(
		(a, b) => uses.filter((u) => u === b).length - uses.filter((u) => u === a).length
	)[0];
	let accent = 0,
		structure = 0;
	for (const [i, key] of labels.entries()) {
		const [token, finish] = key.split('|');
		const pct = (totals[i] * 100) / total;
		if (!pct) continue;
		if (token === BODY_TOKEN[leading]) accent += pct;
		else
			expect(
				Object.values(BODY_TOKEN).some((t) => t === token),
				s.id + ' secondary programme'
			).toBe(false);
		if (token === houseSurfaces.frame.token) structure += pct;
		finishes.set(finish, (finishes.get(finish) ?? 0) + pct);
	}
	return { accent, structure, finishes };
}
/** Typologies whose defining element is their support: a drum core, a dome on long stilts, or a
 * trunk with three branch decks.
 * Their grey structure may reach 30 % of the visible surface; every other house stays at 25 %. */
const SUPPORT_LED: string[] = ['round-tower', 'bell-house', 'tree-house'];
const TWO_CELL: string[] = [
	'bridge-house',
	'terrace-house',
	'portal-house',
	'twin-stack',
	'slab-house'
];
function cellsFor(type: string) {
	if (type === 'courtyard-house') return 4;
	return TWO_CELL.includes(type) ? 2 : 1;
}
function balanced(section: ReturnType<typeof specimen>, label: string) {
	const { accent, structure, finishes } = shares(section);
	const brass = finishes.get('metall-messing') ?? 0;
	const largest = Math.max(...finishes.values());
	console.info(
		label,
		accent.toFixed(2),
		finishes.size,
		largest.toFixed(2),
		structure.toFixed(2),
		brass.toFixed(2)
	);
	return (
		accent >= 10 &&
		accent <= 30 &&
		finishes.size >= 3 &&
		largest <= 55 &&
		structure <= (SUPPORT_LED.includes(section.typology) ? 30 : 25) &&
		brass <= 2
	);
}
test('visible accent, material diversity, frame and brass across four elevations and the roof', () => {
	const failed: string[] = [];
	for (const [height, seed] of [
		[3, 19],
		[6, 7]
	])
		for (const type of typologies) {
			const label = type + '/' + height;
			if (!balanced(specimen(cellsFor(type), type, height, seed), label)) failed.push(label);
		}
	expect(failed).toEqual([]);
}, 45000);

function silhouetteBudget(section: ReturnType<typeof specimen>) {
	const bodies = section.composition.levels.flatMap((l) => l.bodies);
	const mesh = batch(sectionParts(section), (p) => {
		const fittings =
			/\/stair\/|\/post\/|\/brace|\/shaft\/|\/rail\/|\/terrace\/kit-parapet|\/landing-seat\//.test(
				p.id
			);
		const body = p.id.endsWith('/socle/body/0')
			? bodies.length
			: bodies.findIndex((b) => p.id.startsWith(b.id + '/' + b.objectId + '/'));
		return new Color().setRGB(fittings ? 1 : body >= 0 ? 2 + body : 0, 0, 0);
	});
	const faces = [mesh.neu, mesh.alt, mesh.blatt, mesh.glas];
	const pos = faces.flatMap((f) => f.p),
		tags = faces.flatMap((f) => f.c);
	return [0, 2].map((axis) => {
		const hits = sample(pos, tags, axis, 1);
		const total = hits.reduce((a, b) => a + b, 0);
		const largest = hits
			.slice(2)
			.sort((a, b) => b - a)
			.slice(0, 2);
		return { hardware: hits[1] / total, bodies: largest.reduce((a, b) => a + b, 0) / total };
	});
}

for (const seed of [7, 13])
	test(
		'two elevations of thirty painted town houses on world seed ' + seed,
		() => {
			let world = createWorld(seed, { cells: 0 });
			for (let i = 0; i < 30; i++) {
				const cellId = 26 + 2 * (i % 6) + '/' + (26 + 2 * Math.floor(i / 6));
				for (let n = 0; n <= i % 6; n++)
					world = applyEdit(world, { kind: 'raise', cellId, use: 'living' });
			}
			const houses = paintedSections(buildingPlots(world.grid), world.state.stacks, seed);
			expect(houses).toHaveLength(30);
			const failed = houses.filter((h) => !balanced(h, seed + '/' + h.id + '/' + h.stories));
			const results = houses.map((h) => {
				const { width, depth } = h.composition.bay;
				if (Math.min(width, depth) < 8) expect(h.typology).toBe('block');
				const bodies = h.composition.levels.flatMap((l) => l.bodies);
				expect(bodies.length).toBeLessThanOrEqual(3);
				if (Math.min(width, depth) >= 2.1)
					expect(
						bodies.every((b) => !b.band || b.band.modules !== undefined),
						h.id
					).toBe(true);
				if (h.stories <= 4) {
					const height = h.composition.crown.position[2] + h.composition.crown.size[2] - h.base[2];
					expect(
						Math.max(...bodies.map((b) => Math.max(b.size[0], b.size[1]))) + 1e-7,
						h.id
					).toBeGreaterThanOrEqual(0.6 * height);
				}
				return silhouetteBudget(h);
			});
			const passed = results.filter((views) =>
				views.every((v) => v.hardware <= 0.15 && v.bodies >= 0.6)
			).length;
			console.info(
				'Town silhouette',
				seed,
				passed,
				'of 30',
				'fitted houses',
				houses.filter((h) =>
					h.composition.levels.some((l) => l.bodies.some((b) => b.band && !b.band.modules))
				).length,
				'maximum hardware',
				Math.max(...results.flat().map((v) => v.hardware)),
				'minimum two bodies',
				Math.min(...results.flat().map((v) => v.bodies))
			);
			expect(passed).toBeGreaterThanOrEqual(24);
			expect(failed.map((h) => h.id)).toEqual([]);
		},
		45000
	);

test('compact elevations keep the hardware and two-body budgets across narrow square bays', () => {
	for (const width of [1.8, 2.5, 3, 4, 5]) {
		const cells = squareGrid(1, 1, width).cells;
		for (const height of [1, 2, 3, 6, 10])
			for (const seed of [2, 7, 19]) {
				const section = planHouse({
					cells,
					seed,
					stacks: new Map([[cells[0].id, Array(height).fill('living')]])
				});
				expect(balanced(section, 'narrow/' + width + '/' + height + '/' + seed)).toBe(true);
				for (const view of silhouetteBudget(section)) {
					expect(view.hardware, width + '/' + height + '/' + seed).toBeLessThanOrEqual(0.15);
					expect(view.bodies, width + '/' + height + '/' + seed).toBeGreaterThanOrEqual(0.6);
				}
			}
	}
}, 45000);
