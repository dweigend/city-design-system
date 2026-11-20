import type { Node } from 'three/webgpu';
import {
	color,
	float,
	mix,
	mx_noise_float,
	normalLocal,
	normalViewGeometry,
	positionLocal,
	positionViewDirection,
	reflectVector,
	uv,
	vec3
} from 'three/tsl';
import type { AusfuehrungId } from '../data/materialAusfuehrung';
import type { OberflaechenWerte } from '../logic/material/ausfuehrung';
import { holzMuster } from './materialHolzMuster';
import { mineralMuster } from './materialMineralMuster';
import type { Muster, MusterRaum } from './materialMuster';
import { referenzMuster } from './materialReferenzMuster';

// Fixed spatial offsets are the seed. Coordinates are local metres; no RNG or texture assets.
const saatVektor = vec3(7.31, 2.19, 5.73);
const noise = (p: Node<'vec3'>, scale: number) => mx_noise_float(p.mul(scale));
const reliefVon: Partial<Record<AusfuehrungId, number>> = {
	'keramik-ton': 0.001,
	'acryl-matt': 0.00016,
	'glas-matt': 0.00012
};

function membranMuster(base: Node<'vec3'>, id: AusfuehrungId, p: Node<'vec3'>): Muster {
	const weave = noise(p, 66);
	if (id === 'membran-gewebe' || id === 'membran-voile') {
		return { farbe: base.mul(weave.mul(0.12).add(1)), hoehe: weave, relief: 0.00055 };
	}
	// Incidence works for the orthographic stage and cannot feed back from the bump normal.
	const frontal = normalViewGeometry.dot(positionViewDirection).abs().clamp(0, 1);
	if (id === 'membran-opal') {
		const warm = positionLocal.y.mul(-0.87).add(noise(p, 1.5).mul(0.31)).add(0.97).smoothstep(0, 1);
		const tints = mix(color('#9481cf'), color('#f7ac91'), warm);
		const shell = mix(tints, base, frontal.pow(2).mul(0.34));
		return { farbe: shell, hoehe: weave, relief: 0.00018 };
	}
	const gespannt = frontal.smoothstep(0.02, 0.84).mul(0.55).add(0.45);
	return { farbe: base.mul(gespannt), hoehe: weave, relief: 0.00023 };
}

function gussMuster(base: Node<'vec3'>, p: Node<'vec3'>): Muster {
	// Local Y is the coating's lift in meters. High pools are cooler than the lapis runs.
	const strom = mx_noise_float(p.mul(vec3(3.6, 0.74, 3.6)));
	const pool = positionLocal.y.add(strom.mul(0.95)).smoothstep(0.35, 4.8);
	const wellen = mx_noise_float(p.mul(vec3(17, 3.2, 17)));
	return {
		farbe: mix(base, color('#2ba5d8'), pool.mul(0.78)).mul(strom.mul(0.07).add(1)),
		hoehe: wellen.mul(0.53).add(noise(p, 63).mul(0.11)),
		relief: 0.00135,
		rauheitVersatz: wellen.mul(0.025).sub(pool.mul(0.045))
	};
}

function metalMuster(base: Node<'vec3'>, bare: boolean, p: Node<'vec3'>): Muster {
	const brush = mx_noise_float(p.mul(vec3(1.8, 450, 450)));
	return {
		farbe: base.mul(brush.mul(bare ? 0.1 : 0.012).add(1)),
		hoehe: brush,
		relief: bare ? 0.00035 : 0.00008
	};
}

function feineOberflaeche(
	base: Node<'vec3'>,
	id: AusfuehrungId,
	scale: number,
	relief: number,
	variation: number,
	p: Node<'vec3'>
): Muster {
	return {
		farbe: base.mul(noise(p, 14).mul(variation).add(1)),
		hoehe: noise(p, scale),
		relief: reliefVon[id] ?? relief
	};
}

function wasserMuster(base: Node<'vec3'>, bewegt: boolean, p: Node<'vec3'>): Muster {
	// A shallow shelf along the banks grades into the darker channel bed.
	const u = uv();
	const bank = u.min(float(1).sub(u));
	// The shore zones meet continuously around the corners, without a diagonal seam.
	const radius = 0.092;
	const ecke = float(radius).sub(bank.x.sub(bank.y).abs()).max(0).div(radius);
	const ufer = bank.x
		.min(bank.y)
		.sub(ecke.mul(ecke).mul(radius * 0.25))
		.max(0);
	const tiefe = ufer.add(noise(p, 1.3).mul(0.035)).smoothstep(0.0, 0.25);
	const grund = mix(base.mul(vec3(0.77, 0.91, 1.04)), color('#29639e'), tiefe);
	// Reflect a long sky opening above the canal. Its edge breaks over the solved normals.
	const blick = reflectVector.y
		.add(reflectVector.x.mul(0.12))
		.sub(reflectVector.z.mul(0.09))
		.add(noise(p, 3.9).mul(0.095));
	const himmel = blick.smoothstep(0.31, 0.76);
	const scheitel = blick.smoothstep(0.6, 0.87);
	const wasserlinie = float(1).sub(ufer.smoothstep(0.003, 0.013)).mul(normalLocal.y.abs());
	return {
		farbe: grund,
		hoehe: noise(p, 32).mul(float(1).sub(normalLocal.y.abs())),
		relief: bewegt ? 0.0006 : 0.0004,
		licht: color('#83c0f4')
			.rgb.mul(himmel.pow(1.62).mul(0.36))
			.add(color('#d3edff').rgb.mul(scheitel.pow(2.9).mul(0.42).add(wasserlinie.mul(0.16))))
	};
}

function betonMuster(base: Node<'vec3'>, id: AusfuehrungId, welt: Node<'vec3'>): Muster {
	if (id === 'beton-geadert') return mineralMuster(base, 'veined', welt);
	return mineralMuster(base, id === 'beton-terrazzo' ? 'aggregate' : 'cast', welt);
}

function polymerMuster(base: Node<'vec3'>, id: AusfuehrungId, p: Node<'vec3'>): Muster {
	return id === 'kunststoff-guss'
		? gussMuster(base, p)
		: feineOberflaeche(base, id, 210, 0.00002, 0, p);
}

/** Builds deterministic, metre-scaled surface nodes; returned nodes belong to the material. */
export function oberflaechenMuster(
	w: OberflaechenWerte,
	base: Node<'vec3'>,
	bewegt: boolean,
	raum: MusterRaum
): Muster {
	const referenz = referenzMuster(w.id, base, raum.welt);
	if (referenz) return referenz;
	const p = raum.lokal.add(saatVektor);
	switch (w.familie) {
		case 'beton':
			return betonMuster(base, w.id, raum.welt);
		case 'holz':
			return holzMuster(base, w.id === 'holz-aufrecht', raum);
		case 'metall':
			return metalMuster(base, w.id === 'metall-gebuerstet', p);
		case 'membran':
			return membranMuster(base, w.id, p);
		case 'wasser':
			// Water motion is projected by the heightfield. Generic vertical faces retain fine surface relief.
			return wasserMuster(base, bewegt, p);
		case 'keramik':
			if (w.id === 'keramik-orange-blau') {
				const grain = noise(p, 22);
				const cobalt = uv().x.add(grain.mul(0.08)).smoothstep(0.45, 0.67);
				return { farbe: mix(base, color('#234bb0'), cobalt), hoehe: grain, relief: 0.0004 };
			}
			return feineOberflaeche(base, w.id, 27, 0.0004, 0.025, p);
		case 'kunststoff':
			return polymerMuster(base, w.id, p);
		case 'glas':
			return feineOberflaeche(base, w.id, 210, 0, 0, p);
		case 'bestand':
			return {
				farbe: base.mul(noise(p, 18).mul(0.008).add(1)),
				hoehe: noise(p, 130),
				relief: 0.00012
			};
	}
}
