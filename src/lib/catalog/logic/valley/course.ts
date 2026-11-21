import { hash } from '../../core/random';
import { VALLEY_MEASUREMENT_PROTOCOL } from '../../data/valley-references';
import type { ValleyParameters } from './parameters';

export type RiverCourse = Readonly<{
	xy: Float64Array;
	chainageM: Float64Array;
	bankfullWidthM: number;
}>;

const MAIN_STEM_ID = 0;
const CHANNEL = { heading: 0, phase: 1, curvature: 2, width: 3 } as const;
const REGIONAL_RADIUS_M = VALLEY_MEASUREMENT_PROTOCOL.regionalWindowM / Math.SQRT2;
const SPACING_M = VALLEY_MEASUREMENT_PROTOCOL.courseSpacingM;
const TURN = 2 * Math.PI;

// The same curvature draw sets amplitude and wavelength within their declared bands.
function headingAt(seed: number, parameters: ValleyParameters, bankfullWidthM: number) {
	const { headingAmplitude, wavelengthToWidth, phaseOffset } = parameters;
	const phase = sampleBand(phaseOffset, hash(seed, MAIN_STEM_ID, CHANNEL.phase));
	const curvature = hash(seed, MAIN_STEM_ID, CHANNEL.curvature);
	const amplitude = sampleBand(headingAmplitude, curvature);
	const wavelength = bankfullWidthM * sampleBand(wavelengthToWidth, curvature);
	const bearing = TURN * hash(seed, MAIN_STEM_ID, CHANNEL.heading);
	return (chainage: number) =>
		bearing + amplitude * Math.cos((TURN * chainage) / wavelength + phase);
}

function sampleBand([min, max]: readonly [number, number], fraction: number): number {
	return min + fraction * (max - min);
}

function centerCourse(xy: Float64Array, midpoint: number): void {
	const x = xy[2 * midpoint];
	const y = xy[2 * midpoint + 1];
	for (let i = 0; i < xy.length; i += 2) {
		xy[i] -= x;
		xy[i + 1] -= y;
	}
}

export function generateCourse(seed: number, parameters: ValleyParameters): RiverCourse {
	const bankfullWidthM = sampleBand(
		parameters.bankfullWidthM,
		hash(seed, MAIN_STEM_ID, CHANNEL.width)
	);
	const heading = headingAt(seed, parameters, bankfullWidthM);
	// Every step advances by at least this projection along the mean bearing.
	const minimumAdvance = SPACING_M * Math.cos(parameters.headingAmplitude[1]);
	const midpoint = Math.ceil(REGIONAL_RADIUS_M / minimumAdvance) + 1;
	const chainageM = new Float64Array(2 * midpoint + 1);
	const xy = new Float64Array(2 * chainageM.length);
	for (let i = 1; i < chainageM.length; i++) {
		chainageM[i] = i * SPACING_M;
		const angle = heading((i - midpoint - 0.5) * SPACING_M);
		xy[2 * i] = xy[2 * (i - 1)] + SPACING_M * Math.cos(angle);
		xy[2 * i + 1] = xy[2 * (i - 1) + 1] + SPACING_M * Math.sin(angle);
	}
	centerCourse(xy, midpoint);
	return Object.freeze({ xy, chainageM, bankfullWidthM });
}
