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
import { graphite, grain, type drawingPalette } from './tone';

const contourInterval = 2;
const northWest = vec2(-Math.SQRT1_2, Math.SQRT1_2);

function pencil(height: Node<'float'>, interval: number, radius: number) {
	const dx = dFdx(height).abs();
	const dy = dFdy(height).abs();
	const slope = vec2(dx, dy).length().mul(screenDPR);
	const perPixel = slope.max(0.0001);
	const level = height.div(interval).round();
	const across = height.sub(level.mul(interval)).abs().div(perPixel);
	const pixel = screenCoordinate.div(screenDPR);
	const stagger = hash(level.add(257));
	const dots = pixel.div(3.3).add(stagger).fract().sub(0.5).mul(3.3);
	const fromX = vec2(across, dots.x)
		.length()
		.smoothstep(radius - 0.28, radius + 0.28)
		.oneMinus();
	const fromY = vec2(across, dots.y)
		.length()
		.smoothstep(radius - 0.28, radius + 0.28)
		.oneMinus();
	const tangent = dx.div(dx.add(dy).max(0.0001)).smoothstep(0.37, 0.63);
	const linked = mix(fromX, fromY, tangent);
	const spacing = perPixel.reciprocal().mul(interval);
	return linked.mul(spacing.smoothstep(1.25, 2.65)).mul(slope.smoothstep(0.00035, 0.003));
}

export function terrainColor(
	palette: ReturnType<typeof drawingPalette>,
	heightScale: Node<'float'>,
	field?: Node<'vec4'>
) {
	const height = field?.x ?? positionWorld.z.div(heightScale);
	const gradient = field ? field.yz.mul(heightScale) : normalWorldGeometry.xy.negate();
	const slope = gradient.length();
	const facing = gradient.negate().dot(northWest).div(slope.max(0.0001));
	const steepness = slope.smoothstep(0.018, 2.45);
	const shading = steepness.mul(facing.mul(0.032).sub(0.262));
	const bank = field ? field.w.max(0).smoothstep(6, 102).oneMinus().mul(0.085) : float(0);
	const offset = shading
		.sub(bank)
		.max(-0.262)
		.add(palette.dark.mul(steepness.mul(0.41).add(0.079)))
		.mul(palette.hull.oneMinus());
	const paper = graphite(materialColor, offset, float(grain.shadow));
	const minor = pencil(height, contourInterval, 0.66).mul(palette.dark.mul(0.1).add(0.25));
	const index = pencil(height, contourInterval * 5, 0.79).mul(palette.dark.mul(-0.15).add(0.5));
	return mix(paper, palette.ink, minor.max(index).mul(palette.hull.oneMinus()));
}
