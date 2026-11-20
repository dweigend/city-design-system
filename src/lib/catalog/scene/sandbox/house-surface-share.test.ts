import { expect, test } from 'bun:test';
import { ACCENT_TOKEN, GROUND_TOKEN } from '../../data/house-body';
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
import {
	accentBody,
	ensembleAnchor,
	houseSurfaces,
	sectionParts
} from '../../logic/composed-house';

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
function visibleLabels(s: ReturnType<typeof specimen>) {
	const parts = sectionParts(s);
	const labels: string[] = [];
	const out = batchFaces(parts, (p) => {
		if (!p.finish) throw Error('Missing finish on ' + p.id);
		const resolved = resolveFinish(p.finish, p.token, p.ageTint, p.colourRole);
		const finish = resolved.kind === 'diagram' ? (resolved.coating ?? p.finish) : p.finish;
		const key = [p.token, finish, p.colourRole ?? 'neutral'].join('|');
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
	return { labels, totals, total: totals.reduce((a, b) => a + b, 0) };
}

function checkPigment(role: string, token: string, leading: string, ground: string) {
	if (role === 'ensemble-ground') expect(token).toBe(ground);
	else if (role === 'body-accent') expect(token).toBe(leading);
	else if (token !== leading && token !== houseSurfaces.access.token)
		expect(
			Object.values(ACCENT_TOKEN).some((t) => t === token),
			'secondary programme'
		).toBe(false);
}

function shares(s: ReturnType<typeof specimen>) {
	const { labels, totals, total } = visibleLabels(s);
	const finishes = new Map<string, number>();
	const shellFinishes = new Set<string>();
	const uses = s.decks.flatMap((d) => d.programme);
	const leading = [...uses].sort(
		(a, b) => uses.filter((u) => u === b).length - uses.filter((u) => u === a).length
	)[0];
	let ground = 0,
		accent = 0,
		structure = 0;
	for (const [i, key] of labels.entries()) {
		const [token, finish, role] = key.split('|');
		const pct = (totals[i] * 100) / total;
		if (!pct) continue;
		checkPigment(role, token, ACCENT_TOKEN[leading], GROUND_TOKEN[s.composition.shellUse]);
		if (token.startsWith('--cat-')) accent += pct;
		if (role === 'ensemble-ground') {
			shellFinishes.add(finish);
			ground += pct;
		}
		if (token === houseSurfaces.frame.token) structure += pct;
		finishes.set(finish, (finishes.get(finish) ?? 0) + pct);
	}
	return {
		ground,
		accent,
		structure,
		finishes,
		secondary: [...finishes].filter(([finish]) => !shellFinishes.has(finish))
	};
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
	const { ground, accent, structure, finishes, secondary } = shares(section);
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
		ground > 0 &&
		accent <= (ensembleAnchor(section) ? 50 : 30) &&
		secondary.length >= 2 &&
		secondary.every(([, share]) => share <= 55) &&
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

const PAINTED: string[] = ['body', 'shell', 'glass'];
/** Bodies whose wall, shell or glazing carries a programme colour; trims and sills do not count. */
function paintedBodies(section: ReturnType<typeof specimen>) {
	const colours = new Set<string>(Object.values(ACCENT_TOKEN));
	const parts = sectionParts(section);
	return section.composition.levels
		.flatMap((l) => l.bodies)
		.filter((b) =>
			parts.some(
				(p) =>
					p.id.startsWith(b.id + '/') && PAINTED.includes(p.source.slot) && colours.has(p.token)
			)
		);
}
test('every house has exactly one accent body, chosen by body and not by storey', () => {
	for (const [height, seed] of [
		[3, 19],
		[6, 7]
	])
		for (const type of typologies) {
			const section = specimen(cellsFor(type), type, height, seed);
			const painted = paintedBodies(section);
			expect(
				painted.map((b) => b.id),
				type + '/' + height
			).toEqual([accentBody(section).id]);
		}
}, 45000);
test('an explicit envelope slot supplies both its pigment and its finish', () => {
	const house = specimen(1, 'block', 3, 19);
	const shell = { token: '--signal', finish: 'glas-klar' } as const;
	const surfaces = sectionParts(house, { ...houseSurfaces, shell }).filter(
		(part) => part.source.objectId === 'full-height-shell'
	);
	expect(surfaces.length).toBeGreaterThan(0);
	for (const part of surfaces) {
		expect(part).toMatchObject(shell);
		expect(part.colourRole).toBeUndefined();
	}
});

test('only the high point of an ensemble of two or more houses carries a whole colour body', () => {
	const grid = squareGrid(4, 2, 10);
	const living = (n: number) => Array<'living'>(n).fill('living');
	const stacks = new Map([
		['0/0', living(3)],
		['1/0', living(6)],
		['2/0', living(3)]
	]);
	const ensemble = paintedSections(grid, stacks, 7);
	expect(ensemble.filter(ensembleAnchor)).toHaveLength(1);
	for (const section of ensemble) {
		const anchor = ensembleAnchor(section);
		const { accent } = shares(section);
		expect(
			paintedBodies(section).map((b) => b.id),
			section.id
		).toEqual([accentBody(section).id]);
		expect(shares(section).ground, section.id).toBeGreaterThan(0);
		expect(accent, section.id).toBeLessThanOrEqual(anchor ? 50 : 30);
	}
	const [alone] = paintedSections(grid, new Map([['1/0', living(6)]]), 7);
	expect(ensembleAnchor(alone)).toBe(false);
	expect(paintedBodies(alone)).toHaveLength(1);
	expect(shares(alone).accent).toBeLessThanOrEqual(30);
}, 30000);

function silhouetteBudget(section: ReturnType<typeof specimen>) {
	const mesh = batch(sectionParts(section), (p) => {
		const fittings =
			/\/stair\/|\/post\/|\/brace|\/shaft\/|\/rail\/|\/terrace\/kit-parapet|\/landing-seat\//.test(
				p.id
			);
		return new Color().setRGB(fittings ? 1 : 0, 0, 0);
	});
	const faces = [mesh.neu, mesh.alt, mesh.blatt, mesh.glas];
	const pos = faces.flatMap((f) => f.p),
		tags = faces.flatMap((f) => f.c);
	return [0, 2].map((axis) => {
		const hits = sample(pos, tags, axis, 1);
		const total = hits.reduce((a, b) => a + b, 0);
		return hits[1] / total;
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
				expect(h.composition.levels).toHaveLength(h.stories);
				expect(
					bodies.every((b) => b.band?.footprint && b.band.lining),
					h.id
				).toBe(true);
				expect(h.composition.exterior?.stations.at(-1)?.z).toBe(h.top);
				return silhouetteBudget(h);
			});
			const passed = results.filter((views) => views.every((v) => v <= 0.15)).length;
			console.info(
				'Town silhouette',
				seed,
				passed,
				'of 30',
				'maximum hardware',
				Math.max(...results.flat())
			);
			expect(passed).toBeGreaterThanOrEqual(24);
			expect(failed.map((h) => h.id)).toEqual([]);
		},
		45000
	);

test('compact elevations keep the hardware budget across narrow square bays', () => {
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
					expect(view, width + '/' + height + '/' + seed).toBeLessThanOrEqual(0.15);
				}
			}
	}
}, 45000);
