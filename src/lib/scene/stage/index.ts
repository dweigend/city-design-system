import { OrthographicCamera, Scene } from 'three/webgpu';
import type { Drawable } from '../surface';
import { fitCamera, type View, type ViewFit } from './camera';
import { strokeMaterials } from './edges';
import { hasSameGeometry, projectContent } from './content';
import { readColors, readDisplay, type Display } from './material';
import { openRenderer } from './renderer';
import { stageState } from './state';
import { drawingPalette } from './tone';

/** Camera projections for the same geometry. */
export type { View, ViewFit } from './camera';
/** Surface displays for the same geometry. */
export type { Display } from './material';
/** Returns the fixed house, resolved surfaces and metric extents for a stage. */
export { stageExample } from './example';

async function create({
	canvas,
	landscape = false,
	fit
}: {
	canvas: HTMLCanvasElement;
	landscape?: boolean;
	fit?: ViewFit;
}) {
	const gpu = await openRenderer(canvas);
	const { renderer, hardware, adapterName } = gpu;
	const state = stageState(hardware, adapterName);
	const scene = new Scene();
	const camera = new OrthographicCamera();
	const strokes = strokeMaterials(landscape);
	const palette = drawingPalette();
	let content = projectContent([], strokes, palette, landscape);
	let aspect = 1;
	let frame: number | undefined;
	let closing: Promise<void> | undefined;

	function styleContent(display: Display, dark: boolean) {
		const css = getComputedStyle(canvas);
		const color = readColors(css, canvas.ownerDocument);
		const paper = color('--paper');
		const hull = Number(css.getPropertyValue('--alpha-hull'));
		scene.background = paper;
		const ink = color('--ink-2');
		palette.ink.value.copy(ink);

		strokes.outer.color.copy(ink);
		strokes.crease.color.copy(ink);
		if (landscape) strokes.crease.color.lerp(paper, dark ? 0.13 : 0.04);
		strokes.ground.color.copy(paper).lerp(ink, 0.48);
		content.ground?.shadow.material.color.copy(paper).lerp(ink, dark ? 0.016 : 0.32);
		palette.dark.value = Number(dark);
		palette.hull.value = Number(display === 'transparency');
		const style = readDisplay(display);
		for (const { drawable, mesh, terrain, flat, heightScale } of content.parts) {
			const { opacity, paper: usePaper } = style(drawable.finish, hull);
			const material = mesh.material;
			const transparent = opacity < 1;
			const polygonOffset = !landscape && drawable.finish !== 'glass';
			terrain.value = Number(drawable.finish === 'terrain');
			flat.value = Number(drawable.flat === true);
			heightScale.value = drawable.heightScale ?? 1;
			if (material.transparent !== transparent || material.polygonOffset !== polygonOffset)
				material.needsUpdate = true;
			Object.assign(material, { opacity, transparent, polygonOffset, depthWrite: !transparent });
			if (usePaper) material.color.copy(paper).lerp(color('--ink'), dark ? 0.09 : 0.19);
			else material.color.copy(color(drawable.color));
			mesh.visible = opacity > 0 && mesh.geometry.attributes.position.count > 0;
		}
	}

	function draw() {
		if (closing || frame !== undefined) return;
		frame = requestAnimationFrame(() => {
			frame = undefined;
			const { view, display, geometryBatchCount } = state.read();
			const { center, eye, up, halfWidth, halfHeight, near, far } = fitCamera(
				view,
				content.bounds,
				aspect,
				landscape,
				fit
			);
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

			const dark = canvas.ownerDocument.documentElement.dataset.theme === 'dark';
			styleContent(display, dark);
			try {
				renderer.render(scene, camera);
				Object.assign(canvas.dataset, {
					stageReady: 'true',
					stageBuilds: String(geometryBatchCount),
					stageView: view,
					stageTheme: dark ? 'dark' : 'light'
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
		/** Replaces the list, retaining geometry for the same ordered IDs and shapes. */
		show(drawables: readonly Drawable[]) {
			if (closing) return;
			if (hasSameGeometry(content.parts, drawables)) {
				content.parts.forEach((part, index) => (part.drawable = drawables[index]));
				draw();
				return;
			}
			const start = performance.now();
			const next = projectContent(drawables, strokes, palette, landscape);
			canvas.dataset.stageMeshMs = (performance.now() - start).toFixed(2);
			scene.remove(content.group);
			content.delete();
			content = next;
			scene.add(content.group);
			state.show(drawables);
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
		/** Resizes to CSS pixels with a device pixel ratio of at most two. */
		resize(widthPx: number, heightPx: number) {
			if (closing) return;
			const width = Math.max(1, Math.round(widthPx));
			const height = Math.max(1, Math.round(heightPx));
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
				strokes.outer.dispose();
				strokes.crease.dispose();
				strokes.ground.dispose();
				delete canvas.dataset.stageReady;
				delete canvas.dataset.stageAdapter;
				delete canvas.dataset.stageHardware;
				delete canvas.dataset.stageBuilds;
				delete canvas.dataset.stageView;
				delete canvas.dataset.stageTheme;
				delete canvas.dataset.stageMeshMs;
				await gpu.delete();
			})());
		}
	};
}

/** Opens a WebGPU stage on the supplied canvas. Rejects if WebGPU cannot initialise. */
export const Stage = Object.freeze({ create });
