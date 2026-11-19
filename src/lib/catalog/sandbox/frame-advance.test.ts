// @ts-expect-error Bun provides the test API.
import { test, expect } from 'bun:test';
import { createSession } from './fixtures/client-session';
import { createFrameStudy, sizeFrameSites, applyEdit } from '../logic/sandbox';

test('the live advance publishes provisional axes while sizing is outstanding, then commits that snapshot once', async () => {
	const start = createFrameStudy().at(0, false);
	let finish: () => void = () => {
		throw new Error('Expected sizing to start');
	};
	const session = createSession(
		7,
		25,
		() => ({ world: start, additions: [], referenceCellId: undefined }),
		(sites) =>
			new Promise((resolve) => {
				finish = () => resolve(sizeFrameSites(sites));
			})
	);
	const events: string[] = [];
	session.onCompletion((e) => events.push(e.kind));
	session.advance();
	expect(events).toEqual([]);
	expect(session.world.state.year).toBe(start.state.year);
	expect(session.world.state.parts).toBe(start.state.parts);
	expect([...(session.world.state.frameBays?.values() ?? [])].some((b) => b.pending)).toBe(true);
	finish();
	await Promise.resolve();
	expect(events).toEqual(['advance']);
	expect(session.world.state).toEqual(applyEdit(start, { kind: 'advance' }).state);
	session.disposeInput();
});
