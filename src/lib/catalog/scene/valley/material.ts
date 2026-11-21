import { Color, MeshBasicNodeMaterial, type Node } from 'three/webgpu';
import {
	attribute,
	float,
	mix,
	normalWorldGeometry,
	positionLocal,
	uniform,
	vec3
} from 'three/tsl';
import type { Palette3D } from '../../data/city3d';
import { sceneSwatch } from '../scene-palette';

function contour(meters: Node<'float'>, interval: number, widthPx: number) {
	const phase = meters.div(interval);
	const pixel = phase.fwidth().max(0.0001);
	const distance = phase.add(0.5).fract().sub(0.5).abs().div(pixel);
	const resolved = pixel.smoothstep(0.22, 0.52).oneMinus();
	return distance.smoothstep(0, widthPx).oneMinus().mul(resolved);
}

/** Styles the valley with semantic scene tokens and 1 m / 5 m contour intervals. */
export function valleyMaterial(exaggeration: number) {
	const floodplain = uniform(new Color());
	const lowTerrace = uniform(new Color());
	const highTerrace = uniform(new Color());
	const contourInk = uniform(new Color());
	const river = uniform(new Color());

	const bedAboveWater = attribute<'float'>('signedDepth', 'float');
	const heightM = positionLocal.y.div(exaggeration);
	const lower = mix(floodplain.rgb, lowTerrace.rgb, bedAboveWater.smoothstep(2, 7));
	const land = mix(lower, highTerrace.rgb, bedAboveWater.smoothstep(9, 14));
	const key = normalWorldGeometry.dot(vec3(-0.64, 0.71, -0.28));
	const shade = float(0.71).sub(key).clamp(-0.2, 0.7);
	const relief = land.mul(float(1).sub(shade.mul(0.22)));
	const minor = contour(heightM, 1, 0.75).mul(0.38);
	const major = contour(heightM, 5, 1).mul(0.64);
	const printed = mix(relief, contourInk.rgb, minor.max(major));
	const material = new MeshBasicNodeMaterial({ toneMapped: false });
	material.colorNode = bedAboveWater.lessThan(0).select(river.rgb, printed);

	return {
		material,
		setPalette(this: void, palette: Palette3D) {
			const paper = new Color(palette.paper);
			const ground = new Color(sceneSwatch(palette, '--ground-sage'));
			floodplain.value.copy(paper).lerp(ground, 0.33);
			lowTerrace.value.copy(paper).lerp(new Color(sceneSwatch(palette, '--ground-stone')), 0.38);
			highTerrace.value.copy(paper).lerp(new Color(sceneSwatch(palette, '--ground-sand')), 0.45);
			contourInk.value.set(palette.ink3 ?? palette.ink);
			river.value.set(sceneSwatch(palette, '--cat-health'));
		}
	};
}
