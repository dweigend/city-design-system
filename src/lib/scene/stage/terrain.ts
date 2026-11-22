import {
	dFdx,
	dFdy,
	float,
	hash,
	materialColor,
	mix,
	normalWorldGeometry,
	positionWorld,
	screenCoordinate,
	screenDPR,
	vec2
} from 'three/tsl';
import type { Node } from 'three/webgpu';
import { graphite, grain, levels, sun, type drawingPalette } from './tone';

const contourInterval = 2;
const indexInterval = 5 * contourInterval;

function contours(height: Node<'float'>) {
	const dx = dFdx(height).abs();
	const dy = dFdy(height).abs();
	const slope = vec2(dx, dy).length().mul(screenDPR);
	const heightPerPixel = slope.max(0.0001);
	const pixel = screenCoordinate.div(screenDPR);
	const along = dx.greaterThan(dy).select(pixel.y, pixel.x);

	const level = height.div(contourInterval).round();
	const across = height.sub(level.mul(contourInterval)).abs().div(heightPerPixel);
	const dots = along
		.div(3.4)
		.add(hash(level.add(127)))
		.fract()
		.sub(0.5)
		.mul(3.4);
	const distance = vec2(across, dots).length();
	const minor = distance
		.smoothstep(0.37, 0.85)
		.oneMinus()
		.mul(heightPerPixel.reciprocal().mul(contourInterval).smoothstep(1.8, 3.4))
		.mul(level.mod(5).notEqual(0).select(0.51, 0));

	const major = height.div(indexInterval).round().mul(indexInterval);
	const indexDistance = height.sub(major).abs().div(heightPerPixel);
	const indexDots = along.div(2.2).fract().sub(0.5).mul(2.2);
	const index = vec2(indexDistance, indexDots).length().smoothstep(0.58, 0.98).oneMinus().mul(0.51);
	return minor.max(index).mul(slope.smoothstep(0.003, 0.017));
}

export function terrainColor(
	palette: ReturnType<typeof drawingPalette>,
	heightScale: Node<'float'>
) {
	const height = positionWorld.z.div(heightScale);
	const normal = normalWorldGeometry.xy;
	const illumination = normal.dot(vec2(...sun)).mul(0.078);
	const slopeShade = normal.length().smoothstep(0.04, 0.65).mul(0.073);
	const slopeTone = illumination.sub(slopeShade).clamp(levels.shadow, levels.top);
	const floorTone = height.smoothstep(1.5, 15).mul(0.04).sub(0.027);
	const offset = slopeTone.add(floorTone).add(palette.dark.mul(0.085)).mul(palette.hull.oneMinus());
	const paper = graphite(materialColor, offset, float(grain.shadow));
	return mix(paper, palette.ink, contours(height).mul(palette.hull.oneMinus()));
}
