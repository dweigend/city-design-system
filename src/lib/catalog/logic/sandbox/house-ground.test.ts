import { penetration, profile } from '../house-typology/fit-geometry';
import type { Primitive } from '../parametrik/types';
import { expect, test } from 'bun:test';
import { openingScene } from './index';
import { walkingHeight } from './network-terrain';
import { composedProjection } from './composed-projection';
import { required } from '../required';

type Plate = Extract<Primitive, { kind: 'prism' }>;

function bearingFaces(plate: Plate) {
	const shape = profile(plate);
	return shape.faces ?? [shape.bottom];
}

function overlapsFootprint(a: Plate, b: Plate) {
	const bottom = bearingFaces(b);
	return bearingFaces(a).some((top) => bottom.some((face) => penetration(top, face) > 1e-8));
}

function bearsOn(upper: Plate, lower: Plate) {
	return (
		lower.z < upper.z &&
		Math.abs(lower.z + lower.height - upper.z) < 5e-9 &&
		overlapsFootprint(lower, upper)
	);
}

// A passage can split a pier at its sill and rename the plinth above it independently.
function checkSupports(plate: Plate, piers: Plate[], ground: (x: number, y: number) => number) {
	const supports = piers.filter((pier) => overlapsFootprint(pier, plate));
	expect(supports.length, plate.id).toBeGreaterThan(0);
	for (const pier of supports) {
		expect(pier.buildingSurface?.slot).toBe('shell');
		expect(pier.buildingSurface).toEqual(plate.buildingSurface);
		const carries = bearsOn(plate, pier) || supports.some((upper) => bearsOn(upper, pier));
		expect(carries, pier.id).toBe(true);
		const founded = pier.polygon.every(([x, y]) => pier.z <= ground(x, y));
		expect(founded || supports.some((lower) => bearsOn(pier, lower)), pier.id).toBe(true);
	}
	return supports.length;
}

for (const seed of [7, 13, 29])
	test(
		'elevated house plates bear on the floodplain on seed ' + seed,
		() => {
			const { world } = openingScene(seed);
			const ground = (x: number, y: number) => walkingHeight(world.grid, x, y);
			const raised = composedProjection(world).filter(
				(g) => !g.start && !g.span && world.grid.cellsById.get(g.cells[0])?.raised
			);
			expect(raised.length).toBeGreaterThan(0);
			let supports = 0;
			for (const house of raised) {
				const pad = required(world.grid.cellsById.get(house.cells[0]), 'house parcel').pad;
				const plates = house.parts().filter((p) => p.kind === 'prism');
				const piers = plates.filter((part) => part.id.includes('/foundation/'));
				// Passage surrounds and linings are fittings added after the house is seated.
				const floors = plates.filter((p) => p.z === pad && !p.id.includes('/portal/frame/'));
				for (const p of floors) {
					if (p.polygon.every(([x, y]) => p.z - ground(x, y) <= 0.02)) continue;
					supports += checkSupports(p, piers, ground);
				}
			}
			expect(supports).toBeGreaterThan(0);
		},
		60000
	);
