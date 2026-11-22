/**
 * View of the sandbox: parallel projection in axonometric view, or straight down
 * as a plan. Only pan and zoom move; the view is never an authority for world coordinates
 * (A-53).
 */
import * as THREE from 'three/webgpu';
import { resolveParams, type ParamOverrides } from '../../core/params';
import type { Vec3 } from '../../logic/parametrik/types';
import { OPENING_VIEW_PARAMS } from './view-params';
import { BLICK } from '../../data/leitstil';

/** Visible image height in world meters: closest and widest zoom. */
const SPAN_MIN = 30;
const SPAN_MAX = 1500;
/** Distance of the camera from its target, meters; far enough to clear every building. */
const CAMERA_DISTANCE = 1400;
const CONTEXT_DEPTH_MARGIN_M = 200;

export type OpeningArea = {
	featuredCentre?: { cellId: string; headingDeg: number };
	top: number;
	bottom: number;
	right?: number;
	left?: number;
	reserved?: readonly Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>[];
};

export type CourtFit = {
	heading: number;
	pitchOffset: number;
	fill: number;
	offset: THREE.Vector2;
	courtCenters?: readonly Vec3[];
};
export type View = ReturnType<typeof createView>;
export type FrameOrientation = Readonly<{ headingRad: number; elevationRad: number }>;

type BoxMove = Readonly<{
	from: FrameOrientation;
	to: FrameOrientation;
	startedAt: number;
	duration: number;
	fit: () => void;
}>;

type InspectionPose = Readonly<{ elevation: number; margin: number }>;

/** Creates the camera and its pan and zoom state. Sizes in CSS pixels, lengths in meters. */
export function createView(overrides?: ParamOverrides<typeof OPENING_VIEW_PARAMS>) {
	const opening = resolveParams(OPENING_VIEW_PARAMS, undefined, overrides);
	const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, CAMERA_DISTANCE * 2.5);
	const target = new THREE.Vector3();
	/** Image axes on the ground: to the right and away from the viewer. */
	const right = new THREE.Vector3();
	const forward = new THREE.Vector3();
	/** Unit vector from the target toward the camera, three.js axes. */
	const eye = new THREE.Vector3();
	let heading = Number(BLICK.azimutRad);
	let elevationRad = BLICK.hoeheRad;
	let axonElevationRad = elevationRad;
	// Vertical canvas fraction reserved for the focus, including the portrait HUD offset.
	let focusX = 0.5;
	let focusY = 0.5;
	let width = 1;
	let height = 1;
	let span = 400;
	let cameraDistance = CAMERA_DISTANCE;
	let openingFit: { points: THREE.Vector3[]; area?: OpeningArea; fit: CourtFit } | undefined;
	let openingSubject: THREE.Vector3[] | undefined;
	let inspectionBounds: THREE.Box3 | undefined;
	let inspection: InspectionPose | undefined;
	let boxMove: BoxMove | undefined;
	let openingPose: { target: THREE.Vector3; elevation: number; span: number } | undefined;

	function apply(fit?: () => void) {
		// The plan looks straight down with north up; the axonometric view turns by the azimuth.
		const plan = elevationRad === Math.PI / 2;
		const azimuthRad = plan ? 0 : heading;
		right.set(Math.cos(azimuthRad), 0, -Math.sin(azimuthRad));
		forward.set(-Math.sin(azimuthRad), 0, -Math.cos(azimuthRad));
		eye.copy(forward).multiplyScalar(-Math.cos(elevationRad)).setY(Math.sin(elevationRad));
		fit?.();
		const halfHeight = span / 2;
		const halfWidth = (halfHeight * width) / height;
		camera.left = -halfWidth;
		camera.right = halfWidth;
		camera.top = halfHeight;
		camera.bottom = -halfHeight;
		camera.up.copy(plan ? forward : THREE.Object3D.DEFAULT_UP);
		camera.position.copy(target).addScaledVector(eye, cameraDistance);
		camera.lookAt(target);
		camera.updateProjectionMatrix();
		camera.updateMatrixWorld();
	}

	function orientOpening(fit?: CourtFit) {
		heading = fit?.heading ?? BLICK.azimutRad;
		if (elevationRad !== Math.PI / 2) {
			const base = width < height ? (opening.mobileElevationDeg * Math.PI) / 180 : BLICK.hoeheRad;
			elevationRad = Math.max(Math.PI / 30, base + (fit?.pitchOffset ?? 0));
		}
		apply();
	}

	const clusterFill = () => (width < height ? opening.portraitFill : opening.clusterFill);
	const metersPerPixel = () => span / height;
	/** Ground meters per image meter along the image's vertical axis. */
	const foreshortening = () => 1 / Math.sin(elevationRad);

	/** Moves the image content by a screen offset in pixels (x right, y down). */
	function pan(dxPx: number, dyPx: number) {
		if (!inspection) openingFit = undefined;
		const scale = metersPerPixel();
		target.addScaledVector(right, -dxPx * scale);
		target.addScaledVector(forward, dyPx * scale * foreshortening());
		apply();
	}

	/** Point of the horizontal plane through the target under a canvas position in pixels. */
	function groundPoint(xPx: number, yPx: number): THREE.Vector3 {
		const scale = metersPerPixel();
		return target
			.clone()
			.addScaledVector(right, (xPx - width / 2) * scale)
			.addScaledVector(forward, (height / 2 - yPx) * scale * foreshortening());
	}

	/** Scales the visible span by `factor` and keeps the ground under the pixel in place. */
	function zoomAt(factor: number, xPx: number, yPx: number) {
		if (!inspection) openingFit = undefined;
		const before = groundPoint(xPx, yPx);
		span = Math.max(SPAN_MIN, Math.min(SPAN_MAX, span * factor));
		target.add(before.sub(groundPoint(xPx, yPx)));
		apply();
	}

	apply();
	// Project actual water cells onto the same camera axes as the town. Meanders can place
	// the bank nearest the town centroid outside the middle of the opening.
	function fitWaterfront(
		center: THREE.Vector2,
		up: THREE.Vector3,
		room: number,
		water: Vec3[],
		anchored: boolean
	) {
		const pixel = metersPerPixel();
		const band = width * pixel * 0.045;
		let nearest = Infinity;
		const point = new THREE.Vector3();
		for (const [x, y, z] of water) {
			point.set(x, z, -y);
			if (Math.abs(point.dot(right) - center.x) > band) continue;
			const offset = point.dot(up) - center.y;
			if (Math.abs(offset) < Math.abs(nearest)) nearest = offset;
		}
		if (!Number.isFinite(nearest)) return;
		const margin = room * pixel * 0.44;
		if (anchored) span = Math.min(SPAN_MAX, span * Math.max(1, Math.abs(nearest) / margin));
		else center.y += nearest - THREE.MathUtils.clamp(nearest, -margin, margin);
	}

	function fittedSpan(w: number, h: number, usableWidth: number, room: number, fill: number) {
		return THREE.MathUtils.clamp(
			(Math.max(w / usableWidth, h / room) * height) / fill,
			SPAN_MIN,
			SPAN_MAX
		);
	}
	function fitOpening(bounds: THREE.Box2, area?: OpeningArea, fill = clusterFill()) {
		const room = area ? Math.max(1, area.bottom - area.top) : height;
		const usableWidth = Math.max(1, Math.min(width, area?.right ?? width) - (area?.left ?? 0));
		const size = bounds.getSize(new THREE.Vector2());
		span = fittedSpan(size.x, size.y, usableWidth, room, fill);
		return { room, usableWidth };
	}

	function alignOpening(area: OpeningArea | undefined, usableWidth: number, fit?: CourtFit) {
		focusY = area ? (area.top + area.bottom) / (2 * height) : 0.5;
		focusX = ((area?.left ?? 0) + usableWidth / 2) / width;
		const offset = fit?.offset ?? new THREE.Vector2();
		pan((focusX - 0.5) * width + offset.x, (focusY - 0.5) * height + offset.y);
	}

	/** Centers the projected silhouette. Points are in three.js meters. */
	function frameSilhouette(
		points: THREE.Vector3[],
		anchor?: THREE.Vector3,
		area?: OpeningArea,
		water: Vec3[] = [],
		fit?: CourtFit
	) {
		orientOpening(fit);
		const bounds = new THREE.Box2();
		const up = new THREE.Vector3().crossVectors(eye, right);
		for (const point of points)
			bounds.expandByPoint(new THREE.Vector2(point.dot(right), point.dot(up)));
		const { room, usableWidth } = fitOpening(bounds, area, fit?.fill);

		const center = bounds.getCenter(new THREE.Vector2());
		const depth = (anchor ?? new THREE.Box3().setFromPoints(points).getCenter(target)).dot(eye);
		if (anchor) center.set(anchor.dot(right), anchor.dot(up));
		fitWaterfront(center, up, room, water, Boolean(anchor));
		target.copy(eye).multiplyScalar(depth);
		target.addScaledVector(right, center.x).addScaledVector(up, center.y);
		apply();
		alignOpening(area, usableWidth, fit);
		openingSubject = points;
		inspectionBounds = undefined;
		openingFit = fit && width >= height ? { points, area, fit } : undefined;
	}

	// Keep the opening houses and any court centres seen between them when looking straight down.
	function refitOpening(saved: NonNullable<typeof openingFit>, plan: boolean) {
		if (!plan) return frameSilhouette(saved.points, undefined, saved.area, [], saved.fit);
		const centers = (saved.fit.courtCenters ?? []).map(([x, y, z]) => new THREE.Vector3(x, z, -y));
		const visible = centers.filter((center) => {
			const p = center.clone().project(camera);
			return Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1;
		});
		frameSilhouette([...saved.points, ...visible], undefined, saved.area, [], {
			...saved.fit,
			offset: new THREE.Vector2()
		});
		openingFit = saved;
	}

	function fitBoxSpan(box: THREE.Box3, margin: number, fullExtent = false) {
		const up = new THREE.Vector3().crossVectors(eye, right);
		const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
		const extent = (axis: THREE.Vector3) =>
			Math.abs(axis.x) * half.x + Math.abs(axis.y) * half.y + Math.abs(axis.z) * half.z;
		const fit = Math.max(extent(up), (extent(right) * height) / width) * 2 * margin;
		span = fullExtent ? fit : Math.max(SPAN_MIN, Math.min(SPAN_MAX, fit));
		const halfDepth = fullExtent ? extent(eye) : 0;
		cameraDistance = Math.max(CAMERA_DISTANCE, halfDepth + CONTEXT_DEPTH_MARGIN_M);
		camera.far = Math.max(
			CAMERA_DISTANCE * 2.5,
			cameraDistance + halfDepth + CONTEXT_DEPTH_MARGIN_M
		);
	}

	/** Caches ground bounds around the opening subject and the nearby visible water. */
	function frameInspection(water: THREE.BufferGeometry) {
		if (!openingSubject) return;
		const box = new THREE.Box3().setFromPoints(openingSubject);
		const center = box.getCenter(new THREE.Vector3());
		const size = box.getSize(new THREE.Vector3());
		const reach = Math.max(size.x, size.z) * 0.75;
		const position = water.getAttribute('position');
		const point = new THREE.Vector3();
		for (let i = 0; i < position.count; i++) {
			point.fromBufferAttribute(position, i);
			const distance = (point.x - center.x) ** 2 + (point.z - center.z) ** 2;
			if (distance <= reach ** 2) box.expandByPoint(point);
		}
		box.max.y = box.min.y;
		inspectionBounds = box;
	}

	/** Applies an alternate pose around the opening target, or restores the opening camera. */
	function setInspection(next?: InspectionPose) {
		if (openingPose) {
			target.copy(openingPose.target);
			elevationRad = openingPose.elevation;
			span = openingPose.span;
			openingPose = undefined;
		}
		inspection = next;
		if (next) {
			openingPose = { target: target.clone(), elevation: elevationRad, span };
			elevationRad = next.elevation;
			apply();
			if (inspectionBounds) {
				inspectionBounds.getCenter(target);
				fitBoxSpan(inspectionBounds, next.margin);
			}
		}
		apply();
	}

	/** Advances a fixed-context camera move and keeps its full bounds in the viewport. */
	function stepBoxMove(stamp: number, reduced: boolean) {
		if (!boxMove) return false;
		const { from, to, startedAt, duration, fit } = boxMove;
		const progress = reduced ? 1 : THREE.MathUtils.clamp((stamp - startedAt) / duration, 0, 1);
		const ease = progress ** 2 * (3 - 2 * progress);
		heading = THREE.MathUtils.lerp(from.headingRad, to.headingRad, ease);
		elevationRad = THREE.MathUtils.lerp(from.elevationRad, to.elevationRad, ease);
		apply(fit);
		if (progress === 1) boxMove = undefined;
		return progress < 1;
	}

	return {
		camera,
		target,
		pan,
		zoomAt,
		metersPerPixel,
		setInspection,
		frameInspection,
		/** Fits the opening camera, then reapplies the current alternate pose. */
		frameBase(frame: () => void) {
			const saved = inspection;
			if (saved) setInspection();
			try {
				frame();
			} finally {
				if (saved) setInspection(saved);
			}
		},
		/** Returns the opening camera's drawing metrics while an alternate pose is active. */
		drawingMetrics: () => ({
			scale: height / (openingPose?.span ?? span),
			elevation: openingPose?.elevation ?? elevationRad
		}),
		/** Camera elevation in radians, including the vertical plan. */
		elevation: () => elevationRad,
		/** Visible image height in meters. */
		span: () => span,
		/** Rotates between axonometric and plan around the focused point on the target plane. */
		setPlan(plan: boolean) {
			if (plan === (elevationRad === Math.PI / 2)) return;
			const focus = groundPoint(width * focusX, height * focusY);
			if (plan) axonElevationRad = elevationRad;
			elevationRad = plan ? Math.PI / 2 : axonElevationRad;
			if (openingFit) {
				refitOpening(openingFit, plan);
				return;
			}
			apply();
			target.add(focus.sub(groundPoint(width * focusX, height * focusY)));
			apply();
		},
		/** Canvas size in CSS pixels. */
		resize(nextWidth: number, nextHeight: number) {
			width = Math.max(1, nextWidth);
			height = Math.max(1, nextHeight);
			apply();
		},
		/** Frames a three.js box. An explicit orientation fits fixed studies at their full extent. */
		frameBox(box: THREE.Box3, margin: number, orientation?: FrameOrientation, durationMs = 0) {
			boxMove = undefined;
			const from = { headingRad: heading, elevationRad };
			openingFit = undefined;
			openingSubject = undefined;
			inspectionBounds = undefined;
			focusY = focusX = 0.5;
			heading = orientation?.headingRad ?? BLICK.azimutRad;
			box.getCenter(target);
			if (orientation) elevationRad = orientation.elevationRad;
			else if (elevationRad !== Math.PI / 2) elevationRad = BLICK.hoeheRad;
			const fit = () => fitBoxSpan(box, margin, Boolean(orientation));
			if (durationMs > 0 && orientation) {
				boxMove = {
					from,
					to: orientation,
					startedAt: performance.now(),
					duration: durationMs,
					fit
				};
				heading = from.headingRad;
				elevationRad = from.elevationRad;
			}
			apply(fit);
		},
		stepBoxMove,
		/** Whether the canvas is taller than it is wide. */
		isPortrait: () => width < height,
		/** Canvas dimensions in CSS pixels. */
		viewport: () => [width, height] as const,
		/** CSS pixels per metre after fitting a projected court envelope to the available room. */
		courtScale: (w: number, h: number, usableWidth: number, room: number, fill: number) =>
			height / fittedSpan(w, h, usableWidth, room, fill),
		frameSilhouette,
		/** World meters to the current canvas position in CSS pixels. */
		project([x, y, z]: Vec3) {
			const point = new THREE.Vector3(x, z, -y).project(camera);
			return { x: ((point.x + 1) * width) / 2, y: ((1 - point.y) * height) / 2 };
		},
		/** Canvas pixel → normalized device coordinates for ray casting. */
		ndc: (xPx: number, yPx: number) =>
			new THREE.Vector2((xPx / width) * 2 - 1, 1 - (yPx / height) * 2)
	};
}
