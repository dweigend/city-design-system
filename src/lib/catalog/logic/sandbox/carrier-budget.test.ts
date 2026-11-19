import { expect, test } from 'bun:test';
import { tenRoofStroke } from './fixtures/carrier-budget.fixture.test';

test('a ten-roof stroke records seam intent without replacing the houses', () => {
	const { stroke } = tenRoofStroke();
	expect(stroke.failure).toBeUndefined();
	expect(stroke.draft.state.frameTimeline?.goals.length).toBeGreaterThan(0);
	expect(stroke.draft.state.stacks).toBe(stroke.base.state.stacks);
	expect(stroke.draft.state.parts).toBe(stroke.base.state.parts);
});
