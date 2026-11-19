import { test, expect } from 'bun:test';
import { createSession } from './fixtures/client-session.fixture.test';
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

test('a failed sizing worker still commits the supported pair on the same date', async () => {
	const study = createFrameStudy();
	const start = study.at(1, false);
	const session = createSession(
		7,
		25,
		() => ({ world: start, additions: [], referenceCellId: undefined }),
		() => Promise.reject(new Error('unavailable'))
	);
	session.advance();
	await Promise.resolve();
	expect(session.world.state.frameBays).toEqual(study.at(2, false).state.frameBays);
	const result = session.world.state.frameInstallations?.get(study.entrance)?.result;
	expect(result).toMatchObject({ status: 'sized', sizing: 'nominal' });
	session.disposeInput();
});
