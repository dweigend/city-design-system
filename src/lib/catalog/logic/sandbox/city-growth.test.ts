import assert from 'node:assert/strict';
import { expect, test } from 'bun:test';
import { openingScene, prepareAdvance, withState, cityCentreView, applyEdit } from './index';
test('the editable seed-7 city extends the low court wings, retains player lots and replays its next cohort', () => {
	const opening = openingScene(7).world;
	const { city, cityStages } = opening.state;
	assert(city && cityStages);
	expect(cityCentreView(opening).length).toBeGreaterThan(city.centres.length);
	expect(cityStages[0]).toBeGreaterThan(cityStages[1]);
	const occupied = city.centres[1].ensembles[0].lots[3];
	const protectedWorld = applyEdit(opening, {
		kind: 'raise',
		cellId: occupied,
		use: 'water',
		style: 'totem'
	});
	const advance = () => prepareAdvance(protectedWorld).finish(new Map());
	const next = advance();
	expect(next.state.stacks.size).toBeGreaterThan(opening.state.stacks.size);
	for (const cellId of protectedWorld.state.stacks.keys()) {
		expect(next.state.stacks.has(cellId)).toBe(true);
	}
	expect(next.state.cityStages).toEqual(cityStages.map((stage) => stage + 1));
	expect(advance().state.storyParts).toEqual(next.state.storyParts);
	expect(withState(next, opening.state).state).toBe(opening.state);
	for (const [id, parts] of next.state.storyParts) {
		if (protectedWorld.state.storyParts.has(id)) continue;
		expect(parts.every((p) => p.style === 'composed' && p.built === next.state.year)).toBe(true);
	}
	expect(next.state.storyParts.get(occupied)).toBe(protectedWorld.state.storyParts.get(occupied));
}, 120000);

test('each editable valley projects its registered landmarks and seeds every growth area', () => {
	for (let seed = 0; seed < 10; seed++) {
		const { world } = openingScene(seed);
		const city = world.state.city;
		assert(city);
		const forms = cityCentreView(world);
		expect(forms.some((part) => part.id.startsWith('town-walk/'))).toBe(true);
		for (const centre of city.centres) {
			expect(forms.some((part) => part.id.startsWith('centre/' + centre.cellId + '/'))).toBe(true);
			expect(centre.lots.some((id) => world.state.stacks.has(id))).toBe(true);
		}
	}
}, 60000);
