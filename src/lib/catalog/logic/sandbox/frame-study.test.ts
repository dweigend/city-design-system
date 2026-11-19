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
	expect(change.phases[0].seam).toBeNull();
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
