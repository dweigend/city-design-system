import { expect, test } from 'bun:test';
import {
	paintedSections,
	planHouse,
	sectionParts
} from '../../src/lib/catalog/logic/composed-house';
import { deckCovers } from '../../src/lib/catalog/logic/composed-house/parcel-assertions.test-support';
import type { Primitive, Vec3 } from '../../src/lib/catalog/logic/parametrik/types';
import { openingScene } from '../../src/lib/catalog/logic/sandbox';
import {
	composedProjection,
	townSections
} from '../../src/lib/catalog/logic/sandbox/composed-projection';
import { surfaceHeight, walkingHeight } from '../../src/lib/catalog/logic/sandbox/network-terrain';
import { cases } from './sites';

type Section = ReturnType<typeof planHouse>;
type Height = (x: number, y: number) => number;
const tolerance = 1e-7; // Metres at a surveyed ground contact.

function structuralPoints(part: Primitive, frame: Set<string>): Vec3[] {
	if (part.id.includes('/stair/')) return [];
	if (part.kind === 'pipe' && frame.has(part.id)) return part.points;
	if (part.kind === 'prism' && part.id.includes('/plinth'))
		return part.polygon.map(([x, y]) => [x, y, part.z]);
	if (part.kind === 'mesh' && part.id.includes('/exterior/'))
		return part.triangles.map((i) => part.points[i]);
	return [];
}

function bears(h: Section, parts: Primitive[], grade: Height) {
	const { structure, levels } = h.composition;
	const frame = new Set(structure.rods.filter((r) => r.action === 'strut').map((r) => r.id));
	for (const node of structure.nodes.filter((n) => n.founded)) frame.add(node.id + '/footing');
	const outlines =
		structure.principle === 'layers'
			? levels[0].bodies.flatMap((b) => b.band?.footprint ?? [])
			: [structure.parcel]; // The outer posts of a suspended room bear under its frame.
	return parts.some((p) =>
		structuralPoints(p, frame).some(
			([x, y, z]) =>
				z <= grade(x, y) + tolerance &&
				outlines.some(({ polygon, holes }) =>
					deckCovers({ ring: polygon, holes }, { ring: [[x, y]], holes: [] })
				)
		)
	);
}

for (const variant of ['organic', 'mixed', 'hillside', 'rotated'] as const)
	test(
		variant + ' occupied footprints bear on the parcel terrain',
		() => {
			const floating: string[] = [];
			for (const c of cases(variant)) {
				const owners = new Map(
					c.sites.flatMap((s) => s.cells.map((cell) => [cell.id, s] as const))
				);
				const stacks = new Map(c.sites.flatMap((s) => [...s.stacks]));
				const houses = paintedSections(c.grid, stacks, c.seed, {
					joined: (a, b) => owners.get(a) === owners.get(b)
				});
				expect(houses).toHaveLength(c.sites.length);
				for (const h of [...houses, planHouse(c.sites[0])]) {
					const grade: Height = (x, y) => {
						const cell = h.cells.find((c) =>
							c.corners.every(([u, v], i) => {
								const [a, b] = c.corners[(i + 1) % 4];
								return (a - u) * (y - v) - (b - v) * (x - u) >= -tolerance;
							})
						);
						return cell ? surfaceHeight(cell.corners, x, y) : NaN;
					};
					if (!bears(h, sectionParts(h), grade)) floating.push(c.name + '/' + c.seed + '/' + h.id);
				}
			}
			expect(floating).toEqual([]);
		},
		60000
	);

for (const seed of [7, 13, 29])
	test(
		'town houses bear on finished ground on seed ' + seed,
		() => {
			const { world } = openingScene(seed);
			const groups = new Map(composedProjection(world).map((g) => [g.id, g]));
			const houses = townSections(world).sections.filter((h) => !h.start);
			expect(houses.length).toBeGreaterThan(0);
			const grade: Height = (x, y) => walkingHeight(world.grid, x, y);
			expect(
				houses.filter((h) => !bears(h, groups.get(h.id)?.parts() ?? [], grade)).map((h) => h.id)
			).toEqual([]);
		},
		60000
	);
