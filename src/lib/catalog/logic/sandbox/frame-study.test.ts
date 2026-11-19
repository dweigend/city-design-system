// @ts-expect-error Bun supplies the test API at runtime.
import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { createFrameStudy } from './frame-study';

test('the sandbox timeline builds the forecast frontage, or reserves it from the first checkpoint', () => {
	const study = createFrameStudy();
	const first = study.at(1, false);
	const planned = first.state.frameTimeline?.results[0];
	assert(planned);
	const entrance = planned.phases[0].seam;
	assert(entrance);
	expect(planned.phases[1]).toEqual({ tick: 2, seam: entrance });
	expect(study.at(1, true)).toBe(first);
	const original = study.at(2, false);
	const revised = study.at(2, true);
	const change = revised.state.frameTimeline?.results[0];
	assert(change);
	expect(change.goal).toBe(planned.goal);
	expect(change.assumptions).toContainEqual({ seam: entrance, from: 3, reason: 'court-access' });
	expect(change.phases[0].seam).toBe(first.state.frameTimeline?.goals[0].alternatives[0]);
	expect(original.state.frameBays?.get(entrance)?.built).toBe('main');
	expect(study.at(4, true).state.frameBays?.get(entrance)?.built).toBeUndefined();
	expect(original.state.parts.size).toBeGreaterThan(first.state.parts.size);
	expect(revised.state.parts.size).toBeGreaterThan(first.state.parts.size);
	expect(revised.grid).toBe(first.grid);
	expect(revised.state.stacks).toBe(first.state.stacks);
	expect(study.at(2, false)).toBe(original);
	expect(createFrameStudy().at(4, true).state.frameTimeline).toEqual(
		study.at(4, true).state.frameTimeline
	);
});

import { applyEdit, runFrameTimeline } from './index';

test('game, replay and prediction retain the same tick, year and installed sections across schedules', () => {
	const study = createFrameStudy(),
		start = study.at(0, false);
	for (const years of [1, 2, 7, 25, 42]) {
		const one = applyEdit(start, { kind: 'advance', years }),
			two = applyEdit(one, { kind: 'advance', years });
		const replay = runFrameTimeline(start, 2, undefined, years === 25 ? undefined : years);
		expect(replay.checkpoints[2].state.parts).toEqual(two.state.parts);
		const bay = two.state.frameBays?.get(study.entrance);
		expect(bay).toMatchObject({ builtTick: 2, builtYear: start.state.year + 2 * years });
		expect(one.state.frameTimeline?.results[0].consequences[1].stock).toContainEqual({
			id: study.entrance,
			...bay
		});
		const erased = applyEdit(two, { kind: 'clear', cellId: study.parcel });
		expect(erased.state.frameTimeline?.goals).toHaveLength(0);
		const later = runFrameTimeline(erased, 3, undefined, years).checkpoints[3];
		expect(later.state.frameBays?.get(study.entrance)?.built).toBeUndefined();
		expect(later.state.frameIntents?.get(study.entrance)).toBe('gap');
	}
	const reserved = applyEdit(study.at(2, true), { kind: 'clear', cellId: study.parcel });
	expect(reserved.state.frameTimeline?.controls.observations).toHaveLength(0);
});
