import { projectBuildingSurface } from '../building-surface';
import { expect, test } from 'bun:test';
import { BODY_TOKEN, COUNTER_TOKEN } from '../../data/house-body';
import { flowToken } from '../../data/focus';
import { buildingPalette } from '../../logic/material/building-palette';
import { batchFaces } from '../batch';
import { Color } from 'three';
import { createWorld, applyEdit } from '../../logic/sandbox';
import { buildingPlots } from '../../logic/sandbox/building-plots';
import { squareGrid } from '../../logic/quad-grid';
import { planHouse, paintedSections } from '../../logic/composed-house';
import { typologies } from '../../logic/house-typology';
import { specimen } from '../../logic/house-typology/specimens';
import { fieldUse, ensembleAnchor, houseSurfaces, sectionParts } from '../../logic/composed-house';

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
type Section = ReturnType<typeof specimen>;

type Part = ReturnType<typeof sectionParts>[number];

function checkSurface(part: Part) {
	const role = part.buildingSurface;
	if (!role) throw Error('Missing building surface on ' + part.id);
	const { token, finish } = projectBuildingSurface(part);
	const palette = buildingPalette(role.use, role.ensemble);
	expect(token, part.id).not.toBe(flowToken.people);
	expect(finish, part.id).toBe(palette[role.slot].finish);
	expect(token, part.id).toBe(palette[role.slot].token);
	if (role.slot === 'shell') expect(token, part.id).toBe(BODY_TOKEN[role.use]);
	if (role.slot === 'screen') expect(token, part.id).toBe(COUNTER_TOKEN[role.use]);
	if (role.slot === 'screen' || role.slot === 'fitting')
		expect(token, part.id).not.toBe(BODY_TOKEN[role.use]);
}

function checkPalette(section: Section) {
	const parts = sectionParts(section);
	const field = fieldUse(section);
	expect(section.decks.flatMap((deck) => deck.programme)).toContain(field);
	for (const part of parts) checkSurface(part);
	const shells = parts.filter((p) => p.buildingSurface?.slot === 'shell');
	const views = visibleShares(
		parts,
		(p) => new Color(p.buildingSurface?.slot === 'shell' ? 1 : 0, 0, 0)
	);
	expect(
		[
			[0, 1],
			[0, -1],
			[2, 1],
			[2, -1],
			[1, 1]
		].some(([axis, sign]) => views(axis, sign)[1] > 0),
		section.id + ' ' + section.composition.structure.principle + ' visible programme field'
	).toBe(true);
	if (section.composition.structure.principle === 'layers')
		for (const part of shells.filter((p) => p.source.objectId === 'full-height-shell'))
			expect(part.buildingSurface?.use, part.id).toBe(field);
}

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
test('typology specimens project programme fields and contrast hardware from the engine palette', () => {
	for (const [height, seed] of [
		[3, 19],
		[6, 7]
	])
		for (const type of typologies) checkPalette(specimen(cellsFor(type), type, height, seed));
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

test('ensemble members and standalone houses wear their own programme fields', () => {
	const grid = squareGrid(4, 2, 10);
	const living = (n: number) => Array<'living'>(n).fill('living');
	const stacks = new Map([
		['0/0', living(3)],
		['1/0', living(6)],
		['2/0', living(3)]
	]);
	const ensemble = paintedSections(grid, stacks, 7);
	expect(ensemble.filter(ensembleAnchor)).toHaveLength(1);
	for (const section of ensemble) checkPalette(section);
	const [alone] = paintedSections(grid, new Map([['1/0', living(6)]]), 7);
	expect(ensembleAnchor(alone)).toBe(false);
	checkPalette(alone);
}, 30000);

function visibleShares(parts: Part[], colour: Parameters<typeof batchFaces>[1]) {
	const mesh = batchFaces(parts.map(projectBuildingSurface), colour);
	const faces = [mesh.neu, mesh.alt, mesh.blatt, mesh.glas];
	const positions = faces.flatMap((f) => f.p),
		tags = faces.flatMap((f) => f.c);
	return (axis: number, sign: number) => {
		const hits = sample(positions, tags, axis, sign);
		const total = hits.reduce((sum, count) => sum + count, 0);
		return hits.map((count) => count / total);
	};
}

function silhouetteBudget(section: ReturnType<typeof specimen>) {
	const parts = sectionParts(section);
	const rooms = section.composition.levels.flatMap((l) => l.bodies.map((b) => b.id + '/'));
	const structure = section.composition.structure;
	const roomIds = new Set(structure.platforms.filter((p) => p.room).map((p) => p.id + '/room'));
	const architecture = new Set(
		parts
			.filter((part) => {
				const slot = part.buildingSurface?.slot;
				if (part.source.objectId === 'full-height-shell')
					return !part.glass && (slot === 'shell' || slot === 'screen');
				return (
					(slot === 'shell' || slot === 'pane' || slot === 'screen') &&
					(roomIds.has(part.id) || rooms.some((prefix) => part.id.startsWith(prefix)))
				);
			})
			.map((part) => part.id)
	);
	const views = visibleShares(parts, (p) => {
		const fittings =
			p.buildingSurface?.slot === 'fitting' ||
			p.buildingSurface?.slot === 'frame' ||
			/\/stair\/|\/post\/|\/brace|\/shaft\/|\/rail\/|\/terrace\/kit-parapet|\/landing-seat\//.test(
				p.id
			);
		return new Color().setRGB(fittings ? 1 : architecture.has(p.id) ? 2 : 0, 0, 0);
	});
	return [0, 2].map((axis) => {
		const [, hardware, architecture] = views(axis, 1);
		return { hardware, architecture };
	});
}

function paintedTown(seed: number) {
	let world = createWorld(seed, { cells: 0 });
	for (let i = 0; i < 30; i++) {
		const cellId = 26 + 2 * (i % 6) + '/' + (26 + 2 * Math.floor(i / 6));
		for (let n = 0; n <= i % 6; n++)
			world = applyEdit(world, { kind: 'raise', cellId, use: 'living' });
	}
	return paintedSections(buildingPlots(world.grid), world.state.stacks, seed);
}

for (const seed of [7, 13]) {
	test(
		'painted town material balance on world seed ' + seed,
		() => {
			for (const house of paintedTown(seed)) checkPalette(house);
		},
		45000
	);
	test(
		'Silhouette guard on both elevations of thirty painted houses, seed ' + seed,
		() => {
			const houses = paintedTown(seed);
			expect(houses).toHaveLength(30);

			for (const h of houses) {
				const { width, depth } = h.composition.bay;
				if (Math.min(width, depth) < 8) expect(h.typology).toBe('block');
				const bodies = h.composition.levels.flatMap((l) => l.bodies);
				expect(h.composition.levels).toHaveLength(h.stories);
				expect(
					bodies.every((b) => b.band?.footprint && b.band.lining && b.band.modules === undefined),
					h.id
				).toBe(true);
				expect(h.composition.exterior?.stations.at(-1)?.z).toBe(h.top);
				checkBudget(h, seed + '/' + h.id);
			}
		},
		45000
	);
}

function* narrowBays() {
	for (const width of [1.8, 2.5, 3, 4, 5]) {
		const cells = squareGrid(1, 1, width).cells;
		for (const height of [1, 2, 3, 6, 10])
			for (const seed of [2, 7, 19]) {
				const section = planHouse({
					cells,
					seed,
					stacks: new Map([[cells[0].id, Array(height).fill('living')]])
				});
				yield { section, label: width + '/' + height + '/' + seed };
			}
	}
}

test('narrow square bays retain material balance', () => {
	for (const { section } of narrowBays()) checkPalette(section);
}, 45000);

test('Silhouette guard for compact elevations across narrow square bays', () => {
	for (const { section, label } of narrowBays()) {
		for (const body of section.composition.levels.flatMap((l) => l.bodies)) {
			expect(body.band?.footprint).toBeDefined();
			expect(body.band?.lining).toBeDefined();
			expect(body.band?.modules).toBeUndefined();
		}
		checkBudget(section, label);
	}
}, 45000);

function checkBudget(section: Section, label: string) {
	for (const [index, view] of silhouetteBudget(section).entries()) {
		const elevation =
			label +
			' ' +
			section.composition.structure.principle +
			' elevation ' +
			index +
			' ' +
			JSON.stringify(view);
		expect(view.hardware, elevation).toBeLessThanOrEqual(0.15);
		expect(view.architecture, elevation).toBeGreaterThanOrEqual(0.6);
	}
}
