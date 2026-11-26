import type { Part } from '../../core/object';
import { readStoreyElevation, type CellSpace, type FineCell } from '../cell-space';
import { readOccupancyDatum, type HouseCell, type HouseOccupancy } from './occupancy';

/** A house's ground plan and its occupied runs, in cell order and then bottom to top. */
export type Massing = Readonly<{
	base: HouseOccupancy;
	runs: readonly HouseCell[];
}>;

export type Column = {
	base: HouseCell;
	occupied: Set<number>;
	anchoredTo: number;
	sides: FineCell['sides'];
};
export type Columns = ReadonlyMap<string, Column>;

/** Opens an immutable house occupancy for volume edits, retaining the original ground plan. */
export function createMassing(base: HouseOccupancy): Massing {
	const runs = base.cells.filter(({ fromStorey, toStorey }) => toStorey > fromStorey);
	return Object.freeze({ base, runs: Object.freeze(runs) });
}

export function columnsOf(space: CellSpace, massing: Massing): Columns {
	const { base } = massing;
	validateSpace(space, base);
	const columns = new Map(
		space.cells.map(({ id, sides }, index): [string, Column] => {
			const cell = base.cells[index];
			return [id, { base: cell, occupied: new Set(), anchoredTo: cell.fromStorey, sides }];
		})
	);
	for (const run of massing.runs) {
		const column = columns.get(run.id);
		if (!column) throw new RangeError('Unknown massing cell: ' + run.id);
		for (let storey = run.fromStorey; storey < run.toStorey; storey++) column.occupied.add(storey);
		if (run.fromStorey === column.base.fromStorey) column.anchoredTo = run.toStorey;
	}
	return columns;
}

function validateSpace(space: CellSpace, base: HouseOccupancy) {
	const sourceDatum = readOccupancyDatum(base);
	if (
		space.id !== base.spaceId ||
		space.cells.length !== base.cellIds.length ||
		space.cells.some(({ id }, index) => id !== base.cellIds[index]) ||
		(sourceDatum &&
			(space.datumIndex !== sourceDatum.datumIndex ||
				space.storeyCount !== sourceDatum.storeyCount)) ||
		base.cells.some(({ program }) =>
			program?.some(({ storey, datumIndex }) => datumIndex !== space.datumIndex + storey)
		)
	)
		throw new RangeError('Massing belongs to another cell space');
}

export function supports(columns: Columns, column: Column, storey: number): boolean {
	return (
		storey < column.anchoredTo ||
		column.sides.some(({ neighbour }) => {
			const side = neighbour === null ? undefined : columns.get(neighbour);
			return side && side.base.fromStorey <= storey && storey < side.anchoredTo;
		})
	);
}

export function removeSlice(column: Column, storey: number) {
	column.occupied.delete(storey);
	column.anchoredTo = Math.min(storey, column.anchoredTo);
}

function runsOf({ base, occupied }: Column, previous: readonly HouseCell[]): HouseCell[] {
	const runs: HouseCell[] = [];
	for (let from = base.fromStorey; from < base.toStorey; from++) {
		if (!occupied.has(from)) continue;
		let to = from + 1;
		while (occupied.has(to)) to++;
		const same = previous.find(
			({ fromStorey, toStorey }) => fromStorey === from && toStorey === to
		);
		if (same) runs.push(same);
		else {
			const program = base.program?.filter(({ storey }) => from <= storey && storey < to);
			runs.push(
				Object.freeze({
					...base,
					fromStorey: from,
					toStorey: to,
					...(program ? { program: Object.freeze(program) } : {})
				})
			);
		}
		from = to - 1;
	}
	return runs;
}

export function snapshot(massing: Massing, columns: Columns): Massing {
	const byId = new Map<string, HouseCell[]>();
	for (const run of massing.runs) {
		const previous = byId.get(run.id);
		if (previous) previous.push(run);
		else byId.set(run.id, [run]);
	}
	const runs = [...columns].flatMap(([id, column]) => runsOf(column, byId.get(id) ?? []));
	if (
		runs.length === massing.runs.length &&
		runs.every((run, index) => run === massing.runs[index])
	)
		return massing;
	return Object.freeze({ base: massing.base, runs: Object.freeze(runs) });
}

/** Closed, datum-addressed envelope prisms in meters, in cell and storey order, for the mass slot.
 * Uses the supplied space's frozen rings and returns a detached part list. Throws RangeError
 * if the space does not match the base or does not contain a run's storey elevations. */
export function createMassingParts(space: CellSpace, massing: Massing): readonly Part[] {
	validateSpace(space, massing.base);
	const quads = new Map(space.cells.map(({ id, quad }) => [id, quad]));
	return massing.runs.flatMap(({ id, fromStorey, toStorey }) => {
		const polygon = quads.get(id);
		if (!polygon) throw new RangeError('Unknown massing cell: ' + id);
		return Array.from({ length: toStorey - fromStorey }, (_, offset): Part => {
			const storey = fromStorey + offset;
			return {
				id: `${id}/envelope/datum/${space.datumIndex + storey}`,
				slot: 'mass',
				shape: {
					kind: 'prism',
					polygon,
					base: readStoreyElevation(space, storey),
					top: readStoreyElevation(space, storey + 1)
				}
			};
		});
	});
}
