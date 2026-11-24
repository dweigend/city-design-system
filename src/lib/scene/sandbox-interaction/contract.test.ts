import { describe, expect, test } from 'bun:test';
import { defaults } from '../../../config/sandbox-interaction';
import { example } from './example';
import {
	createBuildQueue,
	createStrokeState,
	selectHouseDetail,
	shareBlockBudget,
	type StrokeInput
} from './index';

const tool = 'paint';
const hosts = (...ids: string[]) => ids.map((id) => ({ id }));
const input = (
	type: StrokeInput<{ id: string }>['type'],
	ids: string[] = [],
	pointer = 1
): StrokeInput<{ id: string }> => ({ type, pointer, hits: hosts(...ids), tool });

describe('sandbox interaction', () => {
	test('example paints three parcels and builds them in order across frames', () => {
		const { effects, frames, detail } = example();
		expect(effects.filter(({ kind }) => kind === 'enter').length).toBe(3);
		expect(frames).toEqual([['a', 'b'], ['c']]);
		expect(detail).toBe('relief');
	});

	test('stroke enters each host once at once, then keeps it on release', () => {
		const stroke = createStrokeState<{ id: string }>();
		expect(stroke.read(input('move', ['a']))).toEqual([{ kind: 'hover', host: { id: 'a' } }]);
		expect(stroke.read(input('down', ['a'])).map(({ kind }) => kind)).toEqual([
			'hover',
			'begin',
			'enter'
		]);
		const moved = stroke.read(input('move', ['a', 'b', 'b', 'c']));
		expect(moved.at(-1)).toEqual({ kind: 'enter', hosts: hosts('b', 'c'), tool });
		expect(stroke.read(input('move', ['b'], 2))).toEqual([]);
		expect(stroke.read(input('move', ['c'])).map(({ kind }) => kind)).toEqual(['hover']);
		expect(stroke.read(input('up', ['d'])).slice(1)).toEqual([
			{ kind: 'enter', hosts: hosts('d'), tool },
			{ kind: 'release', hosts: hosts('a', 'b', 'c', 'd'), tool }
		]);
		expect(stroke.isOpen()).toBe(false);
	});

	test('stroke reverts on cancel, keeps on a lost pointer and leaves to no host', () => {
		const stroke = createStrokeState<{ id: string }>();
		stroke.read(input('down', ['a']));
		expect(stroke.read(input('move', []))).toEqual([{ kind: 'hover', host: undefined }]);
		expect(stroke.read(input('cancel'))).toEqual([{ kind: 'cancel', hosts: hosts('a'), tool }]);
		expect(stroke.read(input('cancel'))).toEqual([]);
		stroke.read(input('down', ['b']));
		expect(stroke.read(input('lost'))).toEqual([{ kind: 'release', hosts: hosts('b'), tool }]);
		expect(stroke.read(input('up', ['c'])).map(({ kind }) => kind)).toEqual(['hover']);
	});

	test('queue keeps order within the budget, reuses keys and cancels cleanly', () => {
		let clock = 0;
		const runs: string[] = [];
		const queue = createBuildQueue<string>(2, () => clock);
		const job = (id: string, key = id) => ({
			id,
			key,
			run: () => (runs.push(key), (clock += 1.5), key)
		});
		for (const id of ['a', 'b', 'c', 'd']) queue.submit(job(id));
		queue.submit(job('b', 'b2'));
		queue.cancel('c');
		expect(queue.advance()).toEqual(['a', 'd']);
		expect(queue.read('b')).toBeUndefined();
		expect(queue.isWaiting('b')).toBe(true);
		expect(queue.advance()).toEqual(['b']);
		expect(runs).toEqual(['a', 'd', 'b2']);
		expect(queue.submit(job('b', 'b3'))).toBe(false);
		expect(queue.read('b')).toBe('b2');
		queue.advance();
		expect(queue.submit(job('b', 'b2'))).toBe(true);
		expect(queue.read('b')).toBe('b2');
		expect(queue.readWaiting()).toBe(0);
		expect(queue.read('c')).toBeUndefined();
	});

	test('queue builds the same products in the same order for the same submissions', () => {
		const run = () => {
			const built: string[][] = [];
			let clock = 0;
			const queue = createBuildQueue<number>(3, () => clock);
			for (const [index, id] of ['x', 'y', 'z', 'w'].entries())
				queue.submit({ id, key: id, run: () => ((clock += index + 1), index) });
			while (queue.readWaiting()) built.push(queue.advance());
			return built;
		};
		expect(run()).toEqual([['x', 'y'], ['z'], ['w']]);
		expect(run()).toEqual(run());
	});

	test('detail is flat by default and relief when emphasised or near in a close view', () => {
		const near = { id: 'a', block: 'b', distanceM: defaults.reliefRadiusM, emphasised: false };
		const close = { metersPerPixel: defaults.reliefMaxMetersPerPixel };
		const far = { metersPerPixel: defaults.reliefMaxMetersPerPixel * 2 };
		expect(selectHouseDetail(near, close)).toBe('relief');
		expect(selectHouseDetail(near, far)).toBe('flat');
		expect(selectHouseDetail({ ...near, distanceM: near.distanceM + 1 }, close)).toBe('flat');
		expect(selectHouseDetail({ ...near, distanceM: 1e6, emphasised: true }, far)).toBe('relief');
		const shares = shareBlockBudget(
			[
				{ id: 'a', block: 'n' },
				{ id: 'b', block: 'n' },
				{ id: 'c', block: 's' }
			],
			100
		);
		expect([...shares]).toEqual([
			['a', 50],
			['b', 50],
			['c', 100]
		]);
	});
});
