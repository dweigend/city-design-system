import { test, expect } from 'bun:test';
import { acceptanceScene, houseGroups } from '../../logic/sandbox';
import { focuses } from '../../logic/presentation';
import { houseDistricts } from './house-districts';
import type { Primitive } from '../../logic/parametrik/types';

test('seed 7 merges surveyed stock into six terraces and restores the original houses on zoom', () => {
	const { world, earliestFullYear } = acceptanceScene();
	const districts = houseDistricts();
	for (const chunk of world.grid.chunks.keys())
		for (const [key, parts] of houseGroups(world, chunk, focuses.all, undefined, earliestFullYear))
			districts.set(chunk, key, parts);
	const batches = new Map<string, Primitive[]>();
	const flush = () => districts.flush((key, parts) => batches.set(key, parts));
	flush();
	const original = [...batches.values()].flat();
	districts.setOverview(true);
	flush();
	const masses = batches.get('stock-overview') ?? [];
	expect(masses).toHaveLength(6);
	expect(masses.every((p) => p.kind === 'prism' && p.height > 0 && p.polygon.length >= 3)).toBe(
		true
	);
	const current = [...batches.values()].flat();
	expect(current.filter((p) => p.role === 'bestand')).toEqual(masses);
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
	const rail: Primitive = {
		id: 'line/deck',
		role: 'neu',
		kind: 'pipe',
		points: [
			[0, 0, 2],
			[4, 0, 2]
		],
		radius: 0.55,
		material: 'concrete',
		token: '--cat-business'
	};
	const [deck, tube] = roundedStops([rail, { ...rail, glass: true }]);
	expect(deck).toMatchObject({ finish: 'metall-gebuerstet', token: '--paper' });
	expect(tube).toMatchObject({ finish: 'clear-acrylic', token: '--paper' });
});
