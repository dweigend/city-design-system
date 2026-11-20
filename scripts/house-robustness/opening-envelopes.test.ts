import { expect, test } from 'bun:test';
import { openingScene } from '../../src/lib/catalog/logic/sandbox';
import { townSections } from '../../src/lib/catalog/logic/sandbox/composed-projection';
import { sectionParts } from '../../src/lib/catalog/logic/composed-house';
import { checkParcel } from '../../src/lib/catalog/logic/composed-house/parcel-assertions.test-support';
import { BODY_TOKEN } from '../../src/lib/catalog/data/house-body';
import { oberflaechenWerte } from '../../src/lib/catalog/logic/material/ausfuehrung';
import { resolveFinish } from '../../src/lib/catalog/logic/material/surface';
import { massGraph } from './masses';

const world = openingScene(7).world;
const { sections, layout } = townSections(world);
if (!world.state.city) throw Error('Missing opening city');
for (const court of world.state.city.centres.flatMap((c) => c.ensembles)) {
	const houses = sections.filter((h) => layout.cells.get(h.cells[0].id)?.id === court.court);
	if (!houses.length) continue;
	test('continuous envelopes in opening court ' + court.court, () => {
		expect(new Set(houses.map((h) => h.composition.shellUse)).size).toBe(1);
		expect(new Set(houses.map((h) => h.composition.exterior?.system)).size).toBe(1);
		for (const house of houses) {
			const parts = sectionParts(house);
			checkParcel(house, parts);
			const envelope = house.composition.exterior;
			if (!envelope) throw Error('Missing full-height envelope on ' + house.id);
			expect(envelope.bottom).toBe(house.composition.ground);
			expect(envelope.top).toBe(house.top);
			const walls = parts.filter((p) => p.source.objectId === 'full-height-shell');
			expect(walls).toHaveLength(envelope.faces.filter(Boolean).length);
			for (const p of walls) {
				expect(p.token).toBe(BODY_TOKEN[house.composition.shellUse]);
				if (!p.finish) throw Error('Missing wall finish');
				const finish = resolveFinish(p.finish, p.token, p.ageTint, p.colourRole);
				if (finish.kind !== 'physical') throw Error('Expected physical wall finish');
				const optics = oberflaechenWerte(finish.recipe, finish.id);
				expect([optics.transmission, optics.deckkraft, optics.pigment]).toEqual([0, 1, 1]);
			}
		}
		const graph = massGraph(houses);
		expect(graph.collisions).toBe(0);
		expect(graph.components).toBeLessThanOrEqual(3);
		console.log('COURT ' + JSON.stringify({ court: court.court, houses: houses.length, ...graph }));
	});
}
