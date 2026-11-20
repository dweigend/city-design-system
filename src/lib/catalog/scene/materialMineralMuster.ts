import { pavingFlecks, terrazzoChips } from './pattern-density';
import { Mesh, Vector3, type Node } from 'three/webgpu';
import {
	Fn,
	attribute,
	color,
	uniform,
	modelScale,
	float,
	mix,
	mx_noise_float,
	mx_worley_noise_float,
	mx_worley_noise_vec2,
	vec3
} from 'three/tsl';

// Meter-scale 3D deposits cross panels and roof without restarting at part origins.
const noise = (p: Node<'vec3'>, frequenz: number) => mx_noise_float(p.mul(frequenz));
const feld = (p: Node<'vec3'>, frequenz: number) =>
	vec3(noise(p, frequenz), noise(p, frequenz * 1.13), noise(p, frequenz * 1.27));

function zone(abstand: Node<'float'>, innen: number, aussen: number) {
	return float(1).sub(abstand.smoothstep(innen, aussen));
}

function guss(base: Node<'vec3'>, p: Node<'vec3'>) {
	const poren = zone(mx_worley_noise_float(p.mul(45)), 0.065, 0.21);
	return {
		farbe: base.mul(noise(p, 0.9).mul(0.12).add(1)).mul(float(1).sub(poren.mul(0.22))),
		hoehe: noise(p, 27).mul(0.25).add(noise(p, 95).mul(0.13)).sub(poren.mul(0.62)),
		relief: 0.0032
	};
}

function zuschlag(base: Node<'vec3'>, p: Node<'vec3'>) {
	const dimensions = Fn((builder) => {
		if (builder.geometry.hasAttribute('surfaceExtents')) return attribute('surfaceExtents', 'vec3');
		return uniform(new Vector3()).onObjectUpdate(({ object }, node) => {
			if (!(object instanceof Mesh)) return node.value;
			const geometry = object.geometry;
			if (!geometry.boundingBox) geometry.computeBoundingBox();
			return geometry.boundingBox?.getSize(node.value) ?? node.value;
		});
	})().mul(modelScale.abs());
	const fine = dimensions.x.min(dimensions.y).min(dimensions.z).lessThan(3);
	const large = terrazzoChips(p, 1.7);
	const small = pavingFlecks(p);
	const coarse = mix(
		mix(base, color('#777471'), large.negate().max(0)),
		color('#ead9be'),
		large.max(0)
	);
	const fineFace = base.mul(small.mul(0.1).add(1));
	return { farbe: fine.select(fineFace, coarse), hoehe: float(0), relief: 0 };
}

function bruchAbstand(p: Node<'vec3'>) {
	// Gaps between the nearest two cell distances form a connected fracture network.
	const schraeg = vec3(
		p.x.add(p.y.mul(0.38)).add(p.z.mul(0.31)),
		p.y.mul(0.24).sub(p.x.mul(0.2)),
		p.z.sub(p.y.mul(0.35))
	);
	const verzogen = schraeg.mul(0.76).add(feld(p, 0.84).mul(0.52)).add(feld(p, 6.7).mul(0.064));
	const abstaende = mx_worley_noise_vec2(verzogen, 0.98);
	return abstaende.y.sub(abstaende.x);
}

function aderung(base: Node<'vec3'>, p: Node<'vec3'>) {
	const bruch = bruchAbstand(p);
	const blau = noise(p, 0.89).add(noise(p, 5).mul(0.32)).smoothstep(-0.22, 0.13);
	const grau = zone(bruch, 0.035, 0.16);
	const rand = zone(bruch, 0.045, 0.205).mul(blau);
	const kern = zone(bruch, 0.012, 0.072).mul(blau);
	const blush = noise(p, 1.6).smoothstep(0.04, 0.5).mul(0.57);
	const grund = mix(base, color('#dc9a8b'), blush);
	const randstein = mix(grund, color('#89939d'), grau.mul(0.24));
	const blauRand = mix(randstein, color('#5c9fc4'), rand.mul(0.59));
	return {
		farbe: mix(blauRand, color('#204b9d'), kern.mul(0.86)),
		hoehe: noise(p, 40)
			.mul(0.19)
			.add(noise(p, 5).mul(0.12))
			.sub(zone(bruch, 0.02, 0.095).mul(0.56)),
		relief: 0.0045
	};
}

/** Projects the three concrete finishes with analytic height in meters and independent pigment. */
export function mineralMuster(
	base: Node<'vec3'>,
	art: 'cast' | 'aggregate' | 'veined',
	welt: Node<'vec3'>
) {
	const p = welt.add(vec3(13.7, 3.9, 8.2));
	if (art === 'veined') return aderung(base, p);
	if (art === 'aggregate') return zuschlag(base, p);
	return guss(base, p);
}
