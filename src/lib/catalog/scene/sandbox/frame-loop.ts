type Frame = Readonly<{ stamp: number; reduced: boolean }>;

/** Coalesces invalidations and supplies one animation timestamp per visible frame. */
export function createFrameLoop(isLive: () => boolean, draw: (frame: Frame) => boolean) {
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
	let pending = 0;
	function frame(now: number) {
		pending = 0;
		if (document.hidden) return;
		if (draw({ stamp: now, reduced: reduced.matches }) && !reduced.matches) render();
	}

	/** Queues one frame regardless of how many painting or view inputs arrive. */
	function render() {
		if (!isLive() || pending || document.hidden) return;
		pending = requestAnimationFrame(frame);
	}

	return {
		render,
		reduced,
		/** Cancels any scheduled frame and removes the visibility and motion listeners. */
		dispose() {
			cancelAnimationFrame(pending);
		}
	};
}
