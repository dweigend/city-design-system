import { test, expect } from 'bun:test';
import assert from 'node:assert/strict';
import { createTerrain } from '../terrain';
import { deriveGrid } from '../terrain-grid';
import { seamAddress } from '../district-frame';
import { applyEdit, frameSurvey, EMPTY_STATE, type World } from './index';

test('seed 7 court at 47/40 retains a clear jamb and builds both frontages', () => {
	const grid = deriveGrid(createTerrain({ seed: 7 }));
	const square = grid.cells.filter(
		(c) => c.plan.square && Math.abs(c.column - 47) <= 2 && Math.abs(c.row - 40) <= 2
	);
	const neighbours = new Set(square.flatMap((c) => c.neighbors));
	const houses = grid.cells.filter((c) => neighbours.has(c.id) && c.buildable && !c.plan.square);
	let world: World = { grid, state: EMPTY_STATE, seed: 7, lines: [] };
	for (const house of houses)
		world = applyEdit(world, { kind: 'raise', cellId: house.id, use: 'living' });
	for (let i = 0; i < 3; i++) world = applyEdit(world, { kind: 'advance', years: 1 });
	const survey = frameSurvey(world, true);
	const access = seamAddress('47/40', '47/41').id;
	expect(survey.seams.get(access)?.opening).toBe('square-access');
	expect(world.state.frameBays?.get(access)?.built).toBeUndefined();
	for (const [left, right] of [
		['47/40', '48/40'],
		['48/40', '49/40']
	]) {
		const id = seamAddress(left, right).id;
		expect(world.state.frameBays?.get(id)?.built).toBe('main');
		const result = world.state.frameInstallations?.get(id)?.result;
		assert(result?.status === 'sized');
		const chord = result.rods.find((r) => r.id === '2');
		assert(chord);
	}
}, 30000);
