import type { Random } from '../../core/random';
import { defaultBands, headingAmplitude, sampleBand } from './parameters';
import { alignmentFor, maxWindowOffset, placeCourse, windowOffset } from './window-placement';

/** Downstream XY vertices 6.25 m apart by chainage. Widths apply to every vertex, in meters. */
export type RiverCourse = Readonly<{
	xy: readonly number[];
	bankfullWidth: number;
	wetWidth: number;
	bearing: number;
}>;

export const courseSpacing = 6.25;
const regionalRadius = 13_000 / Math.SQRT2;
const turn = 2 * Math.PI;

function courseShape(
	random: Random,
	sinuosity: number,
	bankfullWidth: number,
	offset: number,
	frameBearing: number
) {
	const curvature = random.derive('curvature').number();
	const amplitude = headingAmplitude(sinuosity, curvature);
	const wavelength = bankfullWidth * sampleBand(defaultBands.wavelengthToWidth, curvature);
	const phase =
		sampleBand(defaultBands.phaseOffset, random.derive('phase').number()) +
		sampleBand(defaultBands.windowPhaseOffset, random.derive('window-phase').number());
	const bearing = frameBearing - amplitude * Math.cos(phase) * alignmentFor(offset);
	return {
		amplitude,
		bearing,
		heading: (station: number) =>
			bearing + amplitude * Math.cos((turn * station) / wavelength + phase)
	};
}

export function generateCourse(
	random: Random,
	sinuosity: number,
	openSide: number,
	frameBearing: number
): RiverCourse {
	const bankfullWidth = sampleBand(defaultBands.bankfullWidth, random.derive('width').number());
	const offset = windowOffset(random.derive('window'), openSide);
	const { amplitude, bearing, heading } = courseShape(
		random,
		sinuosity,
		bankfullWidth,
		offset,
		frameBearing
	);
	// Every step advances by at least this projection along the mean bearing.
	const minimumAdvance = courseSpacing * Math.cos(amplitude);
	const midpoint = Math.ceil((regionalRadius + maxWindowOffset) / minimumAdvance) + 1;
	const xy = new Array<number>(2 * (2 * midpoint + 1));
	xy[0] = 0;
	xy[1] = 0;
	for (let i = 1; i <= 2 * midpoint; i++) {
		const angle = heading((i - midpoint - 0.5) * courseSpacing);
		xy[2 * i] = xy[2 * (i - 1)] + courseSpacing * Math.cos(angle);
		xy[2 * i + 1] = xy[2 * (i - 1) + 1] + courseSpacing * Math.sin(angle);
	}
	placeCourse(xy, midpoint, courseSpacing, offset);
	return Object.freeze({
		xy: Object.freeze(xy),
		bearing,
		bankfullWidth,
		wetWidth: bankfullWidth * 0.94
	});
}
