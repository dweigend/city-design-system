type Band = readonly [min: number, max: number];

export type ValleyParameters = Readonly<{
	bankfullWidthM: Band;
	wavelengthToWidth: Band;
	headingAmplitude: Band;
	phaseOffset: Band;
	windowPhaseOffset: Band;
	groundVariation: Band;
	groundHeightVariation: Band;
	axisTiltRad: Band;
	windowAcross: Band;
	openBank?: 'left' | 'right';
	wetToBankfullWidth: number;
}>;

/** Frozen default bands for the large-lowland river type. */
export const DEFAULT_VALLEY_PARAMETERS: ValleyParameters = Object.freeze({
	bankfullWidthM: Object.freeze([350, 430] as const),
	wavelengthToWidth: Object.freeze([21, 24] as const),
	headingAmplitude: Object.freeze([0.71, 0.79] as const),
	phaseOffset: Object.freeze([-0.06, 0.06] as const),
	windowPhaseOffset: Object.freeze([-Math.PI, Math.PI] as const),
	groundVariation: Object.freeze([0, 1] as const),
	groundHeightVariation: Object.freeze([0, 1] as const),
	axisTiltRad: Object.freeze([-0.052, 0.052] as const),
	windowAcross: Object.freeze([-1, 1] as const),
	wetToBankfullWidth: 0.94
});

const TURN = 2 * Math.PI;
const MIN_RADIUS_TO_WIDTH = 2;
const MAX_HEADING_AMPLITUDE = 1.2;
const MAX_PHASE_OFFSET = Math.PI / 4;
const BANKFULL_WIDTH_M: Band = [320, 450];
const WAVELENGTH_TO_WIDTH: Band = [10, 26];

function isBand(band: Band, lower: number, upper: number): boolean {
	if (!Array.isArray(band) || band.length !== 2) return false;
	const [min, max] = band;
	return Number.isFinite(min) && Number.isFinite(max) && lower <= min && min <= max && max <= upper;
}

function validGroundSelection({
	groundVariation,
	groundHeightVariation,
	axisTiltRad,
	openBank
}: ValleyParameters): boolean {
	return (
		isBand(groundVariation, 0, 1) &&
		isBand(groundHeightVariation, 0, 1) &&
		isBand(axisTiltRad, -0.15, 0.15) &&
		(openBank === undefined || openBank === 'left' || openBank === 'right')
	);
}

function validPlacement({
	phaseOffset,
	windowPhaseOffset,
	windowAcross
}: ValleyParameters): boolean {
	return (
		isBand(phaseOffset, -MAX_PHASE_OFFSET, MAX_PHASE_OFFSET) &&
		isBand(windowPhaseOffset, -Math.PI, Math.PI) &&
		isBand(windowAcross, -1, 1)
	);
}

/** Resolves the declared defaults and validates inputs before allocating the course. */
export function valleyParameters(overrides?: Partial<ValleyParameters>): ValleyParameters {
	const parameters = { ...DEFAULT_VALLEY_PARAMETERS, ...overrides };
	const { bankfullWidthM, wavelengthToWidth, headingAmplitude, wetToBankfullWidth } = parameters;
	if (
		!isBand(bankfullWidthM, ...BANKFULL_WIDTH_M) ||
		!isBand(wavelengthToWidth, ...WAVELENGTH_TO_WIDTH) ||
		!validPlacement(parameters) ||
		!Number.isFinite(wetToBankfullWidth) ||
		wetToBankfullWidth <= 0 ||
		wetToBankfullWidth > 1 ||
		!validGroundSelection(parameters)
	) {
		throw new RangeError('invalid-valley-parameters');
	}
	// Peak curvature is amplitude times 2π / wavelength.
	// The absolute cap guarantees forward progress even with long wavelength overrides.
	const amplitudeLimit = Math.min(
		MAX_HEADING_AMPLITUDE,
		wavelengthToWidth[0] / (TURN * MIN_RADIUS_TO_WIDTH)
	);
	if (!isBand(headingAmplitude, 0, amplitudeLimit)) {
		throw new RangeError('invalid-valley-parameters');
	}
	return parameters;
}

/** Interpolates a closed numeric parameter band. */
export function sampleBand([min, max]: Band, fraction: number): number {
	return min + fraction * (max - min);
}
