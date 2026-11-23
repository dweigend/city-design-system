import { expect, test } from 'bun:test';
import { example } from './example';
import {
	displayLevels,
	focusChoices,
	offerFocus,
	readFocusChoice,
	readFocusLevel,
	stockPencilShare,
	subsystems
} from './index';

test('every subsystem has one of the five levels under every focus choice', () => {
	for (const subsystem of subsystems)
		for (const choice of focusChoices)
			expect(displayLevels).toContain(readFocusLevel(choice, subsystem));
	expect(stockPencilShare).toBeCloseTo(1 / 6);
});

test('All draws everything in full and a single kind keeps the others see-through', () => {
	for (const subsystem of subsystems) expect(readFocusLevel('all', subsystem)).toBe('full');
	expect(readFocusLevel('center', 'center')).toBe('full');
	expect(readFocusLevel('center', 'block')).toBe('transparent');
	expect(readFocusLevel('lattice', 'detached')).toBe('transparent');
	for (const choice of focusChoices) expect(readFocusLevel(choice, 'terrain')).toBe('full');
});

test('offers only choices with a present subject and drops drawings it already offers', () => {
	expect(example()).toEqual({
		offered: ['all', 'districts', 'block', 'detached', 'lattice', 'height', 'landscape'],
		latticeInBlocks: 'hidden'
	});
	// Without a lattice, Districts draws exactly like All.
	expect(offerFocus(['terrain', 'water', 'detached'])).toEqual(['all', 'height', 'landscape']);
	expect(readFocusChoice('height')).toEqual({ label: 'Height', analysis: 'height' });
	expect(() => readFocusLevel('nope' as never, 'terrain')).toThrow(RangeError);
});
