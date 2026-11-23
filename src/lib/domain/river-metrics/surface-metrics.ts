import { clipPolylineToSquare } from '../../core/polyline';
import {
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

function validSurfaceProtocol(windowM: number, protocol: SurfaceProtocol): boolean {
	return (
		protocol.surfaceSpacingM > 0 &&
		protocol.surfaceSpacingM <= windowM / 2 &&
		protocol.smoothingSigmaM > 0 &&
		Number.isFinite(protocol.smoothingSigmaM) &&
		protocol.gaussianTruncateSigma > 0 &&
		Number.isFinite(protocol.gaussianTruncateSigma) &&
		protocol.reliefCoreM > 0
	);
}

function validProfileProtocol(spacingM: number, protocol: SurfaceProtocol): boolean {
	return (
		protocol.profileSpacingM > 0 &&
		protocol.profileHalfLengthM > 0 &&
		protocol.profileHalfLengthM % spacingM === 0 &&
		protocol.stationOffsetM >= 0 &&
		protocol.stationTangentHalfLengthM > 0
	);
}

function checkGrid(grid: SurfaceGrid): number {
	const side = grid.windowM / grid.spacingM + 1;
	const valid =
		Number.isInteger(side) &&
		side > 1 &&
		grid.spacingM > 0 &&
		grid.windowM > 0 &&
		grid.bedMm.length === side ** 2 &&
		grid.meanWaterMm.length === side ** 2 &&
		(grid.floor === undefined || grid.floor.length === side ** 2);
	if (!valid) throw new RangeError('invalid-surface-grid');
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
 */
export function measureRiverSurface(
	grid: SurfaceGrid,
	course: ArrayLike<number>,
	protocol: SurfaceProtocol
) {
	const side = checkGrid(grid);
	if (
		!validSurfaceProtocol(grid.windowM, protocol) ||
		!validProfileProtocol(grid.spacingM, protocol)
	) {
		throw new RangeError('invalid-surface-grid');
	}
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
