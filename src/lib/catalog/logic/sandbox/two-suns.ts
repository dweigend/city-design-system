import { storiesOf } from '../house-brush';
import type { Primitive } from '../parametrik/types';
import type { World } from './world';

export const TWO_SUNS_MAST = 'two-suns:mast';
export const TWO_SUNS_TURNING_DISC = 'two-suns:disc-b';
export const TWO_SUNS_PERIOD_S = 90;

function freeCell({ grid, state }: World, id: string) {
	const cell = grid.cellsById.get(id);
	if (
		cell?.plantable &&
		!storiesOf(state.stacks, id).length &&
		!state.cover.has(id) &&
		!state.lines.some(({ cellIds }) => cellIds.includes(id))
	)
		return cell;
}

/** Places the fixed landmark on the first free surveyed cell, without drawing randomness. */
export function twoSuns(world: World): Primitive[] {
	const cell = freeCell(world, '111/42') ?? freeCell(world, '110/43');
	if (!cell) return [];
	const [x, y, z] = cell.center;
	const paper = { role: 'neu', material: 'paper' } as const;
	const drum = { ...paper, kind: 'cylinder' } as const;
	const disc = { ...paper, kind: 'ring', innerRadius: 0, depth: 0.3 } as const;
	return [
		{
			...drum,
			id: 'two-suns:plinth',
			position: cell.center,
			radius: 3,
			height: 0.6,
			token: '--paper'
		},
		{
			...drum,
			id: TWO_SUNS_MAST,
			position: [x, y, z + 0.6],
			radius: 0.125,
			height: 16.4,
			token: '--ink'
		},
		{
			...paper,
			id: 'two-suns:finial',
			kind: 'sphere',
			position: [x, y, z + 17.5],
			radius: 0.5,
			token: '--ink'
		},
		{
			...disc,
			id: 'two-suns:disc-a',
			position: [x, y, z + 11],
			radius: 5,
			token: '--cat-mobility'
		},
		{
			...disc,
			id: TWO_SUNS_TURNING_DISC,
			position: [x + 2.5, y, z + 8],
			radius: 3.5,
			token: '--cat-health'
		}
	];
}
