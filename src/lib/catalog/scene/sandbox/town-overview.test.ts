import { test, expect } from 'bun:test';
import { acceptanceScene, houseGroups } from '../../logic/sandbox';
import { focuses } from '../../logic/presentation';
import { houseDistricts } from './house-districts';
import type { Primitive } from '../../logic/parametrik/types';

test('seed 7 keeps each surveyed stock wall and stepped roof and restores the original houses on zoom', () => {
	const { world, earliestFullYear } = acceptanceScene();
	const districts = houseDistricts();
	for (const chunk of world.grid.chunks.keys())
		for (const [key, parts] of houseGroups(world, chunk, focuses.all, undefined, earliestFullYear))
			districts.set(chunk, key, parts);
	const batches = new Map<string, Primitive[]>();
	const flush = () =>
		districts.flush((key, parts, visual) => batches.set((visual ? 'visual:' : '') + key, parts));
	flush();
	const original = [...batches.values()].flat();
	districts.setOverview(true);
	flush();
	const shells = [...batches]
		.filter(([key]) => key.startsWith('visual:'))
		.flatMap(([, parts]) => parts);
	const walls = (parts: Primitive[]) =>
		parts.filter((p) => p.role === 'bestand' && p.kind === 'prism' && p.id.endsWith(':wall'));
	expect(walls(original).length).toBeGreaterThan(6);
	expect(walls(shells)).toEqual(walls(original));
	const ends = original.filter((p) => p.role === 'bestand' && p.id.endsWith(':gable0'));
	expect(ends.length).toBeGreaterThan(0);
	expect(shells.filter((p) => p.kind === 'mesh' && p.roofCell).map((p) => p.roofCell)).toEqual(
		ends.map((p) => p.roofCell)
	);
	expect(shells.every((p) => !p.detail && p.kind !== 'polyline')).toBe(true);
	const current = [...batches.values()].flat();
	expect(current.filter((p) => p.role !== 'bestand')).toEqual(
		original.filter((p) => p.role !== 'bestand')
	);
	districts.setOverview(false);
	flush();
	expect([...batches.values()].flat()).toEqual(original);
});

test('the contact wash follows the slab face and stops when a wall lifts off it', async () => {
	const { wallContact } = await import('./wall-contact');
	const wall: Extract<Primitive, { kind: 'prism' }> = {
		id: 'wall',
		role: 'neu',
		token: '--paper',
		material: 'concrete',
		kind: 'prism',
		polygon: [
			[0, 0],
			[4, 0],
			[4, 3],
			[0, 3]
		],
		z: 2,
		height: 4
	};
	const slab: Primitive = { ...wall, id: 'floor', bearing: 'slab', height: 0.25, z: 1.75 };
	const seam = wallContact([wall, slab]);
	if (!seam) throw Error('Missing seated wall shadow');
	seam.geometry.computeBoundingBox();
	expect(seam.geometry.boundingBox?.min.y).toBe(2);
	expect(seam.geometry.boundingBox?.max.y).toBeCloseTo(2.35);
	expect(wallContact([{ ...wall, z: 2.5 }, slab])).toBeUndefined();
	const box = wallContact([
		{ ...wall, kind: 'box', position: [1, 1, 2], size: [2, 1, 4], rotation: Math.PI / 4 },
		slab
	]);
	expect(box?.geometry.getAttribute('position').count).toBe(24);
	box?.geometry.dispose();
	box?.material.dispose();
	seam.geometry.dispose();
	seam.material.dispose();
});

test('the neutral rail is metal and the neutral tube retains its clear shell', async () => {
	const { roundedStops } = await import('./station-rings');
	const { lineParts, cityTransitSlots } = await import('../../logic/transit-line');
	const line: import('../../logic/transit-line').TransitLine = {
		kind: 'viaduct',
		id: 'rail',
		cellIds: [],
		path: [
			[0, 0, 6],
			[30, 0, 6]
		],
		length: 30,
		stops: [{ position: [0, 0, 6], headingRad: 0 }],
		pillars: []
	};
	const custom = {
		...cityTransitSlots,
		platform: { token: '--cat-business', finish: 'holz-natur' }
	} as const;
	const parts = (kind: 'viaduct' | 'capsule') => roundedStops(lineParts({ ...line, kind }, custom));
	expect(parts('viaduct')[0]).toMatchObject(cityTransitSlots.deck);
	expect(parts('capsule')[0]).toMatchObject({ finish: 'clear-acrylic', token: '--paper' });
	expect(parts('viaduct').find((p) => p.id === 'rail/stop/0')).toMatchObject({
		kind: 'torus',
		...custom.platform
	});
});

test('a transit pod reappears when its route clears occupied stock', async () => {
	const { createVehicles } = await import('./vehicles');
	const { createWorld, houseObstacles } = await import('../../logic/sandbox');
	const world = createWorld(7);
	const obstacle = houseObstacles(world.grid, world.state)[0];
	const [x, y, z] = obstacle.position;
	const cars = createVehicles();
	try {
		for (const [height, visible] of [
			[z + 1, false],
			[z + 100, true]
		] as const) {
			const line: import('../../logic/transit-line').TransitLine = {
				kind: 'capsule',
				id: 'stock-crossing',
				cellIds: [],
				stops: [],
				pillars: [],
				length: 30,
				path: [
					[x, y, height],
					[x + 30, y, height]
				]
			};
			cars.setWorld({ ...world, lines: [{ ...line, year: world.state.year }] });
			cars.step(0);
			expect(cars.group.children[0].visible).toBe(visible);
		}
	} finally {
		cars.dispose();
	}
});
