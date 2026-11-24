import { describe, expect, test } from 'bun:test';
import { example } from './example';
import {
	createBuildQueue,
	createStrokeDraft,
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
		expect(detail).toBe('near');
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

	test('draft keeps preview identity and resolves salience and budget only once on release', () => {
		const features = { storeys: 1, corner: false, large: false };
		const ordinary = { block: 'a', features, selected: false, hovered: false };
		const subjects = [{ ...ordinary, id: 'settled' }];
		const settled = subjects[0];
		const preview = { shape: 'plain body' };
		const draft = createStrokeDraft<(typeof subjects)[number], typeof preview>();
		let publications = 0;
		const publish = (edits: readonly (typeof subjects)[number][]) => {
			publications++;
			subjects.push(...edits);
			expect(selectHouseDetail(subjects, 0).size).toBe(3);
			expect([...shareBlockBudget(subjects, 90).values()]).toEqual([30, 30, 30]);
		};
		draft.add({ ...ordinary, id: 'cancelled' }, { id: 'cancelled', body: preview });
		draft.finish('cancel', publish);
		expect(publications).toBe(0);
		expect(subjects).toEqual([settled]);
		expect(draft.overrides.size).toBe(0);
		draft.add({ ...ordinary, id: 'first' }, { id: 'first', body: preview });
		draft.add({ ...ordinary, id: 'second' });
		expect(draft.overrides.get('first')).toBe(preview);
		expect(subjects[0]).toBe(settled);
		expect(publications).toBe(0);
		draft.finish('release', publish);
		draft.finish('release', publish);
		expect(publications).toBe(1);
		expect(subjects.map(({ id }) => id)).toEqual(['settled', 'first', 'second']);
	});

	test('queue keeps order within the budget, reuses keys and cancels cleanly', () => {
		let clock = 0;
		const runs: string[] = [];
		const queue = createBuildQueue<string>(() => clock, 2);
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
			const queue = createBuildQueue<number>(() => clock, 3);
			for (const [index, id] of ['x', 'y', 'z', 'w'].entries())
				queue.submit({ id, key: id, run: () => ((clock += index + 1), index) });
			while (queue.readWaiting()) built.push(queue.advance());
			return built;
		};
		expect(run()).toEqual([['x', 'y'], ['z'], ['w']]);
		expect(run()).toEqual(run());
	});

	test('detail grants near to the selected and hovered houses and keeps ordinary stock plain', () => {
		const subject = { block: 'n', features: { storeys: 1, corner: false, large: false } };
		const subjects = Array.from({ length: 8 }, (_, i) => ({
			...subject,
			id: String(i),
			selected: i === 0,
			hovered: i === 1
		}));
		const levels = selectHouseDetail(subjects, 0);
		expect(levels.get('0')).toBe('near');
		expect(levels.get('1')).toBe('near');
		expect([...levels.values()].filter((level) => level === 'plain')).toHaveLength(3);
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
