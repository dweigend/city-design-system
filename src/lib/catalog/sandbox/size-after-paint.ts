import type { sizeFrameSites } from '../logic/sandbox';

/** Leaves a paint opportunity for the published chord/column preview before dispatching sizing. */
export function sizeAfterPaint(sites: Parameters<typeof sizeFrameSites>[0]) {
	return new Promise<ReturnType<typeof sizeFrameSites>>((resolve, reject) => {
		requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				try {
					const worker = new Worker(new URL('./frame-sizing.worker.ts', import.meta.url), {
						type: 'module'
					});
					worker.onmessage = ({ data }) => {
						worker.terminate();
						resolve(data);
					};
					worker.onerror = (error) => {
						worker.terminate();
						reject(new Error(error.message));
					};
					worker.postMessage(sites);
				} catch (error) {
					reject(error instanceof Error ? error : new Error(String(error)));
				}
			})
		);
	});
}
