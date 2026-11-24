import { expect, test } from 'bun:test';
import { example } from './example';
import {
	createFocusResolver,
	displayLevels,
	FocusPolicyError,
	readDisplayPresentation,
	readSurfaceLevel
} from './index';

test('a composition supplies its own vocabulary and rows', () => {
	const preset = example();
	expect(preset.offerFocus(['subject', 'backdrop'])).toEqual(['all', 'detail']);
	expect(preset.offerFocus(['subject'])).toEqual(['all']);
	expect(preset.readFocusLevel('detail', 'backdrop')).toBe('hidden');
	expect(() => preset.offerFocus(['foreign'])).toThrow(FocusPolicyError);
	expect(() => preset.readFocusLevel('all', 'foreign')).toThrow(FocusPolicyError);
});

test('construction reports missing rows and incomplete choice coverage', () => {
	expect(() =>
		createFocusResolver({ all: { label: 'All', subject: [] } }, {}, ['foreign'])
	).toThrow('Missing focus row for "foreign"');
	expect(() => createFocusResolver({ all: { label: 'All', subject: ['foreign'] } }, {})).toThrow(
		FocusPolicyError
	);
	expect(() =>
		createFocusResolver({ all: { label: 'All', subject: [] } }, { incomplete: {} } as never)
	).toThrow(FocusPolicyError);
});

test('all display levels map to material detail independently of the preset', () => {
	expect(displayLevels.map(readSurfaceLevel)).toEqual(['near', 'far', 'far', 'pencil', undefined]);
	const preset = example();
	expect(readSurfaceLevel(preset.readFocusLevel('detail', 'subject'))).toBe('near');
	expect(readSurfaceLevel(preset.readFocusLevel('detail', 'backdrop'))).toBeUndefined();
	expect(() => readSurfaceLevel('unknown' as never)).toThrow(RangeError);
});

test('resolves each display level to a unique detail and treatment', () => {
	const presentations = displayLevels.map(readDisplayPresentation);
	expect(presentations).toEqual([
		{ detail: 'full', treatment: 'solid', visible: true },
		{ detail: 'plain', treatment: 'solid', visible: true },
		{ detail: 'plain', treatment: 'ghost', visible: true },
		{ detail: 'flat', treatment: 'pencil', visible: true },
		{ detail: 'plain', treatment: 'wire', visible: false }
	]);
	expect(presentations.every(Object.isFrozen)).toBe(true);
	expect(() => readDisplayPresentation('invalid' as never)).toThrow(RangeError);
});
