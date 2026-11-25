import { defaults } from '../../../config/stage';
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

const contourInterval = defaults.stageContourInterval;
const northWest = vec2(-Math.SQRT1_2, Math.SQRT1_2);

function pencil(height: Node<'float'>, interval: number, radius: number) {
	const dx = dFdx(height).abs();
	const dy = dFdy(height).abs();
	const slope = vec2(dx, dy).length().mul(screenDPR);
	const perPixel = slope.max(defaults.stageContourDerivativeFloor);
	const level = height.div(interval).round();
	const across = height.sub(level.mul(interval)).abs().div(perPixel);
	const pixel = screenCoordinate.div(screenDPR);
	const stagger = hash(level.add(defaults.stageContourStaggerKey));
	const dots = pixel
		.div(defaults.stageContourDotSpacingPx)
		.add(stagger)
		.fract()
		.sub(/* Exact arithmetic: center the normalized phase around zero. */ 0.5)
		.mul(defaults.stageContourDotSpacingPx);
	const fromX = vec2(across, dots.x)
		.length()
		.smoothstep(
			radius - defaults.stageContourDotFeatherPx,
			radius + defaults.stageContourDotFeatherPx
		)
		.oneMinus();
	const fromY = vec2(across, dots.y)
		.length()
		.smoothstep(
			radius - defaults.stageContourDotFeatherPx,
			radius + defaults.stageContourDotFeatherPx
		)
		.oneMinus();
	const tangent = dx
		.div(dx.add(dy).max(defaults.stageContourDerivativeFloor))
		.smoothstep(...defaults.stageContourTangentBlend);
	const linked = mix(fromX, fromY, tangent);
	const spacing = perPixel.reciprocal().mul(interval);
	return linked
		.mul(spacing.smoothstep(...defaults.stageContourSpacingFadePx))
		.mul(slope.smoothstep(...defaults.stageContourSlopeFade));
}

export function terrainColor(
	palette: ReturnType<typeof drawingPalette>,
	heightScale: Node<'float'>,
	field?: Node<'vec4'>
) {
	const height = field?.x ?? positionWorld.z.div(heightScale);
	const gradient = field ? field.yz.mul(heightScale) : normalWorldGeometry.xy.negate();
	const slope = gradient.length();
	const facing = gradient.negate().dot(northWest).div(slope.max(defaults.stageTerrainNormalFloor));
	const steepness = slope.smoothstep(...defaults.stageTerrainShadeSlope);
	const shading = steepness.mul(
		facing.mul(defaults.stageTerrainFacingLight).sub(defaults.stageTerrainDarken)
	);
	const bank = field
		? field.w
				.max(/* Exact arithmetic: clamp signed bank distances to the exterior. */ 0)
				.smoothstep(...defaults.stageBankShadeFadeM)
				.oneMinus()
				.mul(defaults.stageBankShadeStrength)
		: float(/* Exact arithmetic: absent terrain field contributes no bank shade. */ 0);
	const offset = shading
		.sub(bank)
		.max(-defaults.stageTerrainDarken)
		.add(
			palette.dark.mul(
				steepness.mul(defaults.stageDarkSteepnessLift).add(defaults.stageDarkTerrainLift)
			)
		)
		.mul(palette.hull.oneMinus());
	const paper = graphite(materialColor, offset, float(grain.shadow));
	const minor = pencil(height, contourInterval, defaults.stageMinorContourRadiusPx).mul(
		palette.dark.mul(defaults.stageDarkMinorContourInkLift).add(defaults.stageMinorContourInk)
	);
	const index = pencil(
		height,
		contourInterval * defaults.stageIndexContourStride,
		defaults.stageIndexContourRadiusPx
	).mul(
		palette.dark.mul(defaults.stageDarkIndexContourInkShift).add(defaults.stageIndexContourInk)
	);
	return mix(paper, palette.ink, minor.max(index).mul(palette.hull.oneMinus()));
}
