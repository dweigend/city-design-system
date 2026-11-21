import { expect, test } from 'bun:test';
import { townSections } from '../../src/lib/catalog/logic/sandbox/composed-projection';
import { openingScene } from '../../src/lib/catalog/logic/sandbox';
import { profile } from '../../src/lib/catalog/logic/house-typology/fit-geometry';
import { massGraph, supportedMasses } from './masses';

test('populated opening courts carry one roof head per supported mass', () => {
	const world = openingScene(7).world;
	const { sections } = townSections(world);
	if (!world.state.city) throw Error('Missing opening town');
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
						(p) => profile(p).bounds.min[2] >= h.composition.levels[floor].position[2]
					)
				}
			}));
			const rooms = massGraph(houses);
			const masses = massGraph(upper).components;
			const groups = supportedMasses(houses);
			const heads = groups.map((group) =>
				[...group].filter((h) => h.composition.sharedRoof === 'head')
			);
			for (const house of houses) {
				const { crown, sharedRoof, structure } = house.composition;
				expect(house.slots.includes(crown)).toBe(
					sharedRoof === 'head' && structure.roof?.kind === 'crown'
				);
			}
			for (const house of heads.flat()) {
				const { structure } = house.composition;
				const roof = structure.roof;
				// f92b8e42 gives free-standing tent masts a cloth roof over their lookout.
				if (roof?.kind === 'skin') {
					expect(roof.patches.length).toBeGreaterThan(0);
					for (const id of roof.patches)
						expect(structure.skins.some((s) => s.id === id)).toBe(true);
				} else {
					expect(roof?.kind).toBe('crown');
				}
			}
			const roofHeads = heads.map((owners) => owners.length);
			console.log(
				'UPPER ' +
					JSON.stringify({ court: court.court, masses, bridges: rooms.inhabitedBridges, roofHeads })
			);
			expect(masses).toBeGreaterThanOrEqual(2);
			expect(masses).toBeLessThanOrEqual(3);
			if (
				houses.some((h) =>
					h.cells.some((c) =>
						c.neighbors.some((id) =>
							houses.some((other) => other !== h && other.cells.some((cell) => cell.id === id))
						)
					)
				)
			)
				expect(rooms.inhabitedBridges).toBeGreaterThan(0);
			expect(roofHeads).toEqual(groups.map(() => 1));
			return [court];
		});
	expect(results).toHaveLength(7);
});
