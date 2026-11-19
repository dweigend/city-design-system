import { expect, spyOn, test } from 'bun:test';
import * as sandbox from '../logic/sandbox';
import { connectKernel } from './connect-kernel';
import { gestureDriver } from './fixtures/serial-gesture.fixture.test';

const house = { kind: 'house', use: 'living' } as const;

test('Advance in the failing survey callback preserves the warning until an accepted stroke', () => {
	const d = gestureDriver();
	const planner = spyOn(sandbox, 'planStroke').mockImplementationOnce(() => {
		throw new Error('Injected survey exception before Advance');
	});
	try {
		d.stroke(house, '80/44');
		d.session.advance();
		d.finish();
		expect(d.world().state.year).toBe(2051);
		expect(d.session.failure?.reason).toBe('stroke-failed');
		expect(d.events.map(({ kind }) => kind)).toEqual(['advance']);
		d.session.togglePlan();
		d.session.tool = { kind: 'dig' };
		expect(d.session.failure?.reason).toBe('stroke-failed');
		d.stroke(house, '81/44');
		d.finish();
		expect(d.session.failure).toBeUndefined();
	} finally {
		planner.mockRestore();
		d.dispose();
	}
});

for (const phase of ['survey', 'commit'] as const) {
	test(`a ${phase} exception rejects the stroke and replays the buffered tap`, () => {
		const d = gestureDriver();
		const planStroke = sandbox.planStroke;
		const planner = spyOn(sandbox, 'planStroke').mockImplementationOnce(
			(...args: Parameters<typeof planStroke>) => {
				const fail = () => {
					throw new Error(`Injected ${phase} exception`);
				};
				if (phase === 'survey') return fail();
				return { ...planStroke(...args), outcome: fail };
			}
		);
		try {
			d.stroke(house, '80/44');
			d.stroke(house, '81/44');
			d.finish();
			expect(d.session.failure?.reason).toBe('stroke-failed');
			expect(d.world().state.stacks.has('80/44')).toBe(false);
			expect(d.waiting()?.cellIds).toEqual(['81/44']);
			expect(d.events).toEqual([]);
			d.finish();
			expect(d.session.failure).toBeUndefined();
			expect(d.session.hasPendingStroke).toBe(false);
			expect(d.world().state.stacks.has('81/44')).toBe(true);
			expect(d.events.map(({ cellIds }) => cellIds)).toEqual([['81/44']]);
		} finally {
			planner.mockRestore();
			d.dispose();
		}
	});
}

for (const mode of ['synchronous throw', 'rejected promise'] as const) {
	test(`kernel startup ${mode} is reported without blocking queued input`, async () => {
		const d = gestureDriver();
		try {
			d.stroke(house, '80/44');
			const failure = new Error('Injected kernel startup error');
			await connectKernel(
				() => {
					if (mode === 'synchronous throw') throw failure;
					return Promise.reject(failure);
				},
				() => true,
				d.session.setRoofBuilder,
				d.session.reportKernelFailure
			);
			d.stroke(house, '81/44');
			d.finish();
			expect(d.session.failure?.reason).toBe('kernel-start-failed');
			expect(d.world().roofBuilder).toBeUndefined();
			d.finish();
			expect(d.session.hasPendingStroke).toBe(false);
			expect(d.events.map(({ cellIds }) => cellIds)).toEqual([['80/44'], ['81/44']]);
		} finally {
			d.dispose();
		}
	});
}

for (const type of ['pointercancel', 'lostpointercapture'] as const) {
	test(`${type} releases controls held during a stroke`, () => {
		const d = gestureDriver();
		try {
			const year = d.world().state.year;
			d.down('80/44');
			d.session.advance();
			expect(d.world().state.year).toBe(year);
			d.pointer(type, '80/44');
			expect(d.session.gesture).toBeUndefined();
			expect(d.session.hasPendingStroke).toBe(false);
			expect(d.world().state.year).toBeGreaterThan(year);
			expect(d.events.map(({ kind }) => kind)).toEqual(['advance']);
			d.stroke(house, '81/44');
			d.finish();
			expect(d.events.map(({ kind }) => kind)).toEqual(['advance', 'house']);
		} finally {
			d.dispose();
		}
	});
}

test('disposing clears the pending release and drops its buffered input', () => {
	const d = gestureDriver();
	d.stroke(house, '80/44');
	d.stroke(house, '81/44');
	const release = d.waiting();
	if (!release) throw new Error('Expected a pending stroke');
	d.dispose();
	d.session.commitRelease(release);
	expect(d.session.hasPendingStroke).toBe(false);
	expect(d.session.gesture).toBeUndefined();
	expect(d.events).toEqual([]);
});
