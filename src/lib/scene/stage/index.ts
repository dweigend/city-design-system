/** Module: Renders drawables with WebGPU in shared camera views. */
import { defaults } from '../../../config/stage';
import type { Vec2, Vec3 } from '../../core/geometry';
import { OrthographicCamera, Scene } from 'three/webgpu';
import type { Drawable } from '../surface';
import {
	cameraFrame,
	fitCamera,
	pickGround,
	readRay,
	type CameraFrame,
	type View,
	type ViewFit
} from './camera';
import { setStrokeDepth, strokeMaterials } from './edges';
import { createContent, displayTerrainAnchor, type TerrainAnchor } from './content';
import type { Display } from './material';
import { createStyle } from './style';
import { openRenderer } from './renderer';
import { stageState } from './state';
import { drawingPalette } from './tone';

/** Camera projections for the same geometry. */
export type {
	/** A world-space camera origin and unit direction into the scene. */
	CameraRay,
	/** Named camera projections of the same stage geometry. */
	View,
	/** Optional orthographic fit with radian angles, a fill fraction, and positive relative zoom. */
	ViewFit
} from './camera';
export {
	/** Unit direction of cast shadows in world XY. */
	shadowDirection,
	/** Horizontal shadow distance in meters per meter of object height. */
	shadowReach
} from './tone';
/** Direction of the stage light for surface recipes. */
export { surfaceLight } from './tone';
/** Measures a subject in the plane of a fitted view. */
export { projectFocus } from './camera';
/** Connects pointer and keyboard navigation to camera framing. */
export {
	/** Pointer and keyboard navigation. */
	stageNavigation,
	/** Positive, finite relative zoom bounds, inclusive. */
	type ZoomLimits
} from './navigation';
/** Triangulates a box, prism or mesh shape into flat positions and triangle indices. */
export { shapeArrays } from './geometry';
/** Horizontal framing in world meters and CSS pixels, independent of device pixel ratio. */
/** The fitted camera width and scale, and the point the camera looks at in stage meters. */
export type Viewport = Readonly<{ width: number; metersPerPixel: number; center: Vec3 }>;
/** Calculates presentation properties over existing drawable geometry for a fitted viewport. */
export type Presentation = (viewport: Viewport) => readonly Drawable[];

/** Surface displays for the same geometry. */
export type { Display } from './material';
/** Returns the fixed house, resolved surfaces and metric extents for a stage. */
export { stageExample } from './stage-example';

async function create({
	canvas,
	landscape = false,
	fit: initialFit,
	onViewport,
	onRender
}: {
	canvas: HTMLCanvasElement;
	landscape?: boolean;
	fit?: ViewFit;
	onViewport?: (viewport: Viewport) => void;
	onRender?: (drawables: readonly Drawable[]) => void;
}) {
	const gpu = await openRenderer(canvas);
	const { renderer, hardware, adapterName } = gpu;
	const state = stageState(hardware, adapterName);
	const scene = new Scene();
	const camera = new OrthographicCamera();
	const strokes = strokeMaterials(landscape);
	const palette = drawingPalette();
	const content = createContent(strokes, palette, landscape);
	scene.add(content.group);
	let aspect = 1;
	let widthPx = 1;
	let viewport: Viewport = {
		width: /* Exact arithmetic: unit viewport before the first fit. */ 1,
		metersPerPixel: /* Exact arithmetic: unit scale before the first fit. */ 1,
		center: /* Exact arithmetic: viewport starts at the origin. */ [0, 0, 0]
	};
	let present: Presentation | undefined;
	let presentAt: Viewport | undefined;
	let presented: readonly Drawable[] | undefined;
	const styleContent = createStyle(canvas, content, palette, strokes, scene, landscape);
	let fit = initialFit;
	let frame: number | undefined;
	let displayedFrame: CameraFrame | undefined;
	let frameCount = 0;
	let closing: Promise<void> | undefined;
	let work: (() => boolean) | undefined;
	let stale = false;
	let shown: readonly Drawable[] = [];

	function draw() {
		stale = true;
		schedule();
	}

	function schedule() {
		if (closing || frame !== undefined) return;
		frame = requestAnimationFrame(() => {
			frame = undefined;
			if (work && !work()) work = undefined;
			if (work) schedule();
			// A frame that only ran work, with nothing shown or moved, keeps the last image.
			if (!stale) return;
			stale = false;
			const { view, display, drawableCount, geometryBatchCount, geometryBuildCount } = state.read();
			const start = performance.now();
			const bounds = content.bounds;
			const framing = fitCamera(view, bounds, aspect, landscape, fit);
			const width = framing.halfWidth * 2;
			const looked = framing.center;
			if (
				viewport.width !== width ||
				viewport.metersPerPixel !== width / widthPx ||
				viewport.center.some((value, axis) => value !== looked[axis])
			) {
				viewport = { width, metersPerPixel: width / widthPx, center: looked };
				onViewport?.(viewport);
			}
			if (present && presentAt !== viewport) {
				presentAt = viewport;
				const next = present(viewport);
				if (next !== presented) content.style(next);
				presented = next;
			}
			const dark = canvas.ownerDocument.documentElement.dataset.theme === 'dark';
			styleContent(display, dark);
			const clipping = content.clippingBounds;
			const { center, eye, up, halfWidth, halfHeight, near, far } =
				clipping === bounds ? framing : fitCamera(view, bounds, aspect, landscape, fit, clipping);
			Object.assign(camera, {
				left: -halfWidth,
				right: halfWidth,
				top: halfHeight,
				bottom: -halfHeight,
				near,
				far
			});
			camera.position.set(...eye);
			camera.up.set(...up);
			camera.lookAt(...center);
			camera.updateProjectionMatrix();
			camera.getWorldDirection(strokes.eye.value).negate();
			setStrokeDepth(strokes, camera, clipping, width / widthPx);

			try {
				renderer.render(scene, camera);
				displayedFrame = {
					...cameraFrame({ center, eye, up, halfWidth, halfHeight, near, far }, widthPx),
					hit: content.hit
				};
				frameCount++;
				Object.assign(canvas.dataset, {
					stageReady: 'true',
					stageFrames: String(frameCount),
					stageBuilds: String(geometryBatchCount),
					stageDrawableBuilds: String(geometryBuildCount),
					stageDrawables: String(drawableCount),
					stageChunkBuilds: String(content.chunkBuilds),
					stageDrawCalls: String(renderer.info.render.drawCalls),
					stageMaterials: String(content.materialCount),
					stageView: view,
					stageDisplay: display,
					stageTheme: dark ? 'dark' : 'light',
					stageWidth: String(width),
					stageFrameCpuMs: (performance.now() - start).toFixed(defaults.stageTimingDigits)
				});
			} finally {
				gpu.stop();
			}
			onRender?.(shown);
		});
	}

	const theme = new MutationObserver(draw);
	theme.observe(canvas.ownerDocument.documentElement, {
		attributes: true,
		attributeFilter: ['data-theme']
	});
	Object.assign(canvas.dataset, { stageAdapter: adapterName, stageHardware: String(hardware) });

	return {
		/** Replaces the list, retaining geometry for unchanged IDs, shapes and stroke modes. */
		show(drawables: readonly Drawable[], presentation?: Presentation) {
			if (closing) return;
			shown = drawables;
			present = presentation;
			const start = performance.now();
			presentAt = undefined;
			presented = undefined;
			const builds = content.show(drawables);
			if (builds)
				canvas.dataset.stageMeshMs = (performance.now() - start).toFixed(
					defaults.stageTimingDigits
				);
			state.show(drawables, builds);
			draw();
		},
		/** Runs `task` once at the start of each frame while it returns true, so budgeted work can
		 * share the stage's frame loop. A new task replaces the previous one. */
		setWork(task: (() => boolean) | undefined) {
			if (closing) return;
			work = task;
			if (task) schedule();
		},
		/** Sets the fitted view. Throws RangeError for an unknown view. */
		setView(view: View) {
			if (!closing && state.setView(view)) draw();
		},
		/** Sets the surface display. Throws RangeError for an unknown display. */
		setDisplay(display: Display) {
			if (!closing && state.setDisplay(display)) draw();
		},
		/** Changes the orthographic framing without rebuilding geometry. Omit to reset. */
		setFit(next?: ViewFit) {
			if (closing || fit === next) return;
			fit = next;
			draw();
		},
		/** Reads the current fitted camera width and scale. */
		readViewport: () => viewport,
		/** Reads ground at a CSS pixel offset from the last displayed image center. */
		pickGround: (offset: Vec2) => pickGround(displayedFrame, offset),
		/** Reads the camera ray at the same offset as pickGround, once a frame has rendered. */
		readRay: (offset: Vec2) => readRay(displayedFrame, offset),
		/** Reads the image axes and scale the stage would use for another fit. */
		readFrame(next: ViewFit) {
			const framing = fitCamera(state.read().view, content.bounds, aspect, landscape, next);
			const camera = cameraFrame(framing, widthPx);
			const width = framing.halfWidth * 2;
			const nextViewport = { width, metersPerPixel: camera.metersPerPixel, center: camera.center };
			const nextPresentation = present?.(nextViewport);
			const sameViewport =
				presentAt !== undefined &&
				presentAt.width === nextViewport.width &&
				presentAt.metersPerPixel === nextViewport.metersPerPixel &&
				presentAt.center.every((value, axis) => value === nextViewport.center[axis]);
			return {
				...camera,
				hit: content.hit,
				locateGround: (point: Vec3, direction: Vec3) => {
					if (!nextPresentation || sameViewport) return content.locateGround(point, direction);
					const previous = presented ?? content.parts.map(({ drawable }) => drawable);
					const { display } = state.read();
					const dark = canvas.ownerDocument.documentElement.dataset.theme === 'dark';
					content.style(nextPresentation);
					styleContent(display, dark);
					try {
						return content.locateGround(point, direction);
					} finally {
						content.style(previous);
						styleContent(display, dark);
					}
				},
				displayGround: (anchor: TerrainAnchor) =>
					displayTerrainAnchor(
						anchor,
						nextPresentation?.[anchor.index] ?? content.parts[anchor.index].drawable
					)
			};
		},
		/** Resizes to CSS pixels with a device pixel ratio of at most two. */
		resize(widthCSS: number, heightPx: number) {
			if (closing) return;
			const width = Math.max(1, Math.round(widthCSS));
			const height = Math.max(1, Math.round(heightPx));
			widthPx = width;
			aspect = width / height;
			renderer.setDrawingBufferSize(
				width,
				height,
				Math.min(devicePixelRatio, defaults.stageMaxPixelRatio)
			);
			draw();
		},
		/** Returns a detached observation. Geometry builds are cumulative per drawable. */
		read: state.read,
		/** Cancels rendering, disconnects the observer and awaits GPU release. Idempotent. */
		delete() {
			return (closing ??= (async () => {
				if (frame !== undefined) cancelAnimationFrame(frame);
				theme.disconnect();
				try {
					scene.remove(content.group);
					content.delete();
				} finally {
					try {
						for (const material of strokes.materials) material.dispose();
						for (const key of Object.keys(canvas.dataset))
							if (key.startsWith('stage')) delete canvas.dataset[key];
					} finally {
						await gpu.delete();
					}
				}
			})());
		}
	};
}

/** Opens a WebGPU stage on the supplied canvas. Rejects if WebGPU cannot initialise. */
export const Stage = Object.freeze({ create });
