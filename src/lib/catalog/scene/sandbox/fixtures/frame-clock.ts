import * as T from 'three/webgpu';

// The CPU fixture records the source scene of the beauty pass, before fullscreen composition.
function sourcePass(root: T.Node) {
	const pending = [root];
	const seen = new Set<T.Node>();
	for (let node = pending.pop(); node; node = pending.pop()) {
		if (node instanceof T.PassNode) return node;
		if (seen.has(node)) continue;
		seen.add(node);
		pending.push(...node.getChildren());
	}
	throw new Error('The studio pipeline has no scene pass.');
}

/** Manual presentation clock and CPU renderer for isolated stage tests. */
export function frameClock() {
	const noop = () => {};
	const callbacks = new Map<number, FrameRequestCallback>();
	let id = 0,
		scene: T.Scene,
		camera: T.Camera;
	Object.assign(globalThis, {
		$state: (value: unknown) => value,
		devicePixelRatio: 1,
		document: {
			documentElement: { dataset: {}, appendChild: noop },
			addEventListener: noop,
			removeEventListener: noop,
			createElement: () => ({ style: {}, remove: noop, getContext: () => null })
		},
		getComputedStyle: () => ({ color: '#808080', getPropertyValue: () => '' }),
		matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
		addEventListener: noop,
		requestAnimationFrame: (fn: FrameRequestCallback) => {
			callbacks.set(++id, fn);
			return id;
		},
		cancelAnimationFrame: (i: number) => callbacks.delete(i)
	});
	Object.assign(globalThis, { window: globalThis });
	const passes = new WeakMap<T.RenderPipeline, T.PassNode>();
	Object.assign(T.RenderPipeline.prototype, {
		render(this: T.RenderPipeline) {
			const pass = passes.get(this) ?? sourcePass(this.outputNode);
			passes.set(this, pass);
			this.renderer.render(pass.scene, pass.camera);
		}
	});
	Object.assign(T.WebGPURenderer.prototype, {
		init: async () => {},
		setSize: noop,
		setPixelRatio: noop,
		dispose: noop,
		render: (s: T.Scene, view: T.Camera) => {
			s.updateMatrixWorld();
			scene = s;
			camera = view;
		}
	});
	return {
		renderedCamera: () => camera,
		canvas: () =>
			({
				dataset: {},
				style: {},
				appendChild: noop,
				addEventListener: noop,
				removeEventListener: noop
			}) as unknown as HTMLCanvasElement,
		draw: (stamp = 0) => {
			const frame = [...callbacks.values()];
			callbacks.clear();
			for (const fn of frame) fn(stamp);
			return scene;
		}
	};
}
