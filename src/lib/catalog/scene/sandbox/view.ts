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

export type OpeningArea = {
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
	let openingFit: { points: THREE.Vector3[]; area?: OpeningArea; fit: CourtFit } | undefined;

	function apply() {
		const halfHeight = span / 2;
		const halfWidth = (halfHeight * width) / height;
		camera.left = -halfWidth;
		camera.right = halfWidth;
		camera.top = halfHeight;
		camera.bottom = -halfHeight;
		// The plan looks straight down with north up; the axonometric view turns by the azimuth.
		const plan = elevationRad === Math.PI / 2;
		const azimuthRad = plan ? 0 : heading;
		right.set(Math.cos(azimuthRad), 0, -Math.sin(azimuthRad));
		forward.set(-Math.sin(azimuthRad), 0, -Math.cos(azimuthRad));
		eye.copy(forward).multiplyScalar(-Math.cos(elevationRad)).setY(Math.sin(elevationRad));
		camera.up.copy(plan ? forward : THREE.Object3D.DEFAULT_UP);
		camera.position.copy(target).addScaledVector(eye, CAMERA_DISTANCE);
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
		openingFit = undefined;
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
		openingFit = undefined;
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

	return {
		camera,
		target,
		pan,
		zoomAt,
		metersPerPixel,
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
		/** Frames a three.js box: its center in the image center, `margin` ≥ 1 around its silhouette. */
		frameBox(box: THREE.Box3, margin: number) {
			openingFit = undefined;
			focusY = focusX = 0.5;
			heading = BLICK.azimutRad;
			box.getCenter(target);
			if (elevationRad !== Math.PI / 2) elevationRad = BLICK.hoeheRad;
			apply();
			const up = new THREE.Vector3().crossVectors(eye, right);
			const corner = new THREE.Vector3();
			let halfWidth = 0;
			let halfHeight = 0;
			for (const x of [box.min.x, box.max.x])
				for (const y of [box.min.y, box.max.y])
					for (const z of [box.min.z, box.max.z]) {
						corner.set(x, y, z).sub(target);
						halfWidth = Math.max(halfWidth, Math.abs(corner.dot(right)));
						halfHeight = Math.max(halfHeight, Math.abs(corner.dot(up)));
					}
			const fit = Math.max(halfHeight * 2, (halfWidth * 2 * height) / width) * margin;
			span = Math.max(SPAN_MIN, Math.min(SPAN_MAX, fit));
			apply();
		},
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
