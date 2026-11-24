/** Module: Renders drawables with WebGPU in shared camera views. */
import type { Vec2 } from '../../core/geometry';
import { OrthographicCamera, Scene } from 'three/webgpu';
import type { Drawable } from '../surface';
import {
	cameraFrame,
	fitCamera,
	pickGround,
	type CameraFrame,
	type View,
	type ViewFit
} from './camera';
import { setStrokeDepth, strokeMaterials } from './edges';
import { createContent } from './content';
import type { Display } from './material';
import { createStyle } from './style';
import { openRenderer } from './renderer';
import { stageState } from './state';
import { drawingPalette } from './tone';

/** Camera projections for the same geometry. */
export type { View, ViewFit } from './camera';
/** Shadows fall along a horizontal unit direction, `shadowReach` metres per metre of height. */
export { shadowDirection, shadowReach } from './tone';
/** Direction of the stage light for surface recipes. */
export { surfaceLight } from './tone';
/** Measures a subject in the plane of a fitted view. */
export { projectFocus } from './camera';
/** Connects pointer and keyboard navigation to camera framing. */
export { stageNavigation } from './navigation';
/** Horizontal framing in world meters and CSS pixels, independent of device pixel ratio. */
export type Viewport = Readonly<{ width: number; metersPerPixel: number }>;
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
	onViewport
}: {
	canvas: HTMLCanvasElement;
	landscape?: boolean;
	fit?: ViewFit;
	onViewport?: (viewport: Viewport) => void;
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
	let viewport: Viewport = { width: 1, metersPerPixel: 1 };
	let present: Presentation | undefined;
	const styleContent = createStyle(canvas, content, palette, strokes, scene, landscape);
	let fit = initialFit;
	let frame: number | undefined;
	let displayedFrame: CameraFrame | undefined;
	let frameCount = 0;
	let closing: Promise<void> | undefined;

	function draw() {
		if (closing || frame !== undefined) return;
		frame = requestAnimationFrame(() => {
			frame = undefined;
			const { view, display, geometryBatchCount, geometryBuildCount } = state.read();
			const start = performance.now();
			const bounds = content.bounds;
			const framing = fitCamera(view, bounds, aspect, landscape, fit);
			const width = framing.halfWidth * 2;
			if (viewport.width !== width || viewport.metersPerPixel !== width / widthPx) {
				viewport = { width, metersPerPixel: width / widthPx };
				onViewport?.(viewport);
			}
			if (present) content.style(present(viewport));
			const clipping = present ? content.clippingBounds : bounds;
			const { center, eye, up, halfWidth, halfHeight, near, far } = present
				? fitCamera(view, bounds, aspect, landscape, fit, clipping)
				: framing;
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

			const dark = canvas.ownerDocument.documentElement.dataset.theme === 'dark';
			styleContent(display, dark);
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
					stageView: view,
					stageDisplay: display,
					stageTheme: dark ? 'dark' : 'light',
					stageWidth: String(width),
					stageFrameCpuMs: (performance.now() - start).toFixed(2)
				});
			} finally {
				gpu.stop();
			}
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
			present = presentation;
			const start = performance.now();
			const builds = content.show(drawables);
			if (builds) canvas.dataset.stageMeshMs = (performance.now() - start).toFixed(2);
			state.show(drawables, builds);
			draw();
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
		pickGround: (offset: Vec2) => displayedFrame && pickGround(displayedFrame, offset),
		/** Reads the image axes and scale the stage would use for another fit. */
		readFrame: (next: ViewFit) => ({
			...cameraFrame(
				fitCamera(state.read().view, content.bounds, aspect, landscape, next),
				widthPx
			),
			hit: content.hit
		}),
		/** Resizes to CSS pixels with a device pixel ratio of at most two. */
		resize(widthCSS: number, heightPx: number) {
			if (closing) return;
			const width = Math.max(1, Math.round(widthCSS));
			const height = Math.max(1, Math.round(heightPx));
			widthPx = width;
			aspect = width / height;
			renderer.setDrawingBufferSize(width, height, Math.min(devicePixelRatio, 2));
			draw();
		},
		/** Returns a detached observation. Geometry builds are cumulative per drawable. */
		read: state.read,
		/** Cancels rendering, disconnects the observer and awaits GPU release. Idempotent. */
		delete() {
			return (closing ??= (async () => {
				if (frame !== undefined) cancelAnimationFrame(frame);
				theme.disconnect();
				scene.remove(content.group);
				content.delete();
				for (const name of ['outer', 'crease', 'ground', 'grid', 'gridBoundary'] as const)
					strokes[name].dispose();
				for (const key of Object.keys(canvas.dataset))
					if (key.startsWith('stage')) delete canvas.dataset[key];
				await gpu.delete();
			})());
		}
	};
}

/** Opens a WebGPU stage on the supplied canvas. Rejects if WebGPU cannot initialise. */
export const Stage = Object.freeze({ create });
