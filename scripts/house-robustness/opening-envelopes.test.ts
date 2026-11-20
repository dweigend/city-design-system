import { expect, test } from 'bun:test';
import { openingScene } from '../../src/lib/catalog/logic/sandbox';
import { townSections } from '../../src/lib/catalog/logic/sandbox/composed-projection';
import { sectionParts } from '../../src/lib/catalog/logic/composed-house';
import { checkParcel } from '../../src/lib/catalog/logic/composed-house/parcel-assertions.test-support';
import { massGraph } from './masses';

const world = openingScene(7).world;
const { sections, layout } = townSections(world);
if (!world.state.city) throw Error('Missing opening city');
for (const court of world.state.city.centres.flatMap((c) => c.ensembles)) {
	const houses = sections.filter((h) => layout.cells.get(h.cells[0].id)?.id === court.court);
	if (!houses.length) continue;
	test('continuous envelopes in opening court ' + court.court, () => {
		for (const house of houses) {
			const parts = sectionParts(house);
			checkParcel(house, parts);
			const envelope = house.composition.exterior;
			if (!envelope) throw Error('Missing full-height envelope on ' + house.id);
			expect(envelope.bottom).toBe(house.composition.ground);
			expect(envelope.top).toBe(house.top);
			expect(parts.filter((p) => p.source.objectId === 'full-height-shell')).toHaveLength(
				envelope.faces.filter(Boolean).length
			);
		}
		const graph = massGraph(houses);
		expect(graph.collisions).toBe(0);
		expect(graph.components).toBeLessThanOrEqual(3);
		console.log('COURT ' + JSON.stringify({ court: court.court, houses: houses.length, ...graph }));
	});
}
