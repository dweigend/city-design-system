import { Color, NoToneMapping, Scene, SRGBColorSpace, WebGPURenderer } from 'three/webgpu';

/** Creates an opaque drawing renderer at up to two device pixels per CSS pixel. */
export function createDrawingRenderer(canvas: HTMLCanvasElement) {
	const renderer = new WebGPURenderer({ canvas, antialias: true, alpha: false });
	renderer.outputColorSpace = SRGBColorSpace;
	renderer.toneMapping = NoToneMapping;
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
	return renderer;
}

/** Records the active backend and starts drawing if the scene still owns the canvas. */
export function initializeDrawingRenderer(
	renderer: WebGPURenderer,
	canvas: HTMLCanvasElement,
	isAlive: () => boolean,
	draw: () => void,
	onError?: () => void
) {
	return renderer
		.init()
		.then(() => {
			canvas.dataset.backend =
				'isWebGPUBackend' in renderer.backend && renderer.backend.isWebGPUBackend
					? 'webgpu'
					: 'webgl2';
			if (isAlive()) draw();
			else renderer.dispose();
		})
		.catch((cause) => {
			if (isAlive()) onError?.();
			throw cause;
		});
}

/** Resizes the buffer in CSS pixels without changing layout and returns its clamped dimensions. */
export function resizeDrawingRenderer(
	renderer: WebGPURenderer,
	widthPx: number,
	heightPx: number
): [number, number] {
	const width = Math.max(widthPx, 1);
	const height = Math.max(heightPx, 1);
	renderer.setSize(width, height, false);
	return [width, height];
}

/** Starts an empty drawing scene with the supplied paper colour. */
export function createPaperScene(paper: string) {
	const scene = new Scene();
	scene.background = new Color(paper);
	return scene;
}
