/**
 * A recipe as readable TSL code: one line per node with the values of the recipe.
 * Mirrors scene/materialRezept.ts line by line; helper nodes (blatt, strich, fenster,
 * umriss, glanzpunkt, flaechenton) are named as there. Pure, without three.js.
 */
import type { FugenArt, KnotenId, RauschArt } from '../../data/materialSeite';
import { deckung, type Rezept } from './rezept';

const n2 = (v: number) => v.toFixed(2);

const rauschCode: Record<RauschArt, (m: number) => string> = {
	poren: (m) =>
		`mx_fractal_noise_float(positionWorld.mul(${n2(m)})).mul(0.8).sub(float(1).sub(mx_worley_noise_float(positionWorld.mul(${n2(m * 2)})).smoothstep(0.06, 0.14)).mul(1.6))`,
	maser: (m) =>
		`sin(blatt.x.mul(${n2(m * 6)}).add(mx_noise_float(positionWorld.mul(vec3(${n2(m * 0.8)}, ${n2(m * 0.12)}, ${n2(m * 0.8)}))).mul(1.6)))`,
	schliff: (m) =>
		`mx_noise_float(positionWorld.mul(vec3(${n2(m)}, ${n2(m * 40)}, ${n2(m)}))).mul(1.4)`,
	glasur: (m) => `mx_fractal_noise_float(positionWorld.mul(${n2(m)}))`,
	schlieren: (m) => `mx_noise_float(positionWorld.mul(vec3(${n2(m)}, ${n2(m * 4)}, ${n2(m)})))`,
	faser: (m) => `mx_noise_float(vec3(blatt.mul(vec2(${n2(m * 8)}, ${n2(m)})), 0))`,
	welle: (m) =>
		`mx_noise_float(vec3(positionWorld.x.mul(${n2(m)}), positionWorld.z.mul(${n2(m)}), positionWorld.y.mul(${n2(m * 2)}).add(time.mul(0.4))))`
};

const fugenCode: Record<FugenArt, (a: number) => string> = {
	schalung: (a) => `strich(positionWorld.y.div(${n2(a)}), 0.02)`,
	lamelle: (a) => `strich(blatt.x.div(${n2(a)}), 0.07)`,
	paneel: (a) => `strich(blatt.x.div(${n2(a)}), 0.012)`,
	fliese: (a) =>
		`max(strich(blatt.x.div(${n2(a)}), 0.03), strich(positionWorld.y.div(${n2(a)}), 0.03))`,
	sprosse: (a) =>
		`max(strich(blatt.x.div(${n2(a)}), 0.035), strich(positionWorld.y.div(${n2(a)}), 0.035))`,
	naht: (a) => `strich(positionWorld.y.div(${n2(a)}).add(sin(blatt.x).mul(0.15)), 0.025)`,
	geschoss: (a) => `strich(positionWorld.y.div(${n2(a)}), 0.012)`,
	fenster: (a) => `fenster(vec2(blatt.x, positionWorld.y).div(${n2(a)}), vec2(0.4, 0.55))`,
	strom: (a) =>
		`strich(blatt.x.div(${n2(a)}).add(time.mul(0.3)).add(mx_noise_float(positionWorld.mul(0.6)).mul(0.6)), 0.04)`
};

/** Color node: flow with paper, on a neutral surface its own tone, then a hint of ink. */
function farbCode(r: Rezept): string {
	const f = r.farbe;
	let c = f.token === '--paper' ? 'color(papier)' : `color(strom /* ${f.token} */)`;
	if (f.papier) c = `mix(${c}, papier, ${n2(f.papier)})`;
	if (f.tint.toward && f.token === '--paper')
		c = `mix(${c}, color(/* ${f.tint.toward} */), ${n2(f.tint.amount ?? 0)})`;
	if (f.tint.ink) c = `mix(${c}, tinte, ${n2(f.tint.ink)})`;
	return `let c = ${c}.mul(ton);`;
}

/** One line of TSL per node, with the values of this recipe. */
export function tslQuelle(r: Rezept): { knoten: KnotenId; code: string }[] {
	const d = deckung(r.haut);
	const zeilen: { knoten: KnotenId; code: string }[] = [
		{
			knoten: 'ton',
			code: `const ton = mix(float(1), flaechenton(normalWorld), ${n2(r.ton.kontrast)});`
		},
		{
			knoten: 'farbe',
			code: farbCode(r)
		},
		{
			knoten: 'rauschen',
			code: r.rauschen
				? `c = c.mul(${rauschCode[r.rauschen.art](r.rauschen.massstab)}.mul(${n2(r.rauschen.staerke)}).add(1));`
				: '// no noise'
		},
		{
			knoten: 'fugen',
			code: r.fugen
				? `c = mix(c, ${r.fugen.art === 'strom' ? 'licht' : 'tinte'}, ${fugenCode[r.fugen.art](r.fugen.abstand)}.mul(${n2(r.fugen.staerke)}));`
				: '// no joints'
		},
		{
			knoten: 'kante',
			code: r.kante
				? `c = mix(c, kantenfarbe, umriss(normalView)); // edges: ${n2(r.kante.breite)} × stroke, ${Math.round(r.kante.papier * 100)} % paper`
				: '// no edge'
		},
		{
			knoten: 'haut',
			code: [
				r.haut.glanz
					? `c = mix(c, licht, max(glanzpunkt(${n2(r.haut.glanzbreite)}).mul(${n2(r.haut.glanz)}), fresnel.smoothstep(0.8, 0.86).mul(${n2(r.haut.glanz * 0.45)})));`
					: '',
				r.haut.sheen ? `c = mix(c, licht, fresnel.pow(2).mul(${n2(r.haut.sheen)}));` : '',
				r.haut.truebung
					? `c = mix(c, papier.mul(ton), fresnel.mul(0.65).add(0.35).mul(${n2(r.haut.truebung)}));\nc = select(frontFacing, c, mix(c, papier, 0.35));`
					: '',
				d.hinten
					? `c = mix(c, unscharf(viewportMipTexture(), ${n2(r.haut.unschaerfe)}), ${n2(d.hinten)}); // five taps`
					: '',
				`material.opacityNode = float(${n2(d.opacity)});`
			]
				.filter(Boolean)
				.join('\n')
		}
	];
	return zeilen;
}
