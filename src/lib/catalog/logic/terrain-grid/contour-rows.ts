/** Contour alleys bound evenly divided blocks in the valley frame. */
import { groundLevel, valleyPoint, type Terrain } from '../terrain';

/** Edge length of one cell in the valley frame, meters: the module of the measure chain. */
export const MODULE = 5;
/** Number of cells between consecutive alley bands. */
export const BLOCK = { rows: 8, columns: 12 } as const;
/** Distance between height samples along a column, meters. */
const SAMPLE = 1;
/** Virtual gradient across the valley: on ground flatter than this, rows stay regular. */
const TILT = 0.008;
/** Columns to each side that set the height a row aims for. */
const WINDOW = 20;
/** Farthest a row moves from its lattice position, meters. */
export const MAX_SHIFT = 22;
/** Maximum deviation from nominal block depth, as a share (also for a partial block). */
const DEPTH_SLACK = 0.4;
const SMOOTH_PASSES = 3;
/** Maximum along-valley displacement (meters) and lean per nominal meter across the valley. */
export const MAX_LEAN = 6;
const LEAN_GRADE = 0.025;
const GRADIENT_RADIUS = 10;
/** Columns beyond a changed column whose rows may move. */
export const REACH = Math.max(WINDOW + SMOOTH_PASSES, BLOCK.columns + GRADIENT_RADIUS / MODULE);

export type Lattice = Readonly<{
	profile: typeof import('./alley-profile').defaultAlleyPlan;
	terrain: Terrain;
	columns: number;
	rows: number;
}>;
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

/** Clamp each alley shift against its predecessor and the remaining distance to the fixed rim. */
function divideBlocks(shifts: Float64Array, rows: number): Float64Array {
	const result = new Float64Array(rows + 1);
	let previous = 0;
	for (let start = 0; start < rows; start += BLOCK.rows) {
		const end = Math.min(start + BLOCK.rows, rows);
		const delta = (end - start) * MODULE * DEPTH_SLACK;
		const remaining = (rows - end) * MODULE * DEPTH_SLACK;
		const shift = shifts[Math.ceil(end / BLOCK.rows)];
		const next = Math.max(
			-remaining,
			previous - delta,
			Math.min(remaining, previous + delta, shift)
		);
		for (let row = start + 1; row <= end; row++)
			result[row] = previous + ((next - previous) * (row - start)) / (end - start);
		previous = next;
	}
	return result;
}

/** Hermite blend across a normalized transition interval. */
export const smoothWeight = (x: number) => {
	const t = Math.max(0, Math.min(1, x));
	return t * t * (3 - 2 * t);
};

/** Share of contour alignment at a alley node, before limiting block depth. */
function contourWeight({ bands }: Terrain, y: number) {
	return (
		smoothWeight((y - bands.scarpStart + 50) / 30) *
			(1 - smoothWeight((y - bands.scarpEnd - 12) / 26)) +
		smoothWeight((y - bands.scarpEnd - 38) / 28)
	);
}

function solveColumn(lattice: Lattice, fields: Columns, column: number): Float64Array {
	const shifts = new Float64Array(Math.ceil(lattice.rows / BLOCK.rows) + 1);
	// Fields exist for every column in reach; `fields.get(column)` is always present here.
	const field = fields.get(column) ?? tiltedGround(lattice, column);
	for (let row = BLOCK.rows; row < lattice.rows; row += BLOCK.rows) {
		const sample = Math.round((row * MODULE) / SAMPLE);
		shifts[row / BLOCK.rows] =
			contourWeight(lattice.terrain, row * MODULE) *
			shiftTo(field, sample, aim(lattice, fields, column, sample));
	}
	return shifts;
}

/** One [1 2 1] pass along the columns; missing side columns mirror. */
function smooth(source: Columns, from: number, to: number): Columns {
	const result: Columns = new Map();
	for (let column = from; column <= to; column++) {
		const center = source.get(column);
		if (!center) continue;
		const left = source.get(column - 1) ?? center;
		const right = source.get(column + 1) ?? center;
		result.set(
			column,
			center.map((value, row) => (left[row] + 2 * value + right[row]) / 4)
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
		result.set(column, divideBlocks(columnShifts, lattice.rows));
	}
	return result;
}

/** Bounded fall-line displacement at each alley crossing, integrated uphill in meters. */
function crossAlley(lattice: Lattice, column: number): Float64Array {
	const offsets = new Float64Array(Math.ceil(lattice.rows / BLOCK.rows) + 1);
	if (column === 0 || column === lattice.columns) return offsets;
	const height = (along: number, across: number) =>
		groundLevel(lattice.terrain, ...valleyPoint(lattice.terrain, column * MODULE + along, across));
	for (let i = 1; i < offsets.length; i++) {
		const low = (i - 1) * BLOCK.rows * MODULE;
		const high = Math.min(i * BLOCK.rows, lattice.rows) * MODULE;
		const mid = (high + low) / 2;
		const dx =
			(height(GRADIENT_RADIUS, mid) - height(-GRADIENT_RADIUS, mid)) / (2 * GRADIENT_RADIUS);
		const dy = (height(0, high) - height(0, low)) / (high - low);
		const gradeRatio = (dx * dy) / (dy * dy + TILT * TILT);
		const step = LEAN_GRADE * (high - low);
		offsets[i] = Math.max(
			-MAX_LEAN,
			Math.min(
				MAX_LEAN,
				offsets[i - 1] + Math.max(-step, Math.min(step, gradeRatio * (high - low)))
			)
		);
	}
	return offsets;
}

/** Interpolates neighboring cross alleys in both directions to keep the parcels regular. */
export function columnLeans(lattice: Lattice, column: number, crossings: Columns): Float64Array {
	const left = column - (column % BLOCK.columns);
	const right = Math.min(left + BLOCK.columns, lattice.columns);
	const fraction = (column - left) / Math.max(1, right - left);
	const offsets = (c: number) => {
		const profile = crossings.get(c) ?? crossAlley(lattice, c);
		crossings.set(c, profile);
		return profile;
	};
	const a = offsets(left),
		b = offsets(right);
	const nodes = a.map((value, i) => value + fraction * (b[i] - value));
	return Float64Array.from({ length: lattice.rows + 1 }, (_, row) => {
		const i = Math.floor(row / BLOCK.rows),
			j = Math.ceil(row / BLOCK.rows);
		const span = Math.min(BLOCK.rows, lattice.rows - i * BLOCK.rows);
		return nodes[i] + ((nodes[j] - nodes[i]) * (row % BLOCK.rows)) / Math.max(1, span);
	});
}
