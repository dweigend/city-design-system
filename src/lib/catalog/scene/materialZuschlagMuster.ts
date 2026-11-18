import type { Node } from 'three/webgpu';
import { color, float, mix, mx_noise_float, mx_worley_noise_float, vec3 } from 'three/tsl';
import type { Muster } from './materialMuster';

const rauschen = (p: Node<'vec3'>, skala: number) => mx_noise_float(p.mul(skala));

/** Cast mineral foam with differently sized open pores and lighter binder rims. */
export function schaumMuster(base: Node<'vec3'>, welt: Node<'vec3'>): Muster {
	const p = welt.add(vec3(9.37, 2.31, 5.76));
	const poren = mx_worley_noise_float(p.mul(12), 1).add(rauschen(p, 7.9).mul(0.13));
	const tief = float(1).sub(poren.smoothstep(0.13, 0.34));
	const rand = poren.smoothstep(0.18, 0.27).mul(float(1).sub(poren.smoothstep(0.36, 0.44)));
	const binder = base.mul(rauschen(p, 3).mul(0.12).add(1));
	return {
		farbe: mix(mix(binder, color('#f6e7aa'), rand.mul(0.48)), color('#5b501a'), tief.mul(0.89)),
		hoehe: rand.mul(0.23).sub(tief).add(rauschen(p, 92).mul(0.12)),
		relief: 0.009
	};
}

/** Raised, irregular blue splashes with a separate population of ochre satellite droplets. */
export function spritzerMuster(base: Node<'vec3'>, welt: Node<'vec3'>): Muster {
	const p = welt.add(vec3(9.37, 2.31, 5.76));
	const feld = p.mul(vec3(1.72, 0.79, 1.72));
	const tropfen = mx_noise_float(feld).add(rauschen(p, 9).mul(0.33)).add(rauschen(p, 27).mul(0.08));
	const blau = tropfen.smoothstep(0.21, 0.32);
	const gelb = rauschen(p, 9).add(rauschen(p, 16).mul(0.25)).smoothstep(0.36, 0.54);
	const schlieren = mx_noise_float(feld.mul(vec3(1, 0.52, 1))).smoothstep(0.12, 0.55);
	const beton = base.mul(rauschen(p, 48).mul(0.075).add(1));
	return {
		farbe: mix(
			mix(beton, color('#e7c32f'), gelb),
			mix(color('#12459a'), color('#1678bd'), schlieren),
			blau
		),
		hoehe: blau.mul(0.82).add(gelb.mul(0.24)).add(rauschen(p, 88).mul(0.12)),
		relief: 0.004,
		rauheitVersatz: blau.mul(-0.28)
	};
}

/** Shades blue pile as tightly packed tufts with directional fibers of two spatial scales. */
export function florMuster(base: Node<'vec3'>, welt: Node<'vec3'>): Muster {
	const p = welt.add(vec3(9.37, 2.31, 5.76));
	const masche = p
		.mul(vec3(17, 4.7, 17))
		.add(vec3(rauschen(p, 5), rauschen(p, 7), rauschen(p, 5.3)).mul(1.06));
	const bueschel = mx_worley_noise_float(masche, 1);
	const spitzen = float(1).sub(bueschel.smoothstep(0.12, 0.88)).pow(1.9);
	const fasern = mx_noise_float(p.mul(vec3(150, 29, 150)));
	const schatten = base.mul(0.46);
	return {
		farbe: mix(schatten, base.mul(vec3(1.12, 1.4, 1.52)), spitzen).mul(fasern.mul(0.19).add(1)),
		hoehe: spitzen.mul(0.82).add(fasern.mul(0.23)),
		relief: 0.017,
		rauheitVersatz: spitzen.mul(-0.11)
	};
}
