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

test('All draws every body in full and a single kind keeps the others see-through', () => {
	for (const subsystem of ['terrain', 'water', 'detached', 'block', 'center', 'lattice'] as const)
		expect(readFocusLevel('all', subsystem)).toBe('full');
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

test('the plan, its water cells and the crossings are policy rows, so the Plan step is a focus', () => {
	expect(readFocusLevel('plan', 'plan')).toBe('full');
	expect(readFocusLevel('plan', 'water-cells')).toBe('full');
	expect(readFocusLevel('plan', 'crossings')).toBe('full');
	expect(readFocusLevel('plan', 'block')).toBe('transparent');
	expect(readFocusLevel('all', 'plan')).toBe('transparent');
	expect(readFocusLevel('all', 'water-cells')).toBe('hidden');
	expect(readFocusLevel('landscape', 'water-cells')).toBe('full');
	// Crossings are paths: never hidden, full wherever the plan or the ground is the question.
	for (const choice of focusChoices) expect(readFocusLevel(choice, 'crossings')).not.toBe('hidden');
	expect(readFocusLevel('all', 'crossings')).toBe('full');
	expect(readFocusLevel('landscape', 'crossings')).toBe('full');
	// A plan on its own offers its own focus beside All and the ground.
	expect(offerFocus(['terrain', 'water', 'plan', 'water-cells', 'crossings'])).toEqual([
		'all',
		'landscape',
		'plan'
	]);
});

test('names the choices for the districts they show, not for houses', () => {
	expect(focusChoices.map((choice) => readFocusChoice(choice).label)).toEqual([
		'All',
		'All districts',
		'Center district',
		'Block district',
		'Detached district',
		'Lattice',
		'Height',
		'Terrain and water',
		'Plan and crossings',
		'Paths and rail',
		'Rail'
	]);
});
