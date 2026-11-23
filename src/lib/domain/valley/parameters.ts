import { defaults } from './settings';
import { defineParams } from '../../core/params';

const {
	guideBankfullWidthBandM,
	guideWavelengthToWidthBandRatio,
	guidePhaseOffsetBandRad,
	guideWindowPhaseBandRad,
	valleyAxisTiltBandRad,
	guideWindowAcrossBandRatio,
	headingQuadratureSampleCount,
	nominalHeadingAmplitudeBandRad,
	headingAmplitudeSearchMaxRad,
	headingAmplitudeSearchIterations,
	sinuosityDefaultRatio,
	sinuosityMinRatio,
	sinuosityMaxRatio,
	sinuosityStepRatio,
	reliefDefaultRatio,
	reliefMinRatio,
	reliefMaxRatio,
	reliefStepRatio,
	runoffDefaultRatio,
	runoffMinRatio,
	runoffMaxRatio,
	runoffStepRatio
} = defaults;

/** Sinuosity is a unitless channel length divided by valley length (endpoint chord).
 * The input sets the nominal ratio over one meander wavelength. A reach clipped to
 * the terrain window is shorter and its measured ratio also depends on the seed.
 */
export const valleyParams = defineParams({
	sinuosity: {
		label: 'Meander',
		unit: 'ratio',
		default: sinuosityDefaultRatio,
		min: sinuosityMinRatio,
		max: sinuosityMaxRatio,
		step: sinuosityStepRatio
	},
	relief: {
		label: 'Relief',
		unit: 'ratio',
		default: reliefDefaultRatio,
		min: reliefMinRatio,
		max: reliefMaxRatio,
		step: reliefStepRatio
	},
	runoff: {
		label: 'Runoff',
		unit: 'ratio',
		default: runoffDefaultRatio,
		min: runoffMinRatio,
		max: runoffMaxRatio,
		step: runoffStepRatio
	}
});

export type Band = readonly [min: number, max: number];

export const defaultBands = {
	bankfullWidth: guideBankfullWidthBandM,
	wavelengthToWidth: guideWavelengthToWidthBandRatio,
	phaseOffset: guidePhaseOffsetBandRad,
	windowPhaseOffset: guideWindowPhaseBandRad,
	axisTilt: valleyAxisTiltBandRad,
	windowAcross: guideWindowAcrossBandRatio
} as const;

export function sampleBand([min, max]: Band, fraction: number): number {
	return min + fraction * (max - min);
}

// The mean forward component of the cosine heading is the reciprocal of the
// full-wave sinuosity. Midpoint integration avoids a dependency on river metrics.
function fullWaveRatio(amplitude: number): number {
	let forward = 0;
	const samples = headingQuadratureSampleCount;
	for (let index = 0; index < samples; index++) {
		forward += Math.cos(amplitude * Math.cos((2 * Math.PI * (index + 0.5)) / samples));
	}
	return samples / forward;
}

export function headingAmplitude(sinuosity: number, curvature: number): number {
	const nominal = sampleBand(nominalHeadingAmplitudeBandRad, curvature);
	const target = sinuosity + fullWaveRatio(nominal) - valleyParams.sinuosity.default;
	let low = 0;
	let high = headingAmplitudeSearchMaxRad;
	for (let index = 0; index < headingAmplitudeSearchIterations; index++) {
		const middle = (low + high) / 2;
		if (fullWaveRatio(middle) < target) low = middle;
		else high = middle;
	}
	return (low + high) / 2;
}
