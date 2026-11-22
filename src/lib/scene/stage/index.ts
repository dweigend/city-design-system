import { Line2NodeMaterial, OrthographicCamera, Scene } from 'three/webgpu';
import type { Drawable } from '../surface';
import { fitCamera, type View } from './camera';
import { projectContent } from './content';
import { readColors, readDisplay, type Display } from './material';
import { openRenderer } from './renderer';
import { stageState } from './state';

/** Camera projections for the same geometry. */
export type { View } from './camera';
/** Surface displays for the same geometry. */
export type { Display } from './material';
/** Returns the fixed house, resolved surfaces and metric extents for a stage. */
export { stageExample } from './example';

async function create({ canvas }: { canvas: HTMLCanvasElement }) {
	const gpu = await openRenderer(canvas);
	const { renderer, hardware, adapterName } = gpu;
	const state = stageState(hardware, adapterName);
	const scene = new Scene();
	const camera = new OrthographicCamera();
	const ink = new Line2NodeMaterial({ linewidth: 1.05, depthWrite: false });
	let content = projectContent([], ink);
	let aspect = 1;
	let frame: number | undefined;
	let closing: Promise<void> | undefined;

	function draw() {
		if (closing || frame !== undefined) return;
		frame = requestAnimationFrame(() => {
			frame = undefined;
			const { view, display } = state.read();
			const { center, eye, up, halfWidth, halfHeight, near, far } = fitCamera(
				view,
				content.bounds,
				aspect
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

			const color = readColors(canvas);
			const paper = color('--paper');
			scene.background = paper;
			ink.color.copy(color('--ink'));
			const style = readDisplay(display);
			for (const { drawable, mesh, shade } of content.parts) {
				const { opacity, shade: strength, paper: usePaper } = style(drawable.finish);
				const material = mesh.material;
				const transparent = opacity < 1;
				if (material.transparent !== transparent) material.needsUpdate = true;
				Object.assign(material, { opacity, transparent, depthWrite: !transparent });
				if (usePaper) material.color.copy(paper).lerp(ink.color, 0.1);
				else material.color.copy(color(drawable.color)).lerp(paper, 0.48);
				shade.value = strength;
				mesh.visible = opacity > 0 && mesh.geometry.attributes.position.count > 0;
			}
			try {
				renderer.render(scene, camera);
				canvas.dataset.stageReady = 'true';
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
		/** Replaces the list in order, building each drawable once. */
		show(drawables: readonly Drawable[]) {
			if (closing) return;
			const next = projectContent(drawables, ink);
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
				ink.dispose();
				delete canvas.dataset.stageReady;
				delete canvas.dataset.stageAdapter;
				delete canvas.dataset.stageHardware;
				await gpu.delete();
			})());
		}
	};
}

/** Opens a WebGPU stage on the supplied canvas. Rejects if WebGPU cannot initialise. */
export const Stage = Object.freeze({ create });
