/**
 * Material system in the shader (TSL, WebGPU and WebGL2): tone steps instead of light.
 * Surface tone × finish, turbidity toward the paper color (Fresnel, soft back faces),
 * diffusion via the frame buffer (mip level = blur), analytic patterns.
 * Values come from logic/parametrik/material.ts.
 */
import * as THREE from 'three/webgpu';
import type { Node } from 'three/webgpu';
import {
	abs,
	color,
	dot,
	float,
	fract,
	frontFacing,
	mix,
	normalView,
	normalWorld,
	positionLocal,
	screenUV,
	screenSize,
	select,
	vec2,
	vec3,
	viewportMipTexture
} from 'three/tsl';
import type { Palette3D } from '../data/city3d';
import { blatt, hoehe, strich } from './schraffur';
import type { MaterialLook } from '../logic/parametrik/material';
import type { ColorToken } from '../logic/parametrik/types';

const srgbMix = (a: THREE.Color, b: THREE.Color, t: number) =>
	a.clone().convertLinearToSRGB().lerp(b.clone().convertLinearToSRGB(), t).convertSRGBToLinear();

export function tokenColor(palette: Palette3D, token: ColorToken) {
	const css =
		token === '--paper'
			? palette.paper
			: token === '--blueprint'
				? palette.blueprint
				: palette.categories[token.replace('--cat-', '')];
	return new THREE.Color(css ?? palette.paper);
}

/** Base color: token, paper share, own tint (only on neutral surfaces), ink. */
export function lookColor(look: MaterialLook, palette: Palette3D) {
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
function patternInk(look: MaterialLook): { ink: Node<'float'>; strength: number } | null {
	const p = blatt(),
		h = hoehe();
	switch (look.pattern) {
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

/** Fixed half vector in view space: highlight at top left, never on axis-aligned box faces. */
const HALF = new THREE.Vector3(-0.42, 0.62, 0.66).normalize();

export function finishMaterial(look: MaterialLook, palette: Palette3D, double: boolean) {
	const base = lookColor(look, palette);
	const paper = color(new THREE.Color(palette.paper));
	const ink = color(new THREE.Color(palette.ink));
	const light = color(srgbMix(new THREE.Color(palette.paper), new THREE.Color(0xffffff), 1));
	// Face tone by normal (same weights as surfaces.ts), scaled by finish contrast.
	const n = normalWorld;
	const faceTone = dot(
		n.mul(n),
		mix(vec3(0.89, 0.61, 0.72), vec3(0.89, 1, 0.72), float(n.y.greaterThan(0)))
	);
	const tone = mix(float(1), faceTone, look.contrast);
	let c: Node<'vec3'> = color(base).mul(tone);
	const pattern = patternInk(look);
	if (pattern) c = mix(c, ink, pattern.ink.mul(pattern.strength));
	// Orthographic camera: view direction is +z in view space.
	const facing = abs(normalView.z).clamp(0, 1);
	const fresnel = float(1).sub(facing);
	if (look.sheen) c = mix(c, light, fresnel.mul(fresnel).mul(look.sheen));
	if (look.gloss) {
		const spot = dot(normalView, vec3(HALF.x, HALF.y, HALF.z)).smoothstep(0.972, 0.982);
		const rim = fresnel.smoothstep(0.8, 0.86);
		c = mix(c, light, spot.mul(look.gloss).max(rim.mul(look.gloss * 0.45)));
	}
	if (look.milk) {
		// Edges cloud more than the centre; back faces are softer still.
		const cloud = fresnel.mul(0.45).add(0.55).mul(look.milk);
		c = mix(c, paper, cloud);
		c = select(frontFacing, c, mix(c, paper, 0.35));
	}
	if (look.backdrop > 0) {
		// Frosted: five taps on a blurred copy of what is behind (lines become light and soft).
		const level = float(look.blur);
		const texel = vec2(2 ** look.blur, 2 ** look.blur).div(screenSize);
		const behind = viewportMipTexture() as unknown as THREE.TextureNode;
		const tap = (dx: number, dy: number) =>
			behind.sample(screenUV.add(texel.mul(vec2(dx, dy)))).level(level).rgb;
		const blurred = tap(0, 0)
			.mul(0.4)
			.add(tap(0.75, 0.75).mul(0.15))
			.add(tap(-0.75, 0.75).mul(0.15))
			.add(tap(0.75, -0.75).mul(0.15))
			.add(tap(-0.75, -0.75).mul(0.15));
		c = mix(c, blurred, look.backdrop);
	}
	const material = new THREE.MeshBasicNodeMaterial({
		transparent: look.transparent,
		depthWrite: !look.transparent,
		side: double || look.transparent ? THREE.DoubleSide : THREE.FrontSide,
		polygonOffset: true,
		polygonOffsetFactor: 1,
		polygonOffsetUnits: 1
	});
	material.colorNode = c;
	if (look.transparent) material.opacityNode = float(look.opacity);
	return material;
}

/** Edge colour of a material: ink mixed toward paper. */
export function edgeColor(look: MaterialLook, palette: Palette3D) {
	return srgbMix(
		new THREE.Color(palette.ink),
		new THREE.Color(palette.paper),
		look.edge?.paper ?? 0
	);
}
