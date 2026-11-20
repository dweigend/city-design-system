import { expect, test } from 'bun:test';
import { openingScene } from './index';
import { townSections } from './composed-projection';
import { required } from '../required';
import { polygonHouseSite, checkFit } from '../house-typology';
import { planHouse } from '../composed-house';

test('two finished hillside thresholds move the first occupied floor and keep the upper gallery datum', () => {
	const site = polygonHouseSite(
		'slope',
		[
			[0, 0],
			[15, 1],
			[18, 12],
			[9, 19],
			[0, 12]
		],
		['living', 'food', 'water'],
		7
	);
	const normal = planHouse(site);
	for (const drop of [0.4, 1.75]) {
		const floor = normal.composition.ground - drop;
		const stepped = planHouse({ ...site, finishedFloor: floor });
		const base = stepped.composition.parts.find((p) => p.slot === 'base');
		if (base?.kind !== 'prism') throw Error('Expected bearing floor');
		expect(base.z + base.height).toBeCloseTo(floor, 9);
		expect(stepped.composition.levels[0].landing[2]).toBeCloseTo(floor, 9);
		expect(
			stepped.composition.levels[0].bodies.every((b) => Math.abs(b.position[2] - floor) < 1e-8)
		).toBe(true);
		expect(stepped.composition.levels[1].landing).toEqual(normal.composition.levels[1].landing);
		expect(checkFit(stepped.composition.parts)).toEqual([]);
	}
});

test('the opening town meets the shared court and preserves the flood seat', () => {
	const { world } = openingScene(7);
	const { sections, layout } = townSections(world);
	const levels = (id: string) =>
		required(
			sections.find((s) => s.id === id),
			'planned house'
		).composition.levels;
	const court = required(layout.cells.get('72/41'), 'planned court').id;
	const front = required(
		world.grid.courtFronts?.find((f) => f.courtId === court),
		'court frontage'
	);
	expect(levels('72/41')[0].landing[2]).toBeCloseTo(front.pavingZ, 8);
	const cell = required(world.grid.cellsById.get('22/34'), 'flood site');
	expect(cell.raised).toBe(true);
	const entrance = levels(cell.id)[0].landing[2];
	expect(entrance).toBeGreaterThan(cell.pad);
	expect(entrance).toBeLessThan(cell.pad + 0.6);
}, 60000);
