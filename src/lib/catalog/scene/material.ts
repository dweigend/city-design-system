/**
 * Material system in the shader (TSL, WebGPU and WebGL2): tone steps instead of light.
 * Surface tone × finish, turbidity toward the paper color (Fresnel, soft back faces),
 * diffusion via the frame buffer (mip level = blur), analytic patterns.
 * Values come from logic/parametrik/material.ts.
 */
import * as THREE from 'three/webgpu';
import type { Node } from 'three/webgpu';
import { dot, float, fract, mix, positionLocal, vec3 } from 'three/tsl';
import type { Palette3D } from '../data/city3d';
import { blatt, hoehe, strich } from './schraffur';
import type { MaterialLook } from '../logic/parametrik/material';
import type { ColorToken } from '../logic/parametrik/types';

const srgbMix = (a: THREE.Color, b: THREE.Color, t: number) =>
	a.clone().convertLinearToSRGB().lerp(b.clone().convertLinearToSRGB(), t).convertSRGBToLinear();

/** Resolves a semantic colour against the scene palette. */
export function tokenColor(palette: Palette3D, token: ColorToken) {
	const css =
		token === '--paper'
			? palette.paper
			: token === '--ink'
				? palette.ink
				: token === '--blueprint'
					? palette.blueprint
					: palette.categories[token.replace('--cat-', '')];
	return new THREE.Color(css ?? palette.paper);
}

/** Base color: token, paper share, own tint (only on neutral surfaces), ink. */
export function lookColor(
	look: Pick<MaterialLook, 'token' | 'paper' | 'tint'>,
	palette: Palette3D
) {
	const paper = new THREE.Color(palette.paper);
	let c = srgbMix(tokenColor(palette, look.token), paper, look.paper);
	if (look.tint.toward && look.token === '--paper')
		c = srgbMix(c, tokenColor(palette, look.tint.toward), look.tint.amount ?? 0);
	if (look.tint.ink) c = srgbMix(c, new THREE.Color(palette.ink), look.tint.ink);
	return c;
}

/**
 * Material patterns in meters on the drawing sheet (schraffur.ts): horizontal joints follow
 * world height, vertical ones the image horizontal. No UV unwrapping, so no seams on curves.
 */
export function patternInk(
	pattern: MaterialLook['pattern']
): { ink: Node<'float'>; strength: number } | null {
	const p = blatt(),
		h = hoehe();
	switch (pattern) {
		case 'schalung':
			return { ink: strich(h.div(1.25), 0.02), strength: 0.14 };
		case 'lamelle':
			return { ink: strich(p.x.mul(3), 0.07), strength: 0.16 };
		case 'korn': {
			// Hash dots on a 8 cm lattice; fade to mean when the lattice is sub-pixel.
			const q = positionLocal.mul(12);
			const hash = fract(
				dot(q.floor(), vec3(12.9898, 78.233, 37.719))
					.sin()
					.mul(43758.5453)
			);
			const dots = hash.smoothstep(0.62, 0.66);
			const aa = q.fwidth().length();
			return { ink: mix(dots, float(0.35), aa.smoothstep(0.3, 0.9)), strength: 0.32 };
		}
		case 'sprosse':
			return { ink: strich(p.x, 0.035).max(strich(h, 0.035)), strength: 0.75 };
		case 'welle':
			return {
				ink: strich(p.x.mul(0.8).add(h.mul(1.6).sin().mul(0.18)), 0.04),
				strength: 0.35
			};
		case 'naht':
			return { ink: strich(h.div(1.5), 0.025), strength: 0.22 };
		default:
			return null;
	}
}

/** Edge colour of a material: ink mixed toward paper. */
export function edgeColor(paperShare: number, palette: Palette3D) {
	return srgbMix(new THREE.Color(palette.ink), new THREE.Color(palette.paper), paperShare);
}
