import { expect, test } from 'bun:test';
import { displayLevels, stockPencilShare } from '../focus';
import { cityFocus, cityFocusPreset } from './index';

const {
	choices: focusChoices,
	subsystems,
	offerFocus,
	readFocusChoice,
	readFocusLevel
} = cityFocusPreset;

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
	expect({
		offered: offerFocus(['terrain', 'water', 'detached', 'block', 'lattice']),
		latticeInBlocks: readFocusLevel('block', 'lattice')
	}).toEqual({
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
		'Parcels',
		'Plan and crossings'
	]);
});

// Captured from b08835f7 in the original menu and subsystem order.
test('preserves all 120 city display levels', () => {
	const matrix = Object.fromEntries(
		subsystems.map((part) => [
			part,
			focusChoices.map((choice) => readFocusLevel(choice, part)[0].toUpperCase()).join('')
		])
	);
	expect(matrix).toEqual({
		terrain: 'FFFFFFFFFF',
		water: 'FFFFFFFFFF',
		detached: 'FFTTFTFSTT',
		block: 'FFTFTTFSTT',
		center: 'FFFTTTFSTT',
		lattice: 'FHHHHFHHHH',
		plan: 'TTTTTTTTTF',
		'water-cells': 'HHHHHHHFHF',
		crossings: 'FFTTTTTFFF',
		lanes: 'HHHHHHHHFF',
		parcels: 'HHHHHHHHFF',
		'merged-units': 'HHHHHHHHFF'
	});
});

test('falls back to All when an empty plan has no overlays in focus', () => {
	const content = {
		shares: { detached: 0, block: 0, center: 0 },
		lattice: false,
		planDrawables: []
	};
	const { items, active } = cityFocus(content, 'plan', 'plan');
	expect(items.map(({ value }) => value)).toEqual(['all']);
	expect(active).toBe('all');
	const planned = cityFocus(
		{ ...content, planDrawables: [{ id: 'dry-plan' }, { id: 'selected-crossings' }] },
		'plan'
	);
	expect(planned.items).toContainEqual({ value: 'plan', label: 'Plan and crossings' });
	expect(planned.active).toBe('plan');
});
