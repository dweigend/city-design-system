import { expect, test } from 'bun:test';
import { example } from './example';
import { createFrameBayObject, portalExample } from './index';

test('builds the standalone frame and an addressed subset with metric support anchors', () => {
	const { frame, oneMember } = example();
	expect(frame.parts.map(({ slot }) => slot)).toContain('column/heavy');
	expect(frame.anchors.every(({ position }) => position[2] === 0)).toBe(true);
	expect(frame.anchors.length).toBeGreaterThan(0);
	expect(oneMember.parts).toHaveLength(1);
	expect(() =>
		createFrameBayObject('bad', portalExample().graph, { memberIds: ['missing'] })
	).toThrow(RangeError);
});
