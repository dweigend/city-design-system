// @ts-expect-error Bun provides these APIs at runtime.
import { expect, test } from 'bun:test';
import { canonicalChanges, stateChanges } from './state-delta';

const delta = (before: unknown, after: unknown) => canonicalChanges(stateChanges(before, after));

test('canonicalization includes new persisted fields without a schema change', () => {
	const before = { future: new Map([['cell', { mode: 'survey', volume: 2 }]]) };
	const after = { future: new Map([['cell', { volume: 4, mode: 'survey', enabled: true }]]) };
	const ordered = { future: new Map([['cell', { enabled: true, mode: 'survey', volume: 4 }]]) };
	expect(delta(before, after)).toBe(delta(before, ordered));
	expect(delta(before, after)).not.toBe(delta(before, before));
	expect(delta(before, after)).not.toBe(
		delta(before, {
			future: new Map([['cell', { volume: 4, mode: 'survey', enabled: false }]])
		})
	);
	expect(delta({}, { future: null })).not.toBe(delta({}, {}));
	expect(delta({}, { future: undefined })).not.toBe(delta({}, { future: null }));
	expect(delta({}, { future: undefined })).not.toBe(delta({}, {}));
	expect(delta({ key: 1 }, new Map([['key', 1]]))).not.toBe(delta({}, {}));
});

test('linked installation IDs and allocator offsets do not affect the write delta', () => {
	function record(action: number, material: number, restoredYear = 2026) {
		const before = { nextAction: action, store: { material }, parts: new Map() };
		const id = `p/${action}/0`;
		const after = {
			nextAction: action + 1,
			store: { material: material - 1 },
			parts: new Map([
				[id, { id, owner: `c/${action}`, built: restoredYear }],
				[`p/${action}/1`, { attachedTo: id, materials: { material: 1 } }]
			])
		};
		return delta(before, after);
	}
	expect(record(8, 2)).toBe(record(43, 20));
	expect(record(8, 2)).not.toBe(record(8, 2, 2051));
});

test('ordered state writes retain append order and multiplicity', () => {
	expect(delta([], ['a', 'b'])).not.toBe(delta([], ['b', 'a']));
	expect(delta([], ['a', 'a'])).not.toBe(delta([], ['a']));
	expect(delta(['a'], ['a', 'b'])).toBe(delta(['c', 'a'], ['c', 'a', 'b']));
	expect(delta(['a', 'b'], ['b', 'a'])).not.toBe(delta(['a', 'b'], ['a', 'b']));
	expect(delta(['a', 'b', 'a'], ['a', 'b'])).not.toBe(delta(['a', 'b', 'a'], ['b', 'a']));
});

test('renumbered restored parts keep the same deletion delta and retain their links', () => {
	function installed(first: number, second: number, attachedTo = first) {
		const a = `p/${first}/0`;
		const b = `p/${second}/0`;
		return {
			parts: new Map([
				[a, { id: a, anchor: '80/44' }],
				[b, { id: b, anchor: '81/44', attachedTo: `p/${attachedTo}/0` }]
			])
		};
	}
	const empty = { parts: new Map() };
	expect(delta(installed(1, 12), empty)).toBe(delta(installed(96, 10), empty));
	expect(delta(installed(1, 12), empty)).not.toBe(delta(installed(96, 10, 10), empty));
});
