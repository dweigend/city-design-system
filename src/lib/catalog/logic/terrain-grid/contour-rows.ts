/**
 * Rows that follow the contour lines. The grid starts as a regular lattice in the valley
 * frame; then every row slides along its column until it lies on one height. On slopes a
 * row is a contour line, on flat ground a gentle virtual tilt keeps the lattice regular.
 *
 * The result is a shift per lattice vertex along its column, in meters. Every step has a
 * bounded reach in columns, so an intervention in the terrain moves rows only nearby and a
 * local recomputation equals the full one (PD-10).
 */
import { groundLevel, valleyPoint, type Terrain } from '../terrain';

/** Edge length of one cell in the valley frame, meters: the module of the measure chain. */
export const MODULE = 5;
/** Distance between height samples along a column, meters. */
const SAMPLE = 1;
/** Virtual gradient across the valley: on ground flatter than this, rows stay regular. */
const TILT = 0.03;
/** Columns to each side that set the height a row aims for. */
const WINDOW = 10;
/** Farthest a row moves from its lattice position, meters. */
const MAX_SHIFT = 14;
/** Closest and widest distance between neighboring rows along a column, meters. */
const SPACING = { min: 2.8, max: 8.5 };
const SMOOTH_PASSES = 2;
const SPACING_PASSES = 3;
/** Columns beyond a changed column whose rows may move. */
export const REACH = WINDOW + SMOOTH_PASSES;

export type Lattice = Readonly<{ terrain: Terrain; columns: number; rows: number }>;
type Columns = Map<number, Float64Array>;

const clampColumn = (lattice: Lattice, column: number) =>
	Math.max(0, Math.min(lattice.columns, column));

/** Tilted ground along one column, sampled every SAMPLE meters across the valley. */
function tiltedGround(lattice: Lattice, column: number): Float64Array {
	const count = Math.floor(lattice.terrain.across / SAMPLE) + 1;
	const field = new Float64Array(count);
	for (let j = 0; j < count; j++) {
		const [x, y] = valleyPoint(lattice.terrain, column * MODULE, j * SAMPLE);
		field[j] = groundLevel(lattice.terrain, x, y) + TILT * j * SAMPLE;
	}
	return field;
}

/** Height a row aims for at a column: the windowed mean of its lattice heights nearby. */
function aim(lattice: Lattice, fields: Columns, column: number, sample: number): number {
	let sum = 0;
	let weights = 0;
	for (let d = -WINDOW; d <= WINDOW; d++) {
		const field = fields.get(column + d);
		if (!field) continue;
		const weight = 0.5 * (1 + Math.cos((Math.PI * d) / (WINDOW + 1)));
		sum += weight * field[sample];
		weights += weight;
	}
	return sum / weights;
}

/** Position between two samples where the field crosses `level`, or undefined. */
function crossing(field: Float64Array, a: number, level: number): number | undefined {
	if (a < 0 || a + 1 >= field.length) return undefined;
	const below = field[a] - level;
	const above = field[a + 1] - level;
	if (below * above > 0) return undefined;
	return (a + (below === above ? 0 : below / (below - above))) * SAMPLE;
}

/** Shift in meters that brings a row from sample `at` to the nearest point at `level`. */
function shiftTo(field: Float64Array, at: number, level: number): number {
	const steps = Math.round(MAX_SHIFT / SAMPLE);
	for (let k = 0; k < steps; k++) {
		const up = crossing(field, at + k, level);
		const down = crossing(field, at - k - 1, level);
		const candidates = [up, down].filter((value): value is number => value !== undefined);
		if (candidates.length)
			return candidates
				.map((value) => value - at * SAMPLE)
				.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
	}
	// No such height nearby: move as far as allowed toward it.
	const rising = field[Math.min(field.length - 1, at + steps)] >= field[Math.max(0, at - steps)];
	return field[at] < level === rising ? MAX_SHIFT : -MAX_SHIFT;
}

/** Keeps the rows of one column in order and their spacing within bounds; ends stay fixed. */
function spaceRows(shifts: Float64Array) {
	const last = shifts.length - 1;
	const position = (row: number) => row * MODULE + shifts[row];
	const clampTo = (row: number, low: number, high: number) => {
		shifts[row] = Math.max(low, Math.min(high, position(row))) - row * MODULE;
	};
	shifts[0] = shifts[last] = 0;
	for (let pass = 0; pass < SPACING_PASSES; pass++) {
		for (let row = 1; row < last; row++)
			clampTo(row, position(row - 1) + SPACING.min, position(row - 1) + SPACING.max);
		for (let row = last - 1; row > 0; row--)
			clampTo(row, position(row + 1) - SPACING.max, position(row + 1) - SPACING.min);
	}
}

function solveColumn(lattice: Lattice, fields: Columns, column: number): Float64Array {
	const shifts = new Float64Array(lattice.rows + 1);
	// Fields exist for every column in reach; `fields.get(column)` is always present here.
	const field = fields.get(column) ?? tiltedGround(lattice, column);
	for (let row = 1; row < lattice.rows; row++) {
		const sample = Math.round((row * MODULE) / SAMPLE);
		shifts[row] = shiftTo(field, sample, aim(lattice, fields, column, sample));
	}
	return shifts;
}

/** One [1 2 1] pass along the columns and along the rows; missing side columns mirror. */
function smooth(source: Columns, from: number, to: number): Columns {
	const result: Columns = new Map();
	for (let column = from; column <= to; column++) {
		const center = source.get(column);
		if (!center) continue;
		const left = source.get(column - 1) ?? center;
		const right = source.get(column + 1) ?? center;
		const across = center.map((value, row) => (left[row] + 2 * value + right[row]) / 4);
		result.set(
			column,
			across.map((value, row) =>
				row === 0 || row === across.length - 1
					? 0
					: (across[row - 1] + 2 * value + across[row + 1]) / 4
			)
		);
	}
	return result;
}

/**
 * Row shifts for the vertex columns `from` … `to` (inclusive), each an array over the rows
 * 0 … lattice.rows in meters along the column. Solving a part of the lattice gives exactly
 * the values of solving all of it.
 */
export function rowShifts(lattice: Lattice, from: number, to: number): Columns {
	const first = clampColumn(lattice, from - SMOOTH_PASSES);
	const last = clampColumn(lattice, to + SMOOTH_PASSES);
	const fields: Columns = new Map();
	for (let c = clampColumn(lattice, first - WINDOW); c <= clampColumn(lattice, last + WINDOW); c++)
		fields.set(c, tiltedGround(lattice, c));
	let shifts: Columns = new Map();
	for (let column = first; column <= last; column++)
		shifts.set(column, solveColumn(lattice, fields, column));
	for (let pass = 1; pass <= SMOOTH_PASSES; pass++) {
		// Each pass is valid one column further in, except at the rim of the lattice.
		const inner = (edge: number, rim: number, step: number) => (edge === rim ? edge : edge + step);
		shifts = smooth(shifts, inner(first, 0, pass), inner(last, lattice.columns, -pass));
	}
	const result: Columns = new Map();
	for (let column = clampColumn(lattice, from); column <= clampColumn(lattice, to); column++) {
		const columnShifts = shifts.get(column);
		if (!columnShifts) continue;
		spaceRows(columnShifts);
		result.set(column, columnShifts);
	}
	return result;
}
