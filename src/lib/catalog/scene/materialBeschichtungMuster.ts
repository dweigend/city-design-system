import type { Node } from 'three/webgpu';
import {
	color,
	float,
	mix,
	mx_noise_float,
	mx_worley_noise_vec2,
	positionLocal,
	vec3
} from 'three/tsl';
import type { Muster } from './materialMuster';

const rauschen = (p: Node<'vec3'>, skala: number) => mx_noise_float(p.mul(skala));

/** Fine directional brushing spreads the reflection across the brass face. */
export function messingMuster(base: Node<'vec3'>, welt: Node<'vec3'>): Muster {
	const brush = mx_noise_float(welt.mul(vec3(1.4, 35, 35)));
	return { farbe: base, hoehe: brush, relief: 0.00035, rauheitVersatz: brush.mul(0.08) };
}

/** Copper darkens and grows matte in irregular oxidized patches; the height is in metres. */
export function kupferMuster(base: Node<'vec3'>, welt: Node<'vec3'>): Muster {
	const p = welt.add(vec3(4.29, 8.14, 2.63));
	const flecken = rauschen(p, 2.8).add(rauschen(p, 13).mul(0.43)).add(rauschen(p, 49).mul(0.13));
	const oxid = flecken.smoothstep(0.18, 0.53);
	const patina = flecken.smoothstep(0.42, 0.7);
	const kupfer = mix(base, color('#743422'), oxid.mul(0.78));
	return {
		farbe: mix(kupfer, color('#4f8978'), patina.mul(0.8)),
		hoehe: rauschen(p, 86).mul(0.14).add(oxid),
		relief: 0.0018,
		rauheitVersatz: oxid.mul(0.46),
		metallVersatz: oxid.mul(-0.53)
	};
}

/** Adds satin crest highlights and extrusion striations to the blue polymer. */
export function rippenMuster(base: Node<'vec3'>, welt: Node<'vec3'>): Muster {
	const p = welt.add(vec3(4.29, 8.14, 2.63));
	const rippe = positionLocal.x
		.mul((Math.PI * 2) / 0.39)
		.cos()
		.mul(0.5)
		.add(0.5);
	const strich = mx_noise_float(p.mul(vec3(73, 3, 55)));
	return {
		farbe: base.mul(rippe.mul(0.28).add(0.81)).mul(strich.mul(0.055).add(1)),
		hoehe: strich.mul(0.08).add(rippe),
		relief: 0.012,
		rauheitVersatz: rippe.mul(-0.13)
	};
}

/** Cast-in color streaks travel through the volume and meet continuously on adjacent faces. */
export function harzMuster(base: Node<'vec3'>, welt: Node<'vec3'>): Muster {
	const p = welt.add(vec3(4.29, 8.14, 2.63));
	const strom = p
		.mul(vec3(1.6, 0.79, 1.6))
		.add(vec3(rauschen(p, 0.89), rauschen(p, 1.4), rauschen(p, 1.23)));
	const wolke = mx_noise_float(strom).add(rauschen(p, 4.8).mul(0.3));
	const blau = wolke.smoothstep(0.01, 0.51);
	const koralle = wolke.negate().smoothstep(0.19, 0.53);
	const wolken = mix(base, color('#60afc7'), blau.mul(0.77));
	return {
		farbe: mix(wolken, color('#ef9589'), koralle.mul(0.78)),
		hoehe: rauschen(p, 12).mul(0.19).add(wolke.mul(0.25)),
		relief: 0.006,
		rauheitVersatz: wolke.mul(0.08)
	};
}

/** Irregular foil creases cut across the adjacent planes; metal highlights follow their normals. */
export function goldfolieMuster(base: Node<'vec3'>, welt: Node<'vec3'>): Muster {
	const p = welt.add(vec3(4.29, 8.14, 2.63));
	const raster = p.mul(5.4).add(vec3(rauschen(p, 3), rauschen(p, 4), rauschen(p, 5)).mul(0.62));
	const zellen = mx_worley_noise_vec2(raster, 1);
	const falten = zellen.y.sub(zellen.x).smoothstep(0.01, 0.34);
	const kante = float(1).sub(falten);

	return {
		farbe: mix(base, color('#f6d78d'), kante.mul(0.46)),
		hoehe: falten.mul(0.85).add(rauschen(p, 27).mul(0.14)),
		relief: 0.0031,
		rauheitVersatz: kante.mul(-0.15)
	};
}
