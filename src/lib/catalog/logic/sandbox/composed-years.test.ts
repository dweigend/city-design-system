import { expect, test } from 'bun:test';
import { focuses } from '../presentation';
import { STORY } from '../../data/grid';
import { applyEdit, createWorld, houseGroups, changes } from './index';

test('later paint extends one frame and links houses across construction years', () => {
	const a = '30/30',
		b = '32/30';
	const initial = createWorld(7, { cells: 0 });
	const earlier = applyEdit(initial, { kind: 'raise', cellId: a, use: 'energy' });
	const aged = applyEdit(earlier, { kind: 'advance' });
	const later = applyEdit(aged, { kind: 'raise', cellId: b, use: 'water' });
	const extended = applyEdit(later, { kind: 'raise', cellId: a, use: 'living' });
	const chunk = extended.grid.cellsById.get(a)!.chunk;
	const draw = (w: typeof extended) => houseGroups(w, chunk, focuses.all);
	const groups = draw(extended),
		section = groups.get('composed/' + a)!;
	expect(section.filter((p) => p.id.includes('/post/'))).toHaveLength(5);
	const roof = section.find((p) => p.id.endsWith('/roof-walk'));
	if (roof?.kind !== 'prism') throw Error('Missing roof');
	expect(roof.z + roof.height).toBeCloseTo(extended.grid.cellsById.get(a)!.pad + 2 * STORY);
	expect([...groups.keys()].some((k) => k.startsWith('composed/link/'))).toBe(true);
	const changed = changes(later, extended).houseGroups;
	expect(changed.has('composed/' + a)).toBe(true);
	expect(changed.has('composed/' + b)).toBe(false);
});
