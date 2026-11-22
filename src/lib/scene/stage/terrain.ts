import {
	dFdx,
	dFdy,
	hash,
	materialColor,
	mix,
	normalWorldGeometry,
	positionWorld,
	screenCoordinate,
	screenDPR,
	vec2
} from 'three/tsl';
import { graphite, sun, type drawingPalette } from './tone';

export function terrainColor(palette: ReturnType<typeof drawingPalette>) {
	const height = positionWorld.z;
	const interval = 1;
	const level = height.div(interval).round();
	const dx = dFdx(height).abs();
	const dy = dFdy(height).abs();
	const slopePerPixel = vec2(dx, dy).length().mul(screenDPR).max(0.0001);
	const across = height.sub(level.mul(interval)).abs().div(slopePerPixel);
	const pixel = screenCoordinate.div(screenDPR);
	const along = dx.greaterThan(dy).select(pixel.y, pixel.x);
	const dots = along
		.div(3.2)
		.add(hash(level.add(127)))
		.fract()
		.sub(0.5)
		.mul(3.2);
	const distance = vec2(across, dots).length();
	const major = level.mod(5).equal(0);
	const radius = major.select(0.76, 0.58);
	const spacing = major.select(5, 1).div(slopePerPixel);
	const pressure = major.select(0.61, 0.33).mul(spacing.smoothstep(1.35, 2.7));
	const contour = distance.smoothstep(radius.sub(0.3), radius.add(0.3)).oneMinus().mul(pressure);
	const wash = height.smoothstep(2, 18).mul(-0.043).mul(palette.dark.mul(-1.75).add(1));
	const light = normalWorldGeometry.xy
		.dot(vec2(...sun))
		.mul(0.17)
		.add(wash);
	const floor = height.smoothstep(2, 5).oneMinus().mul(palette.hull.oneMinus());
	const tone = mix(materialColor, palette.floodplain, floor);
	const paper = graphite(tone, light, palette.dark.mul(-0.007).add(0.016));
	return mix(paper, palette.ink, contour.mul(palette.hull.oneMinus()));
}
