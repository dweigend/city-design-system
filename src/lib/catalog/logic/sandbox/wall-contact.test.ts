import { translate } from '../ansicht/geometrie';
import { sectionParts, fieldUse } from '../composed-house';
import { seatedHouse } from './house-ground';
import { required } from '../required';
import { expect, test } from 'bun:test';
import { wallContact, wallContacts, chartPoint, type TerrainGrid } from '../terrain-grid';
import { openingScene } from './index';
import { walkingHeight } from './network-terrain';
import { townSections } from './composed-projection';
import { setbackGrade } from './court-setback';

const base = { houseId: 'dry', ring: 0, edge: 1, start: 0, end: 1, use: 'wall' as const };
function checkSection(grid: TerrainGrid, result: ReturnType<typeof wallContact>, footZ: number) {
	if (result.kind !== 'surveyed') throw Error('Interior shell outside survey: ');
	expect(result.stations[0].u).toBe(0);
	expect(result.stations.at(-1)?.u).toBeCloseTo(1, 8);
	for (const [j, s] of result.stations.slice(1).entries()) {
		const prev = result.stations[j];
		expect(s.u).toBeGreaterThan(prev.u);
		const ground = walkingHeight(grid, (s.x + prev.x) / 2, (s.y + prev.y) / 2);
		if (Number.isFinite(ground)) expect((s.groundZ + prev.groundZ) / 2).toBeCloseTo(ground, 6);
		expect((s.groundZ - footZ) * (prev.groundZ - footZ)).toBeGreaterThanOrEqual(-1e-8);
	}
	return result.stations.length - 1;
}
for (const seed of [7, 13, 29])
	test(
		'finished wall sections follow every terrain and bank facet on seed ' + seed,
		() => {
			const { world } = openingScene(seed);
			let intervals = 0;
			for (const section of townSections(world).sections) {
				const shell = section.composition.exterior;
				if (section.start || !shell) continue;
				for (const [i, a] of shell.ring.entries()) {
					const result = wallContact(world.grid, {
						...base,
						a,
						b: shell.ring[(i + 1) % shell.ring.length],
						footZ: shell.bottom
					});
					intervals += checkSection(world.grid, result, shell.bottom);
				}
			}
			expect(intervals).toBeGreaterThan(100);
		},
		60000
	);

function checkReverse(
	grid: TerrainGrid,
	wall: Parameters<typeof wallContact>[1],
	shared: Extract<ReturnType<typeof wallContact>, { kind: 'surveyed' }>
) {
	const reverse = wallContact(grid, { ...wall, a: wall.b, b: wall.a });
	if (reverse.kind !== 'surveyed') throw Error('missing reversed wall');
	for (const [i, s] of reverse.stations.entries()) {
		const original = shared.stations[shared.stations.length - 1 - i];
		expect(s.groundZ).toBeCloseTo(original.groundZ, 7);
		expect(s.u).toBeCloseTo(1 - original.u, 7);
	}
}

function checkOpenings(
	grid: TerrainGrid,
	wall: Parameters<typeof wallContact>[1],
	court: NonNullable<typeof wall.court>
) {
	for (const use of ['party', 'entrance', 'flood-opening'] as const) {
		const open = wallContact(grid, { ...wall, court, use });
		expect(open.kind === 'surveyed' && open.frontage?.retainingOwner).toBeNull();
	}
}

test('partial intervals keep original fractions, ground ownership, setbacks and openings', () => {
	const { grid } = openingScene(7).world;
	const c = required(
		grid.cells.find((c) => c.bank),
		'bank parcel'
	);
	const xy = (u: number, v: number): [number, number] => {
		const [x, y] = chartPoint(c.corners, u, v);
		return [x, y];
	};
	const wall = { ...base, start: 0.25, end: 0.75, a: xy(0.1, 0.1), b: xy(0.9, 0.9), footZ: c.pad };
	const court = {
		courtId: c.id,
		edge: 0,
		a: xy(0.3, 0.3),
		b: xy(0.7, 0.7),
		pavingZ: c.pad + 10,
		earthSide: 'left' as const
	};
	const shared = wallContact(grid, { ...wall, court });
	if (shared.kind !== 'surveyed') throw Error('missing adjoining court');
	expect(shared.stations[0].u).toBe(0.25);
	expect(shared.stations.at(-1)?.u).toBeCloseTo(0.75);
	expect(shared.frontage?.retainingOwner).toBe('envelope');
	expect(shared.frontage?.retainingFaces).toEqual([]);
	checkReverse(grid, wall, shared);
	checkOpenings(grid, wall, court);
	const setback = wallContact(grid, {
		...wall,
		court: { ...court, a: xy(0.3, 0.4), b: xy(0.7, 0.8) }
	});
	if (setback.kind !== 'surveyed' || !setback.frontage) throw Error('missing setback');
	expect(setback.frontage.retainingOwner).toBe('terrain');
	expect(setback.frontage.retainingFaces.length).toBeGreaterThan(0);
	const [a, b, d] = setback.frontage.retainingFaces[0];
	const nx = (b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]);
	const ny = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]);
	expect(nx * (court.a[1] - court.b[1]) + ny * (court.b[0] - court.a[0])).toBeGreaterThan(0);
	for (const { toe, foot, lip } of setback.frontage.sections) {
		for (const [x, y, z] of [toe, foot]) expect(z).toBeCloseTo(walkingHeight(grid, x, y), 7);
		expect(lip[2]).toBe(court.pavingZ);
	}
	expect(wallContact(grid, { ...wall, a: [-1e5, 1e5] }).kind).toBe('unsurveyed');
	const grade = setbackGrade(
		[0, 0],
		[4, 0],
		0,
		1,
		[
			{
				...c,
				lotCorners: [
					[0, 2, 0],
					[4, 2, 0],
					[4, 4, 0],
					[0, 4, 0]
				]
			}
		],
		() => 4,
		4.5
	);
	expect(grade([2, 1], 2)).toBe(3);
	expect(grade([2, 2], 2)).toBe(4);
	expect(grade([2, 3], 2)).toBeUndefined();
}, 60000);

test('the town grid locates court ends and shared faces without a caller supplying a court', () => {
	const { grid } = openingScene(7).world;
	const front = required(grid.courtFronts?.[0], 'surveyed court side');
	const point = (u: number, d: number): [number, number] => [
		front.a[0] + (front.b[0] - front.a[0]) * u + d * front.nx,
		front.a[1] + (front.b[1] - front.a[1]) * u + d * front.ny
	];
	const span = { ...base, footZ: front.pavingZ, a: point(-0.1, 0), b: point(0.5, 0) };
	const contacts = wallContacts(grid, span);
	const side = contacts.find(
		(r) =>
			r.kind === 'surveyed' && r.court?.courtId === front.courtId && r.court?.edge === front.edge
	);
	if (side?.kind !== 'surveyed') throw Error('missing shared face');
	expect(side.start).toBeCloseTo(1 / 6, 8);
	expect(side.frontage?.relation).toBe('shared-face');
	expect(side.frontage?.retainingFaces).toEqual([]);
	const away = wallContacts(grid, { ...span, a: point(0.3, 0.5), b: point(0.7, 0.5) });
	expect(away.some((r) => r.kind === 'surveyed' && r.frontage?.relation === 'setback')).toBe(true);
}, 60000);

test('an exposed shell follows the hillside beneath its cut panels', () => {
	const { world } = openingScene(7);
	const house = required(
		townSections(world).sections.find((s) => s.id === '114/41'),
		'hillside house'
	);
	const shell = required(house.composition.exterior, 'layered shell');
	const cells = house.cells.map((c) => required(world.grid.cellsById.get(c.id), 'hillside parcel'));
	// Raise the example seat to expose the bank that buries this shell in the opening town.
	const rise = 3;
	const parts = sectionParts(house).map((p) => translate(p, [0, 0, rise]));
	const field = { slot: 'shell' as const, use: fieldUse(house), ensemble: house.ensemble };
	const seated = seatedHouse(parts, cells, world.grid, shell.bottom + rise, field);
	const panels = seated.filter((p) => p.kind === 'mesh' && p.id.endsWith('/ground'));
	expect(panels.length).toBeGreaterThan(0);
	for (const p of panels) {
		if (p.kind !== 'mesh') throw Error('Expected wall sheet');
		expect(p.buildingSurface).toEqual(field);
		for (let i = 0; i < p.points.length; i += 4) {
			const [a, b, top] = p.points.slice(i, i + 3);
			expect(top[2]).toBeCloseTo(shell.bottom + rise, 8);
			const ground = walkingHeight(world.grid, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
			expect((a[2] + b[2]) / 2).toBeLessThanOrEqual(ground + 1e-7);
		}
	}
}, 60000);
