import { expect, test } from 'bun:test';
import { openingScene } from './index';
import { walkingHeight } from './network-terrain';
import { composedProjection } from './composed-projection';
import { required } from '../required';

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
				for (const p of plates.filter((p) => p.z === pad)) {
					if (p.polygon.every(([x, y]) => p.z - ground(x, y) <= 0.02)) continue;
					const walls = plates.filter((w) => w.id.startsWith(p.id + '/foundation/'));
					expect(walls.length, p.id).toBeGreaterThan(0);
					for (const wall of walls) {
						expect(wall.buildingSurface?.slot).toBe('shell');
						expect(wall.buildingSurface).toEqual(p.buildingSurface);
						expect(wall.z + wall.height).toBeCloseTo(p.z, 8);
						expect(wall.polygon.every(([x, y]) => wall.z <= ground(x, y))).toBe(true);
					}
					supports += walls.length;
				}
			}
			expect(supports).toBeGreaterThan(0);
		},
		60000
	);
