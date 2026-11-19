import { expect, test } from 'bun:test';
import { MAX_STORIES } from '../logic/house-brush';
import { createWorld } from '../logic/sandbox';
import { createSession } from './fixtures/client-session.fixture.test';
import { rejectionMessage } from './feedback';

test('scrubbing restores the painted generation and returning to the latest preserves undo', () => {
	const session = createSession(7, 25, (seed) => ({
		world: createWorld(seed, { cells: 0 }),
		additions: [],
		referenceCellId: undefined
	}));
	session.strokeStart('79/44');
	const release = session.strokeRelease();
	if (!release) throw new Error('Expected a Body stroke');
	session.commitRelease(release);
	const painted = session.world;
	expect(painted.state.stacks.get('79/44')).toEqual(['living']);

	for (let tick = 0; tick < 4; tick++) session.advance();
	const current = session.world;
	expect(current.state.year).toBe(2126);
	expect(session.timelineWindow).toEqual({ min: 2026, max: 2126 });

	session.reviewYear(2026);
	expect(session.world).toBe(painted);
	expect(session.viewingPast).toBe(true);
	session.strokeStart('79/44');
	expect(session.strokeRelease()).toBeUndefined();
	session.advance();
	expect(session.timelineState.year).toBe(2126);

	session.reviewYear(2090);
	expect(session.world.state.year).toBe(2101);
	session.reviewYear(2126);
	expect(session.world).toBe(current);
	expect(session.viewingPast).toBe(false);

	session.undo();
	expect(session.world.state.year).toBe(2101);
	session.redo();
	session.reviewYear(2026);
	expect(session.world).toBe(painted);
	session.reviewYear(2126);
	session.advance();
	expect(session.shownYear).toBe(2151);
	session.restart();
	expect(session.viewingPast).toBe(false);
	expect(session.world.seed).toBe(8);
});

test('the height-limit feedback names the grammar cap', () => {
	expect(rejectionMessage('story-limit')).toBe(
		`Height limit reached. Each plot can hold ${MAX_STORIES} stories.`
	);
});
