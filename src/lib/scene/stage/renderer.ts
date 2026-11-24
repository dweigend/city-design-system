import { WebGPURenderer } from 'three/webgpu';
import { sortTranslucent } from './batch';

type DemandRenderer = WebGPURenderer & {
	_getFallback: null;
	_animation: { stop(): void };
};

function adapterDetails(info: GPUAdapterInfo) {
	const adapterName =
		info.description ||
		[info.vendor, info.architecture, info.device].filter(Boolean).join(' ') ||
		'Unknown WebGPU adapter';
	const hardware =
		!info.isFallbackAdapter &&
		!!info.vendor &&
		!/swiftshader|llvmpipe|lavapipe|software/i.test(adapterName);
	return { adapterName, hardware };
}

export async function openRenderer(canvas: HTMLCanvasElement) {
	let release: (() => void) | undefined;
	try {
		const adapter = await navigator.gpu?.requestAdapter();
		if (!adapter) throw new Error('No WebGPU adapter is available');
		const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
		if (!context) throw new Error('The canvas cannot open a WebGPU context');
		const core = 'core-features-and-limits';
		const device = await adapter.requestDevice({
			requiredFeatures: adapter.features.has(core) ? [core] : []
		});
		const closeDevice = () => {
			context.unconfigure();
			device.destroy();
		};
		release = closeDevice;
		const renderer = new WebGPURenderer({
			canvas,
			context,
			device,
			antialias: true
		}) as DemandRenderer;
		// r187 installs a WebGL fallback in the constructor. Keep backend init strict.
		renderer._getFallback = null;
		renderer.setTransparentSort(sortTranslucent);
		await renderer.init();
		return {
			renderer,
			...adapterDetails(adapter.info),
			stop() {
				// r187 starts its internal tick in render() even without an animation callback.
				renderer._animation.stop();
			},
			async delete() {
				try {
					await renderer.dispose();
				} finally {
					closeDevice();
				}
			}
		};
	} catch (cause) {
		release?.();
		throw new Error(`WebGPU stage initialisation failed: ${String(cause)}`, { cause });
	}
}
