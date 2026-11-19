import { createTerrain } from '../terrain';
import { deriveGrid } from '../terrain-grid';
import { EMPTY_STATE } from './state';
import { beginStroke, extendStroke } from './stroke';
import { applyEdit, type World } from './world';
import { runFrameTimeline } from './frame-runner';

/** Replays a small painted neighbourhood on the seed-7 contour carrier. The two branches
 * share tick one. The player can then reserve the planned entrance for tick three. */
export function createFrameStudy() {
	const seed = 7;
	const grid = deriveGrid({ ...createTerrain({ seed }), along: 100, across: 100 });
	let painted: World = { seed, grid, state: EMPTY_STATE, lines: [] };
	for (const cell of grid.cells) {
		if (cell.column < 3 || cell.column > 16 || cell.row < 4 || cell.row > 14) continue;
		if (cell.buildable && (cell.column + cell.row) % 3 !== 0)
			painted = applyEdit(painted, { kind: 'raise', cellId: cell.id, use: 'living' });
	}
	const parcel = '11/5';
	const brush = beginStroke({ kind: 'house', use: 'living', style: 'megastructure' }, painted);
	const start = extendStroke(brush, parcel).draft;
	const first = runFrameTimeline(start, 1);
	const entrance = first.series[0][0]?.phases[0].seam;
	if (!entrance) throw new Error('The seed-7 study requires a planned entrance frontage.');
	const original = [...first.checkpoints];
	const revised = [...first.checkpoints];
	const lastTick = 4;
	return {
		parcel,
		entrance,
		lastTick,
		/** Retrieves a committed checkpoint, computing only previously unseen dates on that branch. */
		at(tick: number, reserveEntry: boolean) {
			if (!Number.isInteger(tick) || tick < 0 || tick > lastTick)
				throw new RangeError('Unknown study tick');
			const branch = reserveEntry ? revised : original;
			while (branch.length <= tick) {
				const observe =
					reserveEntry && branch.length === 2
						? () => ({ observations: [{ seam: entrance, from: 3, reason: 'court-access' }] })
						: undefined;
				branch.push(runFrameTimeline(branch[branch.length - 1], 1, observe).checkpoints[1]);
			}
			return branch[tick];
		}
	};
}
