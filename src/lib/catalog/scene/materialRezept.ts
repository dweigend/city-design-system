/**
 * TSL translation of a material recipe (logic/material/rezept.ts): six nodes, one to one.
 * Tone → color → noise → joints → edge (outline) → skin (gloss, turbidity, diffusion, opacity).
 * No light, no bitmap: everything is analytic on the world position, hence seamless on every
 * form. Compiles for WebGPU (WGSL) and the WebGL 2 fallback (GLSL).
 */
import * as THREE from 'three/webgpu';
import type { Node } from 'three/webgpu';
import {
	abs,
	color,
	dot,
	float,
	frontFacing,
	max,
	mix,
	mx_fractal_noise_float,
	mx_noise_float,
	mx_worley_noise_float,
	normalView,
	positionWorld,
	screenSize,
	screenUV,
	select,
	sin,
	time,
	vec2,
	vec3,
	viewportMipTexture
} from 'three/tsl';
import type { Palette3D } from '../data/city3d';
import { deckung, type Rezept } from '../logic/material/rezept';
import { blatt, strich } from './schraffur';
import { faceTone } from './surfaces';
import { tokenColor } from './material';

const srgbMix = (a: THREE.Color, b: THREE.Color, t: number) =>
	a.clone().convertLinearToSRGB().lerp(b.clone().convertLinearToSRGB(), t).convertSRGBToLinear();

/** Base color: token, paper share, own tint (only on neutral surfaces), ink. */
export function grundfarbe(r: Rezept, palette: Palette3D): THREE.Color {
	const paper = new THREE.Color(palette.paper);
	let c = srgbMix(tokenColor(palette, r.farbe.token), paper, r.farbe.papier);
	if (r.farbe.tint.toward && r.farbe.token === '--paper')
		c = srgbMix(c, tokenColor(palette, r.farbe.tint.toward), r.farbe.tint.amount ?? 0);
	if (r.farbe.tint.ink) c = srgbMix(c, new THREE.Color(palette.ink), r.farbe.tint.ink);
	return c;
}

/** Edge color: ink mixed toward paper. */
export function kantenfarbe(r: Rezept, palette: Palette3D): THREE.Color {
	return srgbMix(
		new THREE.Color(palette.ink),
		new THREE.Color(palette.paper),
		r.kante?.papier ?? 0
	);
}

/** Noise around 0 (roughly −1 … 1): the grain of the material. */
function rauschen(art: NonNullable<Rezept['rauschen']>['art'], m: number): Node<'float'> {
	const p = positionWorld;
	switch (art) {
		case 'poren': {
			// Cloudy gray and small, dark cell dots.
			const wolke = mx_fractal_noise_float(p.mul(m));
			const pore = float(1).sub(mx_worley_noise_float(p.mul(m * 2)).smoothstep(0.06, 0.14));
			return wolke.mul(0.8).sub(pore.mul(1.6));
		}
		case 'maser':
			// Growth rings: fine vertical stripes, gently warped by stretched noise.
			return sin(
				blatt()
					.x.mul(m * 6)
					.add(mx_noise_float(p.mul(vec3(m * 0.8, m * 0.12, m * 0.8))).mul(1.6))
			);
		case 'schliff':
			return mx_noise_float(p.mul(vec3(m, m * 40, m))).mul(1.4);
		case 'glasur':
			return mx_fractal_noise_float(p.mul(m));
		case 'schlieren':
			return mx_noise_float(p.mul(vec3(m, m * 4, m)));
		case 'faser':
			return mx_noise_float(vec3(blatt().mul(vec2(m * 8, m)), 0));
		case 'welle':
			return mx_noise_float(vec3(p.x.mul(m), p.z.mul(m), p.y.mul(m * 2).add(time.mul(0.4))));
	}
}

/** Fugen 0 … 1: wiederkehrende Linien in Metern Abstand. */
function fugen(art: NonNullable<Rezept['fugen']>['art'], a: number): Node<'float'> {
	const b = blatt(),
		h = positionWorld.y;
	switch (art) {
		case 'schalung':
			return strich(h.div(a), 0.02);
		case 'lamelle':
			return strich(b.x.div(a), 0.07);
		case 'paneel':
			return strich(b.x.div(a), 0.012);
		case 'fliese':
			return max(strich(b.x.div(a), 0.03), strich(h.div(a), 0.03));
		case 'sprosse':
			return max(strich(b.x.div(a), 0.035), strich(h.div(a), 0.035));
		case 'naht':
			return strich(h.div(a).add(sin(b.x).mul(0.15)), 0.025);
		case 'geschoss':
			return strich(h.div(a), 0.012);
		case 'fenster': {
			// Window grid: rectangle 40 % wide, 55 % high per panel, anti-aliased.
			const f = vec2(b.x, h).div(a).fract().sub(0.5).abs();
			const aa = vec2(b.x, h).div(a).fwidth().max(0.0005);
			const x = float(1).sub(f.x.smoothstep(float(0.2).sub(aa.x), float(0.2).add(aa.x)));
			const y = float(1).sub(f.y.smoothstep(float(0.275).sub(aa.y), float(0.275).add(aa.y)));
			return x.mul(y);
		}
		case 'strom':
			return strich(
				b.x
					.div(a)
					.add(time.mul(0.3))
					.add(mx_noise_float(positionWorld.mul(0.6)).mul(0.6)),
				0.04
			);
	}
}

/** Gloss direction in screen space: a highlight at top left, never on an axis-aligned surface. */
const HALF = new THREE.Vector3(-0.42, 0.62, 0.66).normalize();

/** A recipe as a node material. `doppelt` shows back faces (open forms). */
export function rezeptMaterial(r: Rezept, palette: Palette3D, doppelt = false) {
	const paper = color(new THREE.Color(palette.paper));
	const ink = color(new THREE.Color(palette.ink));
	const licht = color(new THREE.Color(0xffffff));

	// 1 Tone: surface tone by direction, scaled by the contrast of the skin.
	const ton = mix(float(1), faceTone(), r.ton.kontrast);
	// 2 Color.
	let c: Node<'vec3'> = color(grundfarbe(r, palette)).mul(ton);
	// 3 Noise.
	if (r.rauschen)
		c = c.mul(rauschen(r.rauschen.art, r.rauschen.massstab).mul(r.rauschen.staerke).add(1));
	// 4 Joints: water draws light lines, everything else dark ones.
	if (r.fugen)
		c = mix(
			c,
			r.fugen.art === 'strom' ? licht : ink,
			fugen(r.fugen.art, r.fugen.abstand).mul(r.fugen.staerke)
		);
	// 5 Edge: outline of round forms from the normal (the stage draws straight edges as lines).
	const facing = abs(normalView.z).clamp(0, 1);
	const fresnel = float(1).sub(facing);
	if (r.kante) {
		const breite = facing
			.fwidth()
			.max(0.0001)
			.mul(1.4 * r.kante.breite);
		const umriss = float(1).sub(facing.smoothstep(breite.mul(0.5), breite.mul(1.5)));
		c = mix(c, color(kantenfarbe(r, palette)), umriss);
	}
	// 6 Skin.
	const h = r.haut;
	if (h.glanz) {
		const punkt = dot(normalView, vec3(HALF.x, HALF.y, HALF.z)).smoothstep(
			1 - h.glanzbreite * 1.6,
			1 - h.glanzbreite * 0.6
		);
		const rand = fresnel.smoothstep(0.8, 0.86);
		c = mix(c, licht, punkt.mul(h.glanz).max(rand.mul(h.glanz * 0.45)));
	}
	if (h.sheen) c = mix(c, licht, fresnel.mul(fresnel).mul(h.sheen));
	if (h.truebung) {
		// Cloudier at the rim than in the center; the paper keeps the tone of the surface.
		const wolke = fresnel.mul(0.65).add(0.35).mul(h.truebung);
		c = mix(c, paper.mul(ton), wolke);
		c = select(frontFacing, c, mix(c, paper, 0.35));
	}
	const d = deckung(h);
	if (d.hinten > 0) {
		// Frosted: five taps from a blurred copy of what lies behind.
		const level = float(h.unschaerfe);
		const texel = vec2(2 ** h.unschaerfe, 2 ** h.unschaerfe).div(screenSize);
		const hinten = viewportMipTexture() as unknown as THREE.TextureNode;
		const tap = (dx: number, dy: number) =>
			hinten.sample(screenUV.add(texel.mul(vec2(dx, dy)))).level(level).rgb;
		const unscharf = tap(0, 0)
			.mul(0.4)
			.add(tap(0.75, 0.75).mul(0.15))
			.add(tap(-0.75, 0.75).mul(0.15))
			.add(tap(0.75, -0.75).mul(0.15))
			.add(tap(-0.75, -0.75).mul(0.15));
		c = mix(c, unscharf, d.hinten);
	}
	const transparent = d.opacity < 1;
	const material = new THREE.MeshBasicNodeMaterial({
		transparent,
		depthWrite: !transparent,
		side: doppelt || transparent ? THREE.DoubleSide : THREE.FrontSide,
		polygonOffset: true,
		polygonOffsetFactor: 1,
		polygonOffsetUnits: 1
	});
	material.colorNode = c;
	if (transparent) material.opacityNode = float(d.opacity);
	return material;
}
