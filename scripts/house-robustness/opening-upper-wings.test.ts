import { expect, test } from 'bun:test';
import { townSections } from '../../src/lib/catalog/logic/sandbox/composed-projection';
import { openingScene } from '../../src/lib/catalog/logic/sandbox';
import { massGraph } from './masses';

test('six populated opening courts each carry two or three upper wings and one roof head', () => {
	const world = openingScene(7).world;
	const { sections } = townSections(world);
	const results = world.state.city.centres
		.flatMap((c) => c.ensembles)
		.flatMap((court) => {
			const houses = sections.filter((h) => h.cells.some((c) => court.lots.includes(c.id)));
			if (!houses.length) return [];
			const floor = Math.min(2, ...houses.map((h) => h.stories - 1));
			const upper = houses.map((h) => ({
				...h,
				composition: {
					...h.composition,
					parts: h.composition.parts.filter(
						(p) => p.position[2] >= h.composition.levels[floor].position[2]
					)
				}
			}));
			const rooms = massGraph(houses);
			const masses = massGraph(upper).components;
			const crowns = houses.filter((h) => h.slots.includes(h.composition.crown)).length;
			console.log(
				'UPPER ' +
					JSON.stringify({ court: court.court, masses, bridges: rooms.inhabitedBridges, crowns })
			);
			expect(masses).toBeGreaterThanOrEqual(2);
			expect(masses).toBeLessThanOrEqual(3);
			expect(rooms.inhabitedBridges).toBeGreaterThan(0);
			expect(crowns).toBe(1);
			return [court];
		});
	expect(results).toHaveLength(6);
});
