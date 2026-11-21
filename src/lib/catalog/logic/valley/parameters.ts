type Band = readonly [min: number, max: number];

export type ValleyParameters = Readonly<{
	bankfullWidthM: Band;
	wavelengthToWidth: Band;
	headingAmplitude: Band;
	phaseOffset: Band;
	wetToBankfullWidth: number;
}>;

/** Frozen default bands for the large-lowland river type. */
export const DEFAULT_VALLEY_PARAMETERS: ValleyParameters = Object.freeze({
	bankfullWidthM: Object.freeze([350, 430] as const),
	wavelengthToWidth: Object.freeze([11.5, 13.2] as const),
	headingAmplitude: Object.freeze([0.71, 0.79] as const),
	phaseOffset: Object.freeze([-0.14, 0.14] as const),
	wetToBankfullWidth: 0.94
});

const TURN = 2 * Math.PI;
const MIN_RADIUS_TO_WIDTH = 2;
const MAX_PHASE_OFFSET = Math.PI / 4;
const BANKFULL_WIDTH_M: Band = [320, 450];
const WAVELENGTH_TO_WIDTH: Band = [10, 14];

function isBand(band: Band, lower: number, upper: number): boolean {
	if (!Array.isArray(band) || band.length !== 2) return false;
	const [min, max] = band;
	return Number.isFinite(min) && Number.isFinite(max) && lower <= min && min <= max && max <= upper;
}

export function valleyParameters(overrides?: Partial<ValleyParameters>): ValleyParameters {
	const parameters = { ...DEFAULT_VALLEY_PARAMETERS, ...overrides };
	const { bankfullWidthM, wavelengthToWidth, headingAmplitude, phaseOffset, wetToBankfullWidth } =
		parameters;
	if (
		!isBand(bankfullWidthM, ...BANKFULL_WIDTH_M) ||
		!isBand(wavelengthToWidth, ...WAVELENGTH_TO_WIDTH) ||
		!isBand(phaseOffset, -MAX_PHASE_OFFSET, MAX_PHASE_OFFSET) ||
		!Number.isFinite(wetToBankfullWidth) ||
		wetToBankfullWidth <= 0 ||
		wetToBankfullWidth > 1
	) {
		throw new RangeError('invalid-valley-parameters');
	}
	// Peak curvature is amplitude times 2π / wavelength.
	const radiusLimitedAmplitude = wavelengthToWidth[0] / (TURN * MIN_RADIUS_TO_WIDTH);
	if (!isBand(headingAmplitude, 0, radiusLimitedAmplitude)) {
		throw new RangeError('invalid-valley-parameters');
	}
	return parameters;
}
