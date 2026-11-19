/**
 * View of the sandbox: parallel projection at the catalog's viewing angles, or straight down
 * as a plan. Only pan and zoom move; the view is never an authority for world coordinates
 * (A-53).
 */
import * as THREE from 'three/webgpu';
import { resolveParams, type ParamOverrides } from '../../logic/params';
import type { Vec3 } from '../../logic/parametrik/types';
import { OPENING_VIEW_PARAMS } from './view-params';
import { BLICK } from '../../data/leitstil';

/** Visible image height in world meters: closest and widest zoom. */
const SPAN_MIN = 45;
const SPAN_MAX = 1500;
/** Distance of the camera from its target, meters; far enough to clear every building. */
const CAMERA_DISTANCE = 1400;

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
	let elevationRad = BLICK.hoeheRad;
	let width = 1;
	let height = 1;
	let span = 400;

	function apply() {
		const halfHeight = span / 2;
		const halfWidth = (halfHeight * width) / height;
		camera.left = -halfWidth;
		camera.right = halfWidth;
		camera.top = halfHeight;
		camera.bottom = -halfHeight;
		// The plan looks straight down with north up; the axonometric view turns by the azimuth.
		const plan = elevationRad > 1.5;
		const azimuthRad = plan ? 0 : BLICK.azimutRad;
		right.set(Math.cos(azimuthRad), 0, -Math.sin(azimuthRad));
		forward.set(-Math.sin(azimuthRad), 0, -Math.cos(azimuthRad));
		eye.copy(forward).multiplyScalar(-Math.cos(elevationRad)).setY(Math.sin(elevationRad));
		camera.up.copy(plan ? forward : THREE.Object3D.DEFAULT_UP);
		camera.position.copy(target).addScaledVector(eye, CAMERA_DISTANCE);
		camera.lookAt(target);
		camera.updateProjectionMatrix();
		camera.updateMatrixWorld();
	}

	const metersPerPixel = () => span / height;
	/** Ground meters per image meter along the image's vertical axis. */
	const foreshortening = () => 1 / Math.sin(elevationRad);

	/** Moves the image content by a screen offset in pixels (x right, y down). */
	function pan(dxPx: number, dyPx: number) {
		const scale = metersPerPixel();
		target.addScaledVector(right, -dxPx * scale);
		target.addScaledVector(forward, -dyPx * scale * foreshortening());
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
		const before = groundPoint(xPx, yPx);
		span = Math.max(SPAN_MIN, Math.min(SPAN_MAX, span * factor));
		target.add(before.sub(groundPoint(xPx, yPx)));
		apply();
	}

	apply();
	return {
		camera,
		target,
		pan,
		zoomAt,
		metersPerPixel,
		/** Visible image height in meters. */
		span: () => span,
		/** Switches between the axonometric view and the plan seen from above. */
		setPlan(plan: boolean) {
			elevationRad = plan ? Math.PI / 2 : BLICK.hoeheRad;
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
			box.getCenter(target);
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
		/** Frames an opening cell at the requested projected width on a portrait canvas. */
		framePortrait([x, y, z]: Vec3, corners: readonly Vec3[]) {
			if (width >= height) return false;
			const offsets = corners.map(([px, py, pz]) => right.dot(new THREE.Vector3(px, pz, -py)));
			const extent = Math.max(...offsets) - Math.min(...offsets);
			if (!extent) return false;
			target.set(x, z, -y);
			span = (height * extent) / opening.mobileCellWidthPx;
			pan(0, height * (0.5 - opening.mobileReferenceY));
			return true;
		},
		/** Canvas pixel → normalized device coordinates for ray casting. */
		ndc: (xPx: number, yPx: number) =>
			new THREE.Vector2((xPx / width) * 2 - 1, 1 - (yPx / height) * 2)
	};
}
