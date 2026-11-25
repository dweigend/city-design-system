import { describe, expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import { createCellSpace } from '../../domain/cell-space';
import type { CameraRay } from '../stage';
import { example } from './example';
import {
	createBuildQueue,
	createStrokeDraft,
	createStrokeState,
	createVerticalStroke,
	readFineCell,
	readOccupiedCell,
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

const space = createCellSpace(
	{
		id: 'parcel',
		corners: [
			{ id: 'a', position: [0, 0] },
			{ id: 'b', position: [4, 0] },
			{ id: 'c', position: [4, 4] },
			{ id: 'd', position: [0, 4] }
		],
		frontage: [],
		baseZ: 10,
		datumIndex: 6,
		storeyCount: 4,
		storeyHeightsM: [2, 5, 3, 6]
	},
	0
);
const cell = space.cells[0];
const stock = [{ id: cell.id, role: 'wing', fromStorey: 0, toStorey: 2 }] as const;
const target = {
	cell,
	center: [1, 1] as const,
	storeys: space.storeys.filter(({ cellId }) => cellId === cell.id)
};
const rayAt = (height: number): CameraRay => ({
	origin: [-9, 1, height + 7.5],
	direction: [0.8, 0, -0.6]
});
const planRay: CameraRay = { origin: [1, 1, 50], direction: [0, 0, -1] };

test('picks the visible fine-cell volume before ground and uses the plan cell at ground', () => {
	expect(readOccupiedCell(space, stock, rayAt(13.5), 20)).toEqual({
		cell,
		distance: 11.25
	});
	expect(readOccupiedCell(space, stock, rayAt(13.5), 10)).toBeUndefined();
	expect(readOccupiedCell(space, stock, planRay, Infinity)).toEqual({ cell, distance: 33 });
	expect(readFineCell(space, [3, 1])).toBe(space.cells[1]);
	expect(readFineCell(space, [5, 1])).toBeUndefined();
});

test('fast and slow drags cross the same mixed-height storeys, including the first above stock', () => {
	const fast = required(createVerticalStroke(target, rayAt(11)), 'fast stroke');
	const slow = required(createVerticalStroke(target, rayAt(11)), 'slow stroke');
	const datums = (storeys: ReturnType<typeof fast>) => storeys?.map(({ datumIndex }) => datumIndex);
	expect(datums(slow(rayAt(15)))).toEqual([6, 7]);
	const swept = fast(rayAt(17));
	expect(datums(swept)).toEqual([6, 7, 8]);
	expect(swept?.at(-1)?.storey).toBe(stock[0].toStorey);
	expect(slow(rayAt(17))).toEqual(swept);
	expect(datums(slow(rayAt(13)))).toEqual([6, 7]);
});

test('orders downward drags from the press and clips to the available stack', () => {
	const sweep = required(createVerticalStroke(target, rayAt(24)), 'downward stroke');
	expect(sweep(rayAt(8))?.map(({ datumIndex }) => datumIndex)).toEqual([9, 8, 7, 6]);
	expect(sweep(rayAt(40))?.map(({ datumIndex }) => datumIndex)).toEqual([9]);
	const above = required(createVerticalStroke(target, rayAt(26)), 'roof-height stroke');
	expect(above(rayAt(50))).toEqual([]);
});

test('rejects edge-on and backward intersections', () => {
	expect(createVerticalStroke(target, planRay)).toBeUndefined();
	expect(
		createVerticalStroke(target, { origin: [2, 1, 15], direction: [1, 0, 0] })
	).toBeUndefined();
	const sweep = required(createVerticalStroke(target, rayAt(15)), 'oblique stroke');
	expect(sweep(planRay)).toBeUndefined();
});
