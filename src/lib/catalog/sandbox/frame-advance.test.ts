import { test, expect } from 'bun:test';
import { createSession } from './fixtures/client-session.fixture.test';
import { createFrameStudy, sizeFrameSites, applyEdit, setFutureTarget } from '../logic/sandbox';
import { advanceMessage } from './feedback';

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
	session.toggleSpongeCity();
	expect(session.spongeCity).toBe(false);
	expect(events).toEqual([]);
	expect(session.world.state.year).toBe(start.state.year);
	expect(session.world.state.parts).toBe(start.state.parts);
	expect([...(session.world.state.frameBays?.values() ?? [])].some((b) => b.pending)).toBe(true);
	finish();
	await Promise.resolve();
	expect(events).toEqual(['advance']);
	const advanced = applyEdit(start, { kind: 'advance' }).state;
	expect(session.spongeCity).toBe(true);
	expect(session.world.state).toEqual({ ...advanced, futureTarget: 'sponge-city' });
	session.undo();
	expect(session.spongeCity).toBe(false);
	expect(session.world.state).toEqual(advanced);
	session.redo();
	expect(session.spongeCity).toBe(true);
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

test('the advance message counts only the works committed by the latest advance', () => {
	const start = setFutureTarget(createFrameStudy().at(0, false), 'sponge-city');
	const session = createSession(7, 25, () => ({
		world: start,
		additions: [],
		referenceCellId: undefined
	}));
	expect(advanceMessage(session.completion)).toBeUndefined();
	session.advance();
	expect(advanceMessage(session.completion)).toContain(
		'1 tank, 1 retention basin, 1 green roof, 1 water square'
	);
	session.undo();
	expect(advanceMessage(session.completion)).toBeUndefined();
	session.disposeInput();
});
