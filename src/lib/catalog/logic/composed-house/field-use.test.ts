import { expect, test } from 'bun:test';
import { BODY_TOKEN } from '../../data/house-body';
import { projectBuildingSurface } from '../../scene/building-surface';
import { openingScene } from '../sandbox';
import { townSections } from '../sandbox/composed-projection';
import { fieldUse, sectionParts } from './index';

test('seed-seven opening: every house wears a use it contains, and courts mix their fields', () => {
	const { sections } = townSections(openingScene(7).world);
	const courts = new Map<string, Set<string>>();
	for (const house of sections) {
		const field = fieldUse(house);
		expect(house.decks.flatMap((deck) => deck.programme)).toContain(field);
		expect(fieldUse(house)).toBe(field);
		courts.set(house.ensemble, (courts.get(house.ensemble) ?? new Set()).add(field));
		const envelope = sectionParts(house).filter(
			(part) => part.source.objectId === 'full-height-shell' && !part.finish
		);
		for (const part of envelope)
			if (
				part.buildingSurface?.slot === 'shell' &&
				house.composition.structure.principle === 'layers'
			)
				expect(projectBuildingSurface(part).token, part.id).toBe(BODY_TOKEN[field]);
	}
	const mixed = [...courts.values()].filter((fields) => fields.size >= 2);
	expect(mixed.length).toBeGreaterThanOrEqual(Math.ceil(courts.size / 2));
	expect(
		new Set([...courts.values()].flatMap((fields) => [...fields])).size
	).toBeGreaterThanOrEqual(3);
}, 60000);
