import { required } from '../required';
import { expect, test } from 'bun:test';
import { focuses } from '../presentation';
import { STORY } from '../../data/grid';
import { applyEdit, beginStroke, extendStroke, createWorld, houseGroups, changes } from './index';

test('later paint extends one frame and links houses across construction years', () => {
	const a = '30/30',
		b = '31/30';
	const initial = createWorld(7, { cells: 0 });
	const earlier = applyEdit(initial, { kind: 'raise', cellId: a, use: 'energy' });
	const aged = applyEdit(earlier, { kind: 'advance' });
	const begun = applyEdit(aged, { kind: 'raise', cellId: b, use: 'water' });
	const later = applyEdit(begun, { kind: 'raise', cellId: b, use: 'food' });
	const extended = applyEdit(later, { kind: 'raise', cellId: a, use: 'living' });
	const chunk = required(extended.grid.cellsById.get(a), 'painted cell').chunk;
	const draw = (w: typeof extended) => houseGroups(w, chunk, focuses.all);
	const groups = draw(extended),
		section = required(groups.get('composed/' + a), 'projected section');
	expect(
		[...groups.keys()].filter(
			(id) => id === 'composed/' + a || id.startsWith('composed/' + a + '@')
		)
	).toEqual(['composed/' + a]);
	for (const joint of ['foot', 'shaft', 'head'])
		expect(section.some((p) => p.id.includes('/kit-column-' + joint + '-'))).toBe(true);
	const roof = section.find((p) => p.id.endsWith('/roof-walk'));
	if (roof?.kind !== 'prism') throw Error('Missing roof');
	expect(roof.z + roof.height).toBeCloseTo(
		required(extended.grid.cellsById.get(a), 'painted cell').pad + 2 * STORY
	);
	expect([...groups.keys()].some((k) => k.startsWith('composed/link/'))).toBe(true);
	const changed = changes(later, extended).houseGroups;
	expect(changed.has('composed/' + a)).toBe(true);
	expect(changed.has('composed/' + b)).toBe(false);
	expect(draw(later).get('composed/' + b)).toEqual(groups.get('composed/' + b));
});

test('successive painted storeys remain reachable in one living stack', () => {
	const id = '30/30';
	let world = createWorld(7, { cells: 0 });
	for (let stories = 1; stories <= 5; stories++) {
		world = extendStroke(
			beginStroke({ kind: 'house', style: 'composed', use: 'living' }, world),
			id
		).draft;
		const group = required(
			houseGroups(
				world,
				required(world.grid.cellsById.get(id), 'stroke cell').chunk,
				focuses.all
			).get('composed/' + id),
			'painted house'
		);
		const decks = group.filter(
			(p) => p.id.includes('/level/') && p.id.endsWith('/deck') && p.kind === 'prism'
		);
		expect(decks).toHaveLength(stories);
		for (const deck of decks) {
			if (deck.kind !== 'prism') throw new Error('Expected walking surface');
			const z = deck.z + deck.height;
			expect(
				group.some(
					(p) =>
						p.kind === 'prism' && p.id.includes('/stair/') && Math.abs(p.z + p.height - z) < 0.02
				)
			).toBe(true);
		}
		if (stories >= 3)
			expect(
				group.filter(
					(p) =>
						p.id.includes('/body/') && p.id.includes('/kit-crown-lantern-') && p.kind === 'cylinder'
				).length
			).toBeGreaterThanOrEqual(2);
	}
});
