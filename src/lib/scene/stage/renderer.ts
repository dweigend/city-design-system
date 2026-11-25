import { WebGPURenderer } from 'three/webgpu';
import { sortTranslucent } from './batch';

type RendererLifecycle = Pick<WebGPURenderer, 'dispose'> & {
	init(): Promise<unknown>;
	_getFallback?: unknown;
	_animation?: unknown;
};

/** Adapts three.js r187 to strict WebGPU and demand rendering. r187 supplies a WebGL
 * fallback and starts an internal tick on render. Future versions can omit either hook.
 * Keep these private names here and check the lifecycle contract when upgrading three.js. */
export async function openDemandRenderer(renderer: RendererLifecycle, closeDevice: () => void) {
	try {
		if (typeof renderer._getFallback === 'function') renderer._getFallback = null;
		await renderer.init();
	} catch (error) {
		closeDevice();
		throw error;
	}
	return {
		stop() {
			const animation = renderer._animation as { stop?: () => void } | null | undefined;
			if (typeof animation?.stop === 'function') animation.stop();
		},
		async delete() {
			try {
				await renderer.dispose();
			} finally {
				closeDevice();
			}
		}
	};
}

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
			try {
				context.unconfigure();
			} finally {
				device.destroy();
			}
		};
		let renderer: WebGPURenderer;
		try {
			renderer = new WebGPURenderer({ canvas, context, device, antialias: true });
			renderer.setTransparentSort(sortTranslucent);
		} catch (error) {
			closeDevice();
			throw error;
		}
		// r187's type declarations do not expose the private hooks.
		const demand = await openDemandRenderer(renderer, closeDevice);
		return {
			renderer,
			...adapterDetails(adapter.info),
			...demand
		};
	} catch (cause) {
		throw new Error(`WebGPU stage initialisation failed: ${String(cause)}`, { cause });
	}
}
