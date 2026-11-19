import * as T from 'three/webgpu';

/** Manual presentation clock and CPU renderer for isolated stage tests. */
export function frameClock() {
	const noop = () => {};
	const callbacks = new Map<number, FrameRequestCallback>();
	let id = 0,
		scene: T.Scene;
	Object.assign(globalThis, {
		$state: (value: unknown) => value,
		devicePixelRatio: 1,
		document: {
			documentElement: { dataset: {}, appendChild: noop },
			createElement: () => ({ style: {}, remove: noop, getContext: () => null })
		},
		getComputedStyle: () => ({ color: '#808080', getPropertyValue: () => '' }),
		matchMedia: () => ({ matches: false, addEventListener: noop }),
		addEventListener: noop,
		requestAnimationFrame: (fn: FrameRequestCallback) => {
			callbacks.set(++id, fn);
			return id;
		},
		cancelAnimationFrame: (i: number) => callbacks.delete(i)
	});
	Object.assign(T.WebGPURenderer.prototype, {
		init: async () => {},
		setSize: noop,
		setPixelRatio: noop,
		dispose: noop,
		render: (s: T.Scene) => {
			s.updateMatrixWorld();
			scene = s;
		}
	});
	return {
		canvas: () =>
			({
				dataset: {},
				style: {},
				appendChild: noop,
				addEventListener: noop,
				removeEventListener: noop
			}) as unknown as HTMLCanvasElement,
		draw: () => {
			const frame = [...callbacks.values()];
			callbacks.clear();
			for (const fn of frame) fn(0);
			return scene;
		}
	};
}
