import { buildObject } from '../assets';
import { test, expect } from 'bun:test';
import { checkFit, type FitPart } from './index';
import type { HouseSlot } from './index';
type Point = HouseSlot['position'];
const box = (id: string, position: Point, size: Point = [1, 1, 1]): FitPart => ({
	id,
	kind: 'box',
	position,
	size,
	role: 'neu',
	slot: 'frame'
});
test('20 mm seat and penetration tolerances are inclusive', () => {
	const floor = box('floor', [0, 0, 0]);
	for (const z of [0.98, 1, 1.02]) expect(checkFit([floor, box('top', [0, 0, z])])).toEqual([]);
	expect(checkFit([floor, box('top', [0, 0, 0.979])]).map((f) => f.code)).toContain('intersects');
	expect(checkFit([floor, box('top', [0, 0, 1.021])]).map((f) => f.code)).toContain('floating');
});
test('post head, capsule socket and native dimensions are independent obligations', () => {
	const foot = box('foot', [0, 0, 0]);
	const top = box('body', [0, 0, 1]);
	expect(checkFit([{ ...foot, joint: 'head' }, top]).map((f) => f.code)).toContain('post-end');
	expect(checkFit([foot, { ...top, joint: 'capsule' }]).map((f) => f.code)).toContain(
		'missing-socket'
	);
	expect(
		checkFit([
			{ ...foot, joint: 'socket' },
			{ ...top, joint: 'capsule', scale: [1, 1, 1], nativeSize: [1, 1, 1] }
		])
	).toEqual([]);
	for (const scale of [
		[0.84, 0.84, 0.84],
		[1.16, 1.16, 1.16],
		[1, 1.1, 1]
	] as Point[])
		expect(checkFit([{ ...foot, scale }]).map((f) => f.code)).toContain('rigid-scale');
	expect(
		checkFit([{ ...top, scale: [1, 1, 1], nativeSize: [1, 2, 1] }]).map((f) => f.code)
	).toContain('rigid-scale');
});
test('courtyard holes and a rotated narrow beam cannot create fictitious bearings', () => {
	const deck: FitPart = {
		id: 'court',
		kind: 'prism',
		role: 'neu',
		slot: 'deck',
		polygon: [
			[0, 0],
			[6, 0],
			[6, 6],
			[0, 6]
		],
		holes: [
			[
				[1, 1],
				[1, 5],
				[5, 5],
				[5, 1]
			]
		],
		z: 0,
		height: 1
	};
	expect(checkFit([deck, box('court visitor', [2, 2, 0])])).toEqual([]);
	expect(checkFit([deck, box('missing bearing', [2, 2, 1])]).map((f) => f.code)).toEqual([
		'floating'
	]);
	const rotated = { ...box('beam', [0, 0, 0], [4, 0.1, 0.2]), rotation: Math.PI / 4 } as FitPart;
	expect(
		checkFit([rotated, box('over void', [1, 1, 0.2], [0.1, 0.1, 0.1])]).map((f) => f.code)
	).toEqual(['floating']);
});
test('a stretched registry member can be diagnosed from its source address alone', () => {
	const parts = buildObject('living-capsule', 'studio', 41).parts;
	const index = parts.findIndex((p) => p.kind === 'capsule');
	const member = parts[index];
	if (member?.kind !== 'capsule') throw Error('Expected a capsule shell');
	const source = { objectId: 'living-capsule', variant: 'studio', seed: 41, member: index };
	const { from, to } = member;
	const stretched = from.map((v, k) => v + 3 * (to[k] - v)) as typeof to;
	expect(checkFit([{ ...member, source }]).map((f) => f.code)).not.toContain('rigid-scale');
	expect(checkFit([{ ...member, source, to: stretched }]).map((f) => f.code)).toContain(
		'rigid-scale'
	);
});

test('ground seats and supports directly under a body must transmit load', () => {
	const base = { ...box('first', [0, 0, 0]), structuralRole: 'bearing' as const };
	const rim = {
		...box('second', [0, 0, 1]),
		structuralRole: 'bearing' as const,
		joint: 'deck' as const
	};
	const body = {
		...box('third', [0, 0, 2]),
		structuralRole: 'cantilever' as const,
		joint: 'body' as const
	};
	expect(checkFit([base, rim, body])).toEqual([]);
	for (const index of [0, 1]) {
		const parts = [base, rim, body].map((p, i) =>
			i === index ? { ...p, structuralRole: 'cantilever' as const } : p
		);
		expect(checkFit(parts)).toEqual([{ code: 'bearing-role', part: parts[index].id }]);
	}
});
