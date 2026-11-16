import type { Node } from 'three/webgpu';
import { Color } from 'three/webgpu';
import {
	color,
	dot,
	float,
	mix,
	normalWorld,
	normalView,
	positionLocal,
	positionView,
	cameraProjectionMatrix,
	screenSize,
	screenDPR,
	vec2,
	vec4
} from 'three/tsl';
import { blatt, hoehe, linien, schraffur, strich } from './schraffur';
import type { MaterialId } from '../logic/parametrik/types';
import type { SceneStyle } from '../logic/parametrik/style';

/** Surface tone per world axis (plan drawing, unlit): top 1, x 0.89, z 0.72, bottom 0.61. */
export function faceTone(): Node<'float'> {
	const n = normalWorld;
	return dot(
		n.mul(n),
		mix(vec4(0.89, 0.61, 0.72, 1).xyz, vec4(0.89, 1, 0.72, 1).xyz, float(n.y.greaterThan(0)))
	);
}

/**
 * Analytic, derivative-filtered patterns on the drawing sheet (schraffur.ts):
 * no bitmaps, no UV unwrapping, so no seams on round forms.
 */
export function surfaceColor(
	base: Color,
	material: MaterialId,
	mode: SceneStyle['material'],
	pattern: string | undefined,
	inkColor: Color
) {
	// Sheet coordinates in meters (Memphis grid and textures).
	const p = blatt();
	let ink: Node<'float'> = float(0);
	if (pattern?.includes('schachbrett')) {
		const checker = p.x.mul(Math.PI).sin().mul(p.y.mul(Math.PI).sin());
		ink = mix(
			checker.smoothstep(p.fwidth().length().negate(), p.fwidth().length()),
			float(0.5),
			p.fwidth().length().smoothstep(0.4, 1)
		);
	} else if (pattern?.includes('punkte')) {
		const radius = p.fract().sub(0.5).length();
		ink = float(1).sub(
			radius.smoothstep(float(0.18).sub(p.fwidth().length()), float(0.18).add(p.fwidth().length()))
		);
	} else if (pattern) {
		// Diagonal: sheet lines at 45°. Otherwise horizontal bands at world height, around every form.
		ink = strich(pattern.includes('diagonal') ? linien(45, 0.71) : hoehe(), 0.22);
	} else if (mode === 'hatch') {
		ink = schraffur(material);
	} else if (mode === 'texture') {
		if (material === 'wood') {
			ink = strich(p.x.mul(2).add(hoehe().mul(0.7).sin().mul(0.12)), 0.06)
				.mul(0.3)
				.add(strich(p.x.mul(0.5), 0.025).mul(0.4));
		} else if (material === 'metal') {
			ink = float(1)
				.sub(p.fract().sub(vec2(0.5)).length().smoothstep(0.14, 0.18))
				.mul(0.6);
		} else {
			const grain = positionLocal.mul(17.3).sin();
			ink = grain.x.mul(grain.y).mul(grain.z).mul(0.1).add(0.12);
		}
	}
	const tone = faceTone();
	const accent = pattern?.includes('rot')
		? color('#cc493a')
		: pattern?.includes('blau')
			? color('#426ab3')
			: color(inkColor);
	return mix(
		color(base),
		pattern ? accent : color(inkColor),
		ink.mul(mode === 'texture' && !pattern ? 0.65 : 0.8)
	).mul(tone);
}

/** Screen-space inverted hull, portable to WGSL and GLSL through TSL. */
export function outlinePosition(thickness: number) {
	const clip = cameraProjectionMatrix.mul(vec4(positionView, 1));
	const direction = cameraProjectionMatrix.mul(vec4(normalView, 0)).xy.add(0.000001).normalize();
	return vec4(
		clip.xy.add(direction.mul(thickness).mul(screenDPR).mul(2).div(screenSize).mul(clip.w)),
		clip.zw
	);
}
