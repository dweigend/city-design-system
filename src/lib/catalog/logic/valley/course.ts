import { hash } from '../../core/random';
import { sampleBand, type ValleyParameters } from './parameters';
import { alignmentFor, MAX_WINDOW_OFFSET_M, placeCourse, windowOffset } from './window-placement';

export type RiverCourse = Readonly<{
	xy: Float64Array;
	meanBearingRad: number;
	frameBearingRad: number;
	windowOffsetM: number;
	phaseOffset: number;
	windowPhaseOffset: number;
	chainageM: Float64Array;
	bankfullWidthM: number;
	wetWidthM: number;
}>;

const MAIN_STEM_ID = 0;
const CHANNEL = { heading: 0, phase: 1, curvature: 2, width: 3, window: 4 } as const;
const REGIONAL_COVERAGE_M = 8_000;
const REGIONAL_RADIUS_M = REGIONAL_COVERAGE_M / Math.SQRT2;
const SPACING_M = 6.25;
const TURN = 2 * Math.PI;

// The same curvature draw sets amplitude and wavelength within their declared bands.
function courseShape(
	seed: number,
	parameters: ValleyParameters,
	bankfullWidthM: number,
	bearingRad?: number
) {
	const { headingAmplitude, wavelengthToWidth, phaseOffset, windowPhaseOffset } = parameters;
	const phase = sampleBand(phaseOffset, hash(seed, MAIN_STEM_ID, CHANNEL.phase));
	const curvature = hash(seed, MAIN_STEM_ID, CHANNEL.curvature);
	const amplitude = sampleBand(headingAmplitude, curvature);
	const wavelength = bankfullWidthM * sampleBand(wavelengthToWidth, curvature);
	const frameBearingRad =
		bearingRad === undefined ? TURN * hash(seed, MAIN_STEM_ID, CHANNEL.heading) : bearingRad % TURN;
	const windowPhase = sampleBand(windowPhaseOffset, hash(seed, MAIN_STEM_ID, CHANNEL.window));
	const windowOffsetM = windowOffset(seed, parameters);
	const headingAtCenter = amplitude * Math.cos(phase + windowPhase);
	const bearing = frameBearingRad - headingAtCenter * alignmentFor(windowOffsetM);
	return {
		frameBearingRad,
		windowOffsetM,
		meanBearingRad: bearing,
		phaseOffset: phase,
		windowPhaseOffset: windowPhase,
		heading: (chainage: number) =>
			bearing + amplitude * Math.cos((TURN * chainage) / wavelength + phase + windowPhase)
	};
}

/** Integrates the seeded main stem at fixed chainage intervals. */
export function generateCourse(
	seed: number,
	parameters: ValleyParameters,
	bearingRad?: number
): RiverCourse {
	const bankfullWidthM = sampleBand(
		parameters.bankfullWidthM,
		hash(seed, MAIN_STEM_ID, CHANNEL.width)
	);
	const {
		heading,
		meanBearingRad,
		frameBearingRad,
		phaseOffset,
		windowPhaseOffset,
		windowOffsetM
	} = courseShape(seed, parameters, bankfullWidthM, bearingRad);
	// Every step advances by at least this projection along the mean bearing.
	const minimumAdvance = SPACING_M * Math.cos(parameters.headingAmplitude[1]);
	const midpoint = Math.ceil((REGIONAL_RADIUS_M + MAX_WINDOW_OFFSET_M) / minimumAdvance) + 1;
	const chainageM = new Float64Array(2 * midpoint + 1);
	const xy = new Float64Array(2 * chainageM.length);
	for (let i = 1; i < chainageM.length; i++) {
		chainageM[i] = i * SPACING_M;
		const angle = heading((i - midpoint - 0.5) * SPACING_M);
		xy[2 * i] = xy[2 * (i - 1)] + SPACING_M * Math.cos(angle);
		xy[2 * i + 1] = xy[2 * (i - 1) + 1] + SPACING_M * Math.sin(angle);
	}
	placeCourse(xy, midpoint, SPACING_M, windowOffsetM);
	const { wetToBankfullWidth } = parameters;
	return Object.freeze({
		xy,
		meanBearingRad,
		frameBearingRad,
		windowOffsetM,
		phaseOffset,
		windowPhaseOffset,
		chainageM,
		bankfullWidthM,
		wetWidthM: bankfullWidthM * wetToBankfullWidth
	});
}
