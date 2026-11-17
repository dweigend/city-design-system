/**
 * Drawing plane for all surface patterns (hatching, Memphis, texture, material patterns).
 *
 * Principle: a pattern does not sit on the surface (UV) but on the drawing sheet.
 * The coordinates are the world position, rotated into the camera plane (rotation only, no
 * translation), in meters. Consequences:
 * - no seams: there is no unwrapping, so no edge where the pattern could tear;
 * - the same line spacing on cube, cylinder, cone, sphere, and tube;
 * - panning and zooming keep the lines on the component; only rotating the camera
 *   lets them glide over curved surfaces, as in drawing by hand.
 * Height patterns (formwork, seam) use world height: horizontal bands around every form.
 * Tone (surface brightness by normal) controls stroke width, not spacing:
 * curves get a continuous gradient instead of an edge (the copperplate-engraving principle).
 */
import type { Node } from 'three/webgpu';
import {
	abs,
	cameraViewMatrix,
	dot,
	float,
	fract,
	mix,
	normalView,
	normalWorld,
	positionWorld,
	vec2,
	vec3,
	vec4
} from 'three/tsl';

/** Hatch line spacing in meters on the drawing sheet. */
export const SCHRAFFUR_ABSTAND_M = 0.55;

/** World position in the camera plane (meters): x to the right, y up in the image. */
export function blatt(): Node<'vec2'> {
	return cameraViewMatrix.mul(vec4(positionWorld, 0)).xy;
}

/** World height in meters (three: y is up). */
export function hoehe(): Node<'float'> {
	return positionWorld.y;
}

/** Line field along angle `grad` (0 = horizontal in the image, 45 = rising), spacing in meters. */
export function linien(grad: number, abstand = SCHRAFFUR_ABSTAND_M): Node<'float'> {
	const a = (grad * Math.PI) / 180;
	// Line normal: perpendicular to the line direction.
	return dot(blatt(), vec2(-Math.sin(a), Math.cos(a))).div(abstand);
}

/**
 * Anti-aliased line: 1 on the line, 0 beside it. `breite` = half the stroke width as a share
 * of the spacing (number or node). When the spacing drops below one pixel, the field fades
 * to its mean: no moiré bands in the distance.
 */
export function strich(v: Node<'float'>, breite: number | Node<'float'>): Node<'float'> {
	const w = typeof breite === 'number' ? float(breite) : breite;
	const distance = abs(fract(v).sub(0.5));
	const aa = v.fwidth().max(0.001);
	return mix(
		float(1).sub(distance.smoothstep(w.sub(aa), w.add(aa))),
		w.mul(2),
		aa.smoothstep(0.25, 0.8)
	);
}

/**
 * Surface darkness 0 (roof, light) … 1 (underside), continuous over the normal.
 * Same weights as the surface tone (surfaces.ts): top 1, x 0.89, z 0.72, bottom 0.61.
 */
export function dunkelheit(): Node<'float'> {
	const n = normalWorld;
	const tone = dot(
		n.mul(n),
		mix(vec3(0.89, 0.61, 0.72), vec3(0.89, 1, 0.72), float(n.y.greaterThan(0)))
	);
	return float(1).sub(tone).div(0.39).clamp(0, 1);
}

/**
 * Contour 0 (surface faces the camera) … 1 (grazing at the outline). Lets strokes swell toward
 * the rim of a curve: neighbors with the same hatching stay legible as volumes.
 */
export function kontur(): Node<'float'> {
	const facing = abs(normalView.z).clamp(0, 1);
	return float(1).sub(facing).pow(2);
}

/**
 * Hatching by material: concrete one layer at 45°, metal crossed, wood vertical and fine.
 * Any other material name hatches like concrete.
 * Stroke width grows with darkness and contour: roofs delicate, shaded sides and rims bold.
 */
export function schraffur(material: string): Node<'float'> {
	const ton = dunkelheit().mul(0.55).add(kontur().mul(0.9)).clamp(0, 1);
	const breite = (hell: number, dunkel: number) => mix(float(hell), float(dunkel), ton);
	if (material === 'wood') return strich(linien(90, SCHRAFFUR_ABSTAND_M * 0.6), breite(0.05, 0.14));
	const erste = strich(linien(45), breite(0.05, 0.24));
	if (material === 'metal') return erste.max(strich(linien(-45), breite(0.04, 0.14)));
	return erste;
}
