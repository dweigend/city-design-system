import { isFiniteVector } from '../../core/geometry';
import { clipPolylineToSquare } from '../../core/polyline';
import {
	checkOffsets,
	crossSections,
	floodplainWidths,
	profileAt,
	stepCandidates,
	wetBanks
} from './cross-profiles';
import { gridSampler, smoothSurface, type SurfaceGrid } from './surface-grid';

export type SurfaceProtocol = Readonly<{
	reliefCoreM: number;
	surfaceSpacingM: number;
	smoothingSigmaM: number;
	gaussianTruncateSigma: number;
	profileSpacingM: number;
	profileHalfLengthM: number;
	stationOffsetM: number;
	stationTangentHalfLengthM: number;
	stepMinimumSlope: number;
	stepMinimumGainM: number;
	landSlopeClassLimits: readonly [number, number, number];
}>;

type Surface = ReturnType<typeof smoothSurface>;
type Sampler = ReturnType<typeof gridSampler>;

function gradient(
	{ side, heights }: Surface,
	row: number,
	column: number,
	spacing: number
): number {
	const left = Math.max(0, column - 1);
	const right = Math.min(side - 1, column + 1);
	const top = Math.max(0, row - 1);
	const bottom = Math.min(side - 1, row + 1);
	return Math.hypot(
		(heights[row * side + right] - heights[row * side + left]) / ((right - left) * spacing),
		(heights[bottom * side + column] - heights[top * side + column]) / ((bottom - top) * spacing)
	);
}

// Exact arithmetic: three ordered thresholds partition land into four slope classes.
const emptySlopeCounts = [0, 0, 0, 0] as const;

function surfaceStats(surface: Surface, signed: Sampler, protocol: SurfaceProtocol) {
	const { side, center, heights } = surface;
	const { surfaceSpacingM: spacing, reliefCoreM, landSlopeClassLimits } = protocol;
	const counts: number[] = [...emptySlopeCounts];
	let land = 0;
	let low = Infinity;
	let high = -Infinity;
	for (let row = 0; row < side; row++) {
		for (let column = 0; column < side; column++) {
			const x = (column - center) * spacing;
			const y = (center - row) * spacing;
			if (Math.max(Math.abs(x), Math.abs(y)) <= reliefCoreM / 2) {
				const height = heights[row * side + column];
				low = Math.min(low, height);
				high = Math.max(high, height);
			}
			if (signed(x, y) < 0) continue;
			const slope = gradient(surface, row, column, spacing);
			const slot = landSlopeClassLimits.findIndex((limit) => slope < limit);
			counts[slot === -1 ? counts.length - 1 : slot]++;
			land++;
		}
	}
	return { reliefM: high - low, landSlopeShares: counts.map((count) => (land ? count / land : 0)) };
}

// Exact arithmetic: three ordered thresholds define four slope classes.
function checkSlopeLimits(limits: SurfaceProtocol['landSlopeClassLimits']): void {
	if (
		!isFiniteVector(limits, 3) ||
		!(0 <= limits[0] && limits[0] < limits[1] && limits[1] < limits[2])
	)
		throw new RangeError(
			'landSlopeClassLimits must be three finite, increasing, nonnegative values'
		);
}

function checkProtocol(grid: SurfaceGrid, protocol: SurfaceProtocol): void {
	const { surfaceSpacingM, profileHalfLengthM, landSlopeClassLimits } = protocol;
	const { stationOffsetM, stepMinimumSlope, stepMinimumGainM } = protocol;
	const positive = {
		surfaceSpacingM,
		profileHalfLengthM,
		reliefCoreM: protocol.reliefCoreM,
		smoothingSigmaM: protocol.smoothingSigmaM,
		gaussianTruncateSigma: protocol.gaussianTruncateSigma,
		profileSpacingM: protocol.profileSpacingM,
		stationTangentHalfLengthM: protocol.stationTangentHalfLengthM
	};
	for (const [field, value] of Object.entries(positive))
		if (!Number.isFinite(value) || value <= 0)
			throw new RangeError(`${field} must be finite and positive`);
	const nonnegative = { stationOffsetM, stepMinimumSlope, stepMinimumGainM };
	for (const [field, value] of Object.entries(nonnegative))
		if (!Number.isFinite(value) || value < 0)
			throw new RangeError(`${field} must be finite and nonnegative`);
	if (surfaceSpacingM > grid.windowM / 2)
		throw new RangeError('surfaceSpacingM must fit twice in windowM');
	if (profileHalfLengthM % grid.spacingM !== 0)
		throw new RangeError('profileHalfLengthM must be a multiple of grid.spacingM');
	checkOffsets(
		'profileHalfLengthM and spacingM',
		-profileHalfLengthM,
		profileHalfLengthM,
		grid.spacingM
	);
	checkSlopeLimits(landSlopeClassLimits);
}

function checkSamples(field: string, values: ArrayLike<number>, length: number): void {
	if (values.length !== length) throw new RangeError(`${field} must contain ${length} samples`);
	const array = Array.isArray(values);
	for (let i = 0; i < length; i++)
		if ((array && !Object.hasOwn(values, i)) || !Number.isFinite(values[i]))
			throw new RangeError(`${field}[${i}] must be a populated finite sample`);
}

function checkGrid(grid: SurfaceGrid): number {
	const { windowM, spacingM, bedMm, meanWaterMm, floor } = grid;
	if (!Number.isFinite(windowM) || windowM <= 0)
		throw new RangeError('windowM must be finite and positive');
	const side = windowM / spacingM + 1;
	if (!Number.isFinite(spacingM) || spacingM <= 0 || !Number.isInteger(side) || side <= 1)
		throw new RangeError('spacingM must be finite, positive and divide windowM');
	const length = side ** 2;
	checkSamples('bedMm', bedMm, length);
	checkSamples('meanWaterMm', meanWaterMm, length);
	if (floor !== undefined) checkSamples('floor', floor, length);
	return side;
}

// Exact arithmetic: floor indices at or above 2 identify terraces in the surface raster.
const firstTerraceIndex = 2;

type ProfileWidths = {
	widthM: number[];
	bankPairsM: (readonly [number, number])[];
	dryBankWidthsM: number[];
};

function recordWidths(
	profile: ReturnType<typeof profileAt>,
	hasTerrace: boolean,
	widths: ProfileWidths
) {
	const banks = wetBanks(profile);
	if (!banks) return;
	widths.widthM.push(banks.right - banks.left);
	if (!hasTerrace) return;
	const [left, right] = floodplainWidths(profile, banks);
	if (left !== null) widths.dryBankWidthsM.push(left);
	if (right !== null) widths.dryBankWidthsM.push(right);
	if (left !== null && right !== null) widths.bankPairsM.push([left, right]);
}

/**
 * Measures complete wet widths, step gains, core relief and land slope shares from a
 * north-first centered grid of millimeter heights and an interleaved XY course in meters.
 * Uses water-filled Gaussian-smoothed heights for terrain. The input buffers stay untouched.
 * Throws RangeError for invalid raster dimensions, samples, spacings or classification thresholds.
 */
export function measureRiverSurface(
	grid: SurfaceGrid,
	course: ArrayLike<number>,
	protocol: SurfaceProtocol
) {
	const side = checkGrid(grid);
	checkProtocol(grid, protocol);
	const reach = clipPolylineToSquare(course, grid.windowM);
	const surface = smoothSurface(
		grid,
		protocol.surfaceSpacingM,
		protocol.smoothingSigmaM,
		protocol.gaussianTruncateSigma
	);
	const signed = gridSampler(side, grid.spacingM, (i) => grid.bedMm[i] - grid.meanWaterMm[i]);
	const height = gridSampler(surface.side, protocol.surfaceSpacingM, (i) => surface.heights[i]);
	const widths: ProfileWidths = { widthM: [], bankPairsM: [], dryBankWidthsM: [] };
	const { floor } = grid;
	const terrace =
		floor && gridSampler(side, grid.spacingM, (i) => Number(floor[i] >= firstTerraceIndex));
	const stepHeightsM: number[] = [];
	const stations = reach
		? crossSections(
				reach.xy,
				protocol.stationOffsetM,
				protocol.profileSpacingM,
				protocol.stationTangentHalfLengthM
			)
		: [];
	for (const station of stations) {
		const profile = profileAt(
			station,
			protocol.profileHalfLengthM,
			grid.spacingM,
			grid.windowM,
			signed,
			height,
			terrace
		);
		recordWidths(profile, terrace !== undefined, widths);
		stepHeightsM.push(
			...stepCandidates(profile, protocol.stepMinimumSlope, protocol.stepMinimumGainM)
		);
	}
	return {
		...widths,
		stepHeightsM,
		...surfaceStats(surface, signed, protocol)
	};
}
