import { defineParams } from '../../core/params';

/** Sinuosity is a unitless channel length divided by valley length (endpoint chord).
 * The input sets the nominal ratio over one meander wavelength. A reach clipped to
 * the terrain window is shorter and its measured ratio also depends on the seed.
 */
export const valleyParams = defineParams({
	sinuosity: { label: 'Meander', unit: 'ratio', default: 1.15, min: 1.04, max: 1.28, step: 0.01 },
	relief: { label: 'Relief', unit: 'ratio', default: 0, min: 0, max: 1, step: 0.05 },
	lake: { label: 'Lake', unit: 'mode', default: 1, min: 0, max: 2, step: 1 }
});

/** Lake modes by the index of the `lake` parameter: never, drawn by the seed, always. */
export const valleyLakeModes = Object.freeze(['never', 'seeded', 'always'] as const);

export type Band = readonly [min: number, max: number];

export const defaultBands = {
	bankfullWidth: [350, 430],
	wavelengthToWidth: [21, 24],
	phaseOffset: [-0.06, 0.06],
	windowPhaseOffset: [-Math.PI, Math.PI],
	axisTilt: [-0.052, 0.052],
	windowAcross: [-1, 1]
} as const;

export function sampleBand([min, max]: Band, fraction: number): number {
	return min + fraction * (max - min);
}

// The mean forward component of the cosine heading is the reciprocal of the
// full-wave sinuosity. Midpoint integration avoids a dependency on river metrics.
function fullWaveRatio(amplitude: number): number {
	let forward = 0;
	const samples = 32;
	for (let index = 0; index < samples; index++) {
		forward += Math.cos(amplitude * Math.cos((2 * Math.PI * (index + 0.5)) / samples));
	}
	return samples / forward;
}

export function headingAmplitude(sinuosity: number, curvature: number): number {
	const nominal = sampleBand([0.71, 0.79], curvature);
	const target = sinuosity + fullWaveRatio(nominal) - valleyParams.sinuosity.default;
	let low = 0;
	let high = 1.2;
	for (let index = 0; index < 28; index++) {
		const middle = (low + high) / 2;
		if (fullWaveRatio(middle) < target) low = middle;
		else high = middle;
	}
	return (low + high) / 2;
}
