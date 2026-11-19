import { test, expect } from 'bun:test';
import assert from 'node:assert/strict';
import { createTerrain } from '../terrain';
import { deriveGrid } from '../terrain-grid';
import { seamAddress } from '../district-frame';
import { applyEdit, frameSurvey, EMPTY_STATE, type World } from './index';
import { physicalRuns } from './frame-runs';

test('seed 7 court at 47/40 retains a clear jamb and reports the join between its built frontages', () => {
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
	const chords = ['47/40', '48/40'].map((v, i) => {
		const id = seamAddress(v, 48 + i + '/40').id;
		expect(world.state.frameBays?.get(id)?.built).toBe('main');
		const result = world.state.frameInstallations?.get(id)?.result;
		assert(result?.status === 'sized');
		const chord = result.rods.find((r) => r.id === '2');
		assert(chord);
		return {...chord,sizing:result.sizing};
	});
	const [a, b] = chords;
	const closest = Math.min(
		...[a.a, a.b].flatMap((p) =>
			[b.a, b.b].map((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]))
		)
	);
	const court = new Set(
		[...survey.seams.values()]
			.filter((s) => s.use === 'court' && world.state.frameBays?.get(s.id)?.built === 'main')
			.map((s) => s.id)
	);
	const { longestRun } = physicalRuns(court, world.state.frameInstallations);
	console.info(
		'COURT ' +
			JSON.stringify({
				seed: 7,
				dates: 3,
				houses: houses.map((h) => h.id),
				access,
				main: court.size,
				longestRun,
				joinGapM: closest,
				crownHeightDifferenceM: Math.abs(a.a[2]-b.a[2]),
				sizing: chords.map(r=>r.sizing),
				chordDiametersM: chords.map((r) => r.diameter)
			})
	);
}, 30000);
