import type { Node } from 'three/webgpu';
import { color, float, mix, mx_noise_float, normalLocal, positionLocal } from 'three/tsl';
import type { Muster } from './materialMuster';

type Raster = (koordinaten: Node<'vec2'>) => {
	farbe: Node<'vec3'>;
	hoehe: Node<'float'>;
};

function dreiseitig(raster: Raster) {
	const x = raster(positionLocal.zy);
	const y = raster(positionLocal.xz);
	const z = raster(positionLocal.xy);
	const gewicht = normalLocal.abs().pow(8);
	const summe = gewicht.x.add(gewicht.y).add(gewicht.z).max(1e-6);
	return {
		farbe: x.farbe
			.mul(gewicht.x)
			.add(y.farbe.mul(gewicht.y))
			.add(z.farbe.mul(gewicht.z))
			.div(summe),
		hoehe: x.hoehe.mul(gewicht.x).add(y.hoehe.mul(gewicht.y)).add(z.hoehe.mul(gewicht.z)).div(summe)
	};
}

// A derivative-based edge preserves the line at both specimen and thumbnail distances.
function linie(phase: Node<'float'>, halbbreite: number) {
	const abstand = phase.fract().sub(0.5).abs();
	const pixel = phase.fwidth().mul(0.65).clamp(0.001, 0.49);
	return float(1).sub(
		abstand.smoothstep(float(halbbreite).sub(pixel), float(halbbreite).add(pixel))
	);
}

/** Wraps 32 cm glazed tiles around the local axes. Returned height drives recessed grout in metres. */
export function schachbrettMuster(base: Node<'vec3'>): Muster {
	const felder = dreiseitig((p) => {
		const uv = p.div(0.32).add(0.16);
		const schwarz = uv.x.floor().add(uv.y.floor()).mod(2);
		const farbe = mix(base, color('#222731'), schwarz);
		const kantenAbstand = uv.add(0.5).fract().sub(0.5).abs();
		const fuge = linie(uv.x.add(0.5), 0.022).max(linie(uv.y.add(0.5), 0.022));
		return {
			farbe: mix(farbe, color('#777671'), fuge.mul(0.9)),
			hoehe: kantenAbstand.x.min(kantenAbstand.y).smoothstep(0.01, 0.045)
		};
	});
	return { ...felder, relief: 0.005, rauheitVersatz: float(1).sub(felder.hoehe).mul(0.48) };
}

/** Projects a metre-scaled photovoltaic cell lattice beneath smooth reflective glass. */
export function solarMuster(base: Node<'vec3'>): Muster {
	const zellen = dreiseitig((p) => {
		const uv = p.div(0.27).add(0.41);
		const kristall = mx_noise_float(uv.floor().mul(0.86)).mul(0.34).add(1);
		const rand = linie(uv.x.add(0.5), 0.038).max(linie(uv.y.add(0.5), 0.039));
		const draht = linie(uv.y.mul(6), 0.056).mul(0.22).max(linie(uv.x, 0.024).mul(0.58));
		const zelle = mix(base.mul(kristall), color('#b9c6d6'), draht);
		return { farbe: mix(zelle, color('#a1afbd'), rand.mul(0.87)), hoehe: float(0) };
	});
	return { ...zellen, relief: 0 };
}
