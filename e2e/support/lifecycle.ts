import type { Page } from '@playwright/test';

/**
 * Lifecycle probes: counts WebGL contexts (weakly, so the probe never keeps one alive) and
 * animation-frame requests. A demo that keeps rendering after unmount shows up as frames
 * requested on a page without animation.
 */
type Probe = {
	contexts: WeakRef<WebGLRenderingContext>[];
	canvases: WeakRef<HTMLCanvasElement>[];
	frames: number;
};

/** Installs the probe before any page script runs. */
export async function installLifecycleProbe(page: Page) {
	await page.addInitScript(() => {
		const probe: Probe = { contexts: [], canvases: [], frames: 0 };
		(window as unknown as { __lifecycle: Probe }).__lifecycle = probe;
		const getContext = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (
			this: HTMLCanvasElement,
			...args: unknown[]
		) {
			const context = (getContext as (...a: unknown[]) => RenderingContext | null).apply(
				this,
				args
			);
			const known = probe.contexts.some((ref) => ref.deref() === context);
			if (context && /webgl/.test(String(args[0])) && !known) {
				probe.contexts.push(new WeakRef(context as WebGLRenderingContext));
				probe.canvases.push(new WeakRef(this));
			}
			return context;
		} as typeof getContext;
		const request = window.requestAnimationFrame.bind(window);
		window.requestAnimationFrame = (callback) => {
			probe.frames++;
			return request(callback);
		};
	});
}

export type LifecycleStats = {
	/** Canvas elements in the document. */
	canvases: number;
	/** WebGL contexts created since load. */
	created: number;
	/** Contexts still alive although their canvas left the document (released at GC). */
	detachedAlive: number;
};

/** Reads the current counts. */
export function lifecycleStats(page: Page): Promise<LifecycleStats> {
	return page.evaluate(() => {
		const probe = (window as unknown as { __lifecycle: Probe }).__lifecycle;
		const detachedAlive = probe.contexts.filter((ref, i) => {
			const context = ref.deref();
			return context && !context.isContextLost() && !probe.canvases[i].deref()?.isConnected;
		}).length;
		return {
			canvases: document.querySelectorAll('canvas').length,
			created: probe.contexts.length,
			detachedAlive
		};
	});
}

/** Animation frames requested during `ms` milliseconds. */
export async function framesDuring(page: Page, ms: number): Promise<number> {
	const read = () =>
		page.evaluate(() => (window as unknown as { __lifecycle: Probe }).__lifecycle.frames);
	const before = await read();
	await page.waitForTimeout(ms);
	return (await read()) - before;
}
