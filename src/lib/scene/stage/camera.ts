import { defaults } from '../../../config/stage';
import {
	crossProduct,
	dotProduct,
	displacement,
	interpolation,
	scaled,
	sum,
	unitVector,
	type Bounds3,
	type Vec2,
	type Vec3
} from '../../core/geometry';
import { shadowReach, sun } from './tone';
import type { TerrainAnchor } from './content';

// Quarry BLICK, converted from its Y-up projection to world coordinates.
const bearingRad = defaults.stageBearingRad;
const elevationRad = defaults.stageElevationRad;

export const views = {
	iso: {
		eye: [
			Math.sin(bearingRad) * Math.cos(elevationRad),
			-Math.cos(bearingRad) * Math.cos(elevationRad),
			Math.sin(elevationRad)
		],
		up: /* Exact arithmetic: the world up axis is positive Z. */ [0, 0, 1],
		fill: defaults.stageObliqueFill,
		shadowFit: false
	},
	plan: {
		eye: /* Exact arithmetic: a plan looks down the Z axis. */ [0, 0, 1],
		up: /* Exact arithmetic: a plan has positive Y at the top. */ [0, 1, 0],
		fill: defaults.stagePlanFill,
		shadowFit: true
	}
} satisfies Record<string, { eye: Vec3; up: Vec3; fill: number; shadowFit: boolean }>;

export type View = keyof typeof views;

export function readView(view: View) {
	if (!Object.hasOwn(views, view)) throw new RangeError(`Unknown stage view "${view}"`);
	return views[view];
}

/** Optional orthographic fit with angles in radians, a fill fraction, and a positive zoom
 * multiplier about the fitted center (default 1). Focus frames a subset of the scene in meters. */
export type ViewFit = Readonly<{
	bearing?: number;
	elevation?: number;
	/** Optional elevation in radians at the current horizontal frame width in meters. */
	elevationAtWidth?: (width: number) => number;
	fill?: number;
	zoom?: number;
	width?: number;
	offset?: Vec2;
	focus?: Bounds3;
	subject?: ProjectedFocus;
}>;

type ProjectedFocus = Readonly<{
	center: Vec3;
	halfWidth: number;
	halfHeight: number;
}>;

function axes(view: View, fit: ViewFit) {
	const { eye, up } = readView(view);
	const elevation = fit.elevation ?? elevationRad;
	const bearing = fit.bearing ?? bearingRad;
	const direction: Vec3 =
		view === 'iso'
			? [
					Math.sin(bearing) * Math.cos(elevation),
					-Math.cos(bearing) * Math.cos(elevation),
					Math.sin(elevation)
				]
			: eye;
	const right = unitVector(crossProduct(up, direction));
	const imageUp = crossProduct(direction, right);
	return { direction, right, imageUp, up };
}

/** Measures a subject in the image plane once for the supplied view and camera angles. */
export function projectFocus(
	view: View,
	fit: ViewFit,
	points: Iterable<Vec3>
): ProjectedFocus | undefined {
	const { direction, right, imageUp } = axes(view, fit);
	let x0 = Infinity,
		x1 = -Infinity,
		y0 = Infinity,
		y1 = -Infinity,
		z0 = Infinity,
		z1 = -Infinity;
	for (const point of points) {
		const x = dotProduct(point, right);
		const y = dotProduct(point, imageUp);
		const z = dotProduct(point, direction);
		x0 = Math.min(x, x0);
		x1 = Math.max(x, x1);
		y0 = Math.min(y, y0);
		y1 = Math.max(y, y1);
		z0 = Math.min(z, z0);
		z1 = Math.max(z, z1);
	}
	if (x0 === Infinity) return undefined;
	return {
		center: sum(
			sum(scaled(right, (x0 + x1) / 2), scaled(imageUp, (y0 + y1) / 2)),
			scaled(direction, (z0 + z1) / 2)
		),
		halfWidth: (x1 - x0) / 2,
		halfHeight: (y1 - y0) / 2
	};
}

export function fitCamera(
	view: View,
	bounds: Bounds3,
	aspect: number,
	landscape = false,
	fit: ViewFit = {},
	clippingBounds = bounds
) {
	const { fill, shadowFit } = readView(view);
	const baseAxes = axes(view, fit);
	const { right, imageUp } = baseAxes;

	const frame = fit.focus ?? bounds;
	const half = scaled(
		displacement(frame.min, frame.max),
		/* Exact arithmetic: take the midpoint or half extent. */ 0.5
	);
	const extent = (axis: Vec3) =>
		dotProduct(half, [Math.abs(axis[0]), Math.abs(axis[1]), Math.abs(axis[2])]);
	const shift = scaled(
		/* Exact arithmetic: cast shadow lies in the XY plane. */ [-sun[0], -sun[1], 0],
		!fit.focus && !fit.subject && (shadowFit || landscape) ? half[2] * shadowReach : 0
	);
	const subjectHeight = fit.subject?.halfHeight ?? extent(imageUp);
	const subjectWidth = fit.subject?.halfWidth ?? extent(right);
	const objectFit =
		Math.max(subjectHeight, subjectWidth / aspect, defaults.stageMinimumFitHeightM) /
		(fit.fill ?? fill);
	const shadowFitHeight =
		Math.max(
			subjectHeight + Math.abs(dotProduct(shift, imageUp)),
			(subjectWidth + Math.abs(dotProduct(shift, right))) / aspect
		) / (landscape ? (fit.fill ?? defaults.stageShadowFitFill) : defaults.stageShadowFitFill);
	const halfHeight =
		(fit.width === undefined ? Math.max(objectFit, shadowFitHeight) : fit.width / (2 * aspect)) /
		(fit.zoom ?? 1);
	const {
		direction,
		right: panRight,
		imageUp: panUp,
		up
	} = fit.elevationAtWidth && view === 'iso'
		? axes(view, { ...fit, elevation: fit.elevationAtWidth(halfHeight * 2 * aspect) })
		: baseAxes;
	const offset = fit.offset ?? /* Exact arithmetic: zero pan offset. */ [0, 0];
	const pan = sum(scaled(panRight, offset[0]), scaled(panUp, offset[1]));
	const center = sum(
		sum(
			fit.subject?.center ??
				interpolation(
					frame.min,
					frame.max,
					/* Exact arithmetic: take the midpoint or half extent. */ 0.5
				),
			shift
		),
		pan
	);
	const sceneHalf = scaled(
		displacement(clippingBounds.min, clippingBounds.max),
		/* Exact arithmetic: take the midpoint or half extent. */ 0.5
	);
	const depth = dotProduct(sceneHalf, [
		Math.abs(direction[0]),
		Math.abs(direction[1]),
		Math.abs(direction[2])
	]);
	const sceneCenter = interpolation(
		clippingBounds.min,
		clippingBounds.max,
		/* Exact arithmetic: take the midpoint or half extent. */ 0.5
	);
	const depthShift = dotProduct(displacement(center, sceneCenter), direction);
	const depthMarginM = Math.max(
		defaults.stageMinimumDepthMarginM,
		half[2] * defaults.stageSubjectHeightDepthMarginRatio,
		depth * defaults.stageSceneDepthMarginRatio
	);
	return {
		center,
		eye: sum(center, scaled(direction, depth + depthShift + depthMarginM)),
		up,
		halfWidth: halfHeight * aspect,
		halfHeight,
		near: depthMarginM / 2,
		far: 2 * depth + 2 * depthMarginM
	};
}

/** A fitted camera as navigation reads it: image axes, view direction and scale. */
export type CameraFrame = Readonly<{
	center: Vec3;
	eye: Vec3;
	right: Vec3;
	imageUp: Vec3;
	direction: Vec3;
	metersPerPixel: number;
	/** The first displayed ground point on the ray through an image point, looking into the scene.
	 * `direction` above points from the scene toward the eye. */
	hit?: (point: Vec3, direction: Vec3) => Vec3 | undefined;
	/** Resolves the hit in source coordinates for a viewport with a different presentation. */
	locateGround?: (point: Vec3, direction: Vec3) => TerrainAnchor | undefined;
	displayGround?: (anchor: TerrainAnchor) => Vec3;
}>;

/** A world-space ray from the orthographic camera, pointing into the scene at unit length. */
export type CameraRay = Readonly<{ origin: Vec3; direction: Vec3 }>;

/** Reads the image axes of a fitted camera for a canvas of `widthPx` CSS pixels. */
export function cameraFrame(camera: ReturnType<typeof fitCamera>, widthPx: number): CameraFrame {
	const direction = unitVector(displacement(camera.center, camera.eye));
	const right = unitVector(crossProduct(camera.up, direction));
	return {
		center: camera.center,
		eye: camera.eye,
		right,
		imageUp: crossProduct(direction, right),
		direction,
		metersPerPixel: (2 * camera.halfWidth) / widthPx
	};
}

function imageOffset({ right, imageUp, metersPerPixel }: CameraFrame, [x, y]: Vec2) {
	return sum(scaled(right, x * metersPerPixel), scaled(imageUp, -y * metersPerPixel));
}

/** Reads the ray at a CSS pixel offset from the image center, once a frame has been displayed. */
export function readRay(frame: CameraFrame | undefined, offset: Vec2): CameraRay | undefined {
	if (!frame) return undefined;
	return {
		origin: sum(frame.eye, imageOffset(frame, offset)),
		direction: scaled(frame.direction, /* Exact arithmetic: reverse the view direction. */ -1)
	};
}

/** Reads the displayed terrain at a pixel offset from the image center. */
export function pickGround(frame: CameraFrame | undefined, offset: Vec2): Vec3 | undefined {
	const ray = readRay(frame, offset);
	return ray && frame?.hit?.(ray.origin, ray.direction);
}

/** Reads the displayed ground, with a plane through the frame center as fallback. */
export function groundAt(frame: CameraFrame, offset: Vec2, next?: CameraFrame): Vec3 {
	const { center, direction } = frame;
	const onImage = sum(center, imageOffset(frame, offset));
	const ray = scaled(direction, /* Exact arithmetic: reverse the view direction. */ -1);
	if (next?.displayGround && frame.locateGround) {
		const anchor = frame.locateGround(onImage, ray);
		if (anchor) return next.displayGround(anchor);
	} else {
		const hit = frame.hit?.(onImage, ray);
		if (hit) return hit;
	}
	if (Math.abs(direction[2]) < defaults.stageGroundRayTolerance) return onImage;
	return sum(onImage, scaled(direction, (center[2] - onImage[2]) / direction[2]));
}

/** The pan change in image meters that puts a world anchor at a pixel offset from the image
 * centre of the next frame. Both frames share the pan of the current offset; the result adds to it,
 * so a zoom that also tilts the camera keeps the anchor under the cursor. */
export function anchoredPan(next: CameraFrame, anchor: Vec3, [x, y]: Vec2): Vec2 {
	const relative = displacement(next.center, anchor);
	return [
		dotProduct(relative, next.right) - x * next.metersPerPixel,
		dotProduct(relative, next.imageUp) + y * next.metersPerPixel
	];
}
