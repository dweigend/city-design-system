import assert from 'node:assert/strict';
import { expect, test } from 'bun:test';
import { openingScene, prepareAdvance, withState, cityCentreView, applyEdit } from './index';
import { styleWeightsAt } from '../city-plan';
import { weightedForm } from '../../core/neighbourhood';
import { stylesForYear } from './state';

test('the editable seed-7 city builds the district draw, retains player lots and replays its next cohort', () => {
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
	expect(next.state.cityStages).toEqual(cityStages.map((stage) => stage + 1));
	expect(advance().state.storyParts).toEqual(next.state.storyParts);
	expect(withState(next, opening.state).state).toBe(opening.state);
	for (const [id, parts] of next.state.storyParts) {
		if (protectedWorld.state.storyParts.has(id)) continue;
		const cell = next.grid.cellsById.get(id);
		assert(cell);
		const w = styleWeightsAt(city, cell.id);
		let end = 0;
		const choices = stylesForYear(next.state.year).map((form) => ({
			form,
			end: (end += w[form as keyof typeof w] ?? 0)
		}));
		const method = weightedForm(choices, next.seed, id, 'city-house-style');
		expect(parts.every((p) => p.style === method && p.built === next.state.year)).toBe(true);
	}
	expect(next.state.storyParts.get(occupied)).toBe(protectedWorld.state.storyParts.get(occupied));
}, 120000);

test('each editable valley projects its registered landmarks and seeds every growth area', () => {
	for (let seed = 0; seed < 10; seed++) {
		const { world } = openingScene(seed);
		const city = world.state.city;
		assert(city);
		const forms = cityCentreView(world);
		for (const [a, b] of city.corridors) {
			const line = world.lines.find((line) => line.cellIds[0] === a && line.cellIds[1] === b);
			assert(line);
			expect(forms.some((part) => part.id.startsWith('city-walk/' + line.id + '/'))).toBe(true);
		}
		for (const centre of city.centres) {
			expect(forms.some((part) => part.id.startsWith('centre/' + centre.cellId + '/'))).toBe(true);
			expect(centre.lots.some((id) => world.state.stacks.has(id))).toBe(true);
		}
	}
}, 60000);
