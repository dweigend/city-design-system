import {
	DataTexture,
	EquirectangularReflectionMapping,
	FloatType,
	LinearFilter,
	LinearSRGBColorSpace,
	RGBAFormat,
	MathUtils
} from 'three/webgpu';

export type MetallLicht = 'metall-messing' | 'metall-kupfer' | 'studio';

const himmelFarbe: Record<MetallLicht, readonly [number, number, number]> = {
	studio: [1.05, 1.02, 0.96],
	'metall-messing': [0.62, 0.7, 0.86],
	'metall-kupfer': [0.86, 0.97, 1.13]
};
const breit = 192;
const hoch = 96;

function lichtfeld(winkel: number, mitte: number, radius: number) {
	const bogen = Math.atan2(Math.sin(winkel - mitte), Math.cos(winkel - mitte));
	return 1 - MathUtils.smoothstep(Math.abs(bogen), radius, radius + 0.05);
}

function spiegelFarben(phi: number, hoehe: number, farbe: readonly [number, number, number]) {
	const himmel = MathUtils.smoothstep(hoehe, -0.11, 0.36);
	const karte =
		lichtfeld(phi, 2.24, 0.58) *
		MathUtils.smoothstep(hoehe, -0.72, -0.52) *
		(1 - MathUtils.smoothstep(hoehe, 0.25, 0.38));
	const fenster =
		lichtfeld(phi, -0.69, 0.31) *
		MathUtils.smoothstep(hoehe, -0.59, -0.43) *
		(1 - MathUtils.smoothstep(hoehe, 0.09, 0.19));
	const gold = lichtfeld(phi, -1.38, 0.55) * (1 - MathUtils.smoothstep(hoehe, 0.06, 0.26));
	// Linear HDR radiance of the overhead softbox and the tall strip reflected along bevels.
	const softbox =
		lichtfeld(phi, -2.38, 0.82) *
		MathUtils.smoothstep(hoehe, 0.34, 0.48) *
		(1 - MathUtils.smoothstep(hoehe, 0.82, 0.94));
	const licht = karte * 2.8 + fenster * 1.65 + softbox * 5.2;
	const boden =
		(1 - MathUtils.smoothstep(hoehe, -0.6, 0.06)) *
		(0.075 + 0.21 * Math.pow(0.5 + 0.5 * Math.cos(phi * 2 + 0.45), 2));
	return [
		0.081 + boden + himmel * farbe[0] + licht + gold * 0.42,
		0.083 + boden * 0.93 + himmel * farbe[1] + licht * 1.04 + gold * 0.24,
		0.091 + boden * 0.8 + himmel * farbe[2] + licht * 1.15 + gold * 0.095,
		1
	];
}

/**
 * Generates a deterministic linear HDR reflection environment from a sky and two studio cards.
 * The stage material pool owns the returned texture. The image is used only for reflection.
 */
export function metallUmgebung(id: MetallLicht): DataTexture {
	const farbe = himmelFarbe[id];
	const pixel = new Float32Array(breit * hoch * 4);
	for (let y = 0; y < hoch; y++) {
		const hoehe = Math.sin(((y + 0.5) / hoch - 0.5) * Math.PI);
		for (let x = 0; x < breit; x++) {
			const phi = ((x + 0.5) / breit - 0.5) * Math.PI * 2;
			pixel.set(spiegelFarben(phi, hoehe, farbe), (y * breit + x) * 4);
		}
	}
	const map = new DataTexture(pixel, breit, hoch, RGBAFormat, FloatType);
	map.mapping = EquirectangularReflectionMapping;
	map.colorSpace = LinearSRGBColorSpace;
	map.minFilter = map.magFilter = LinearFilter;
	map.needsUpdate = true;
	return map;
}
