import { expect, test } from 'bun:test';
import { example } from './example';
import { createCatalog } from './index';

test('keeps registration order and filters rows in that order', () => {
	const west = { id: 'west' };
	const east = { id: 'east' };
	const catalog = createCatalog({ rows: [west, east] });

	expect(catalog.ids).toEqual(['west', 'east']);
	expect(catalog.list()).toEqual([west, east]);
	expect(catalog.has('east')).toBe(true);
	expect(catalog.get('east')).toBe(east);
	expect(catalog.has('north')).toBe(false);
	expect(() => catalog.get('north')).toThrow(RangeError);
	expect(example().map(({ id }) => id)).toEqual(['survey/east', 'survey/west']);
});

test('rejects blank IDs and exact duplicates without normalizing keys', () => {
	for (const id of ['', ' \n\t']) {
		expect(() => createCatalog({ rows: [{ id }] })).toThrow(RangeError);
	}
	expect(() => createCatalog({ rows: [{ id: 'east' }, { id: 'east' }] })).toThrow(RangeError);
	const catalog = createCatalog({ rows: [{ id: 'east' }, { id: 'East' }, { id: ' east ' }] });
	expect(catalog.ids).toEqual(['east', 'East', ' east ']);
});

test('applies custom validation and preserves caller-supplied lookup errors', () => {
	class UnknownMarkerError extends Error {}

	const policies = {
		validateId: (id: string) => id.startsWith('survey/'),
		validateRow: (row: { id: string; label: string }) => row.label.trim().length > 0,
		missingError: (id: string) => new UnknownMarkerError(id)
	};
	const row = { id: 'survey/east', label: 'East' };
	expect(() => createCatalog({ ...policies, rows: [{ ...row, id: 'east' }] })).toThrow(RangeError);
	expect(() => createCatalog({ ...policies, rows: [{ ...row, label: ' ' }] })).toThrow(RangeError);
	const catalog = createCatalog({ ...policies, rows: [row] });
	expect(catalog.get('survey/east')).toBe(row);
	expect(() => catalog.get('survey/west')).toThrow(UnknownMarkerError);
});

test('prototype keys match only explicitly registered rows', () => {
	const keys = ['constructor', 'toString', '__proto__'];
	const empty = createCatalog({ rows: [] });
	const catalog = createCatalog({ rows: keys.map((id) => ({ id })) });

	for (const id of keys) {
		expect(empty.has(id)).toBe(false);
		expect(() => empty.get(id)).toThrow(RangeError);
		expect(catalog.has(id)).toBe(true);
		expect(catalog.get(id).id).toBe(id);
	}
});

test('snapshots and freezes the registration lists without freezing caller rows', () => {
	const original = { id: 'east' };
	const rows = [original];
	const catalog = createCatalog({ rows });
	rows.splice(0, rows.length, { id: 'west' });

	expect(catalog.ids).toEqual(['east']);
	expect(catalog.rows).toEqual([original]);
	expect(catalog.has('west')).toBe(false);
	expect(Object.isFrozen(catalog)).toBe(true);
	expect(Object.isFrozen(catalog.ids)).toBe(true);
	expect(Object.isFrozen(catalog.rows)).toBe(true);
	expect(Object.isFrozen(catalog.list(() => true))).toBe(true);
	expect(Object.isFrozen(original)).toBe(false);
});
