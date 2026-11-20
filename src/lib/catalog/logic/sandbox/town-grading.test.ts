import { area } from '../ansicht/geometrie';
import type { Primitive } from '../parametrik/types';
import { expect, test } from 'bun:test';
import { required } from '../required';
import { openingScene, createWorld, cityCentreView, type World } from './index';
import { openCity } from './city-opening';
import { surveyedGrid } from './town-grid';
import { walkingHeight } from './network-terrain';

function checkBench(
	p: Extract<Primitive, { kind: 'prism' }>,
	ground: (x: number, y: number) => number
) {
	const [a, b, , d] = p.polygon;
	for (let i = 0; i <= 8; i++)
		for (let j = 0; j <= 8; j++) {
			const x = a[0] + ((b[0] - a[0]) * i) / 8 + ((d[0] - a[0]) * j) / 8;
			const y = a[1] + ((b[1] - a[1]) * i) / 8 + ((d[1] - a[1]) * j) / 8;
			const soil = ground(x, y);
			expect(p.z - soil).toBeLessThan(0.001);
			expect(p.z + p.height - soil).toBeGreaterThanOrEqual(0.049);
		}
}
function checkWalk(parts: Primitive[], ground: (x: number, y: number) => number) {
	const sills = new Set(
		parts.filter((p) => p.id.endsWith('/pier/foot')).map((p) => p.id.slice(0, -10))
	);
	let grounded = 0,
		total = 0;
	for (const p of parts) {
		if (
			p.kind !== 'prism' ||
			!/^town-walk\/\d+\/\d+>\d+\/\d+(?:\/stair)?(?::tread:\d+)?(?:\/panel\/\d+)?$/.test(p.id)
		)
			continue;
		const size = area(p.polygon);
		total += size;
		if (sills.has(p.id.split('/panel/')[0])) grounded += size;
		for (const [x, y] of p.polygon) expect(ground(x, y) - p.z - p.height, p.id).toBeLessThan(0.02);
	}
	expect(grounded).toBeGreaterThan(total / 2);
}

function checkSeats(world: World, ids: string[], ground: (x: number, y: number) => number) {
	for (const id of ids) {
		const c = required(world.grid.cellsById.get(id), 'house');
		if (c.raised) {
			expect(c.pad).toBe(
				required(surveyedGrid(world.grid).cellsById.get(id), 'surveyed parcel').pad
			);
			continue;
		}
		for (const [x, y] of c.lotCorners ?? c.corners)
			expect(c.pad - ground(x, y)).toBeLessThan(0.001);
	}
}
for (const [seed, terraceRows] of [
	[7, 4],
	[13, 4],
	[29, 4],
	[7, 2],
	[13, 8]
]) {
	test(
		'dry seats and public benches on seed ' + seed + ' with ' + terraceRows + ' terrace rows',
		() => {
			const world =
				terraceRows === 4
					? openingScene(seed).world
					: openCity(createWorld(seed, { plan: { terraceRows } }));
			const city = required(world.state.city, 'planned town');
			const ground = (x: number, y: number) => walkingHeight(world.grid, x, y);
			const parts = cityCentreView(world);
			checkWalk(parts, ground);
			const groups = city.centres.flatMap((c) => c.ensembles);
			expect(groups.length).toBeGreaterThan(0);
			for (const g of groups) {
				const p = parts.find((p) => p.id === 'court/' + g.court);
				if (p?.kind !== 'prism') throw Error('Missing court floor');
				checkBench(p, ground);
				checkSeats(world, g.lots, ground);
			}
		},
		60000
	);
}
