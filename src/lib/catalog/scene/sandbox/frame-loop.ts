type Frame = Readonly<{ timeMs: number; transitMs: number; reduced: boolean }>;

/** Owns the scene clock and pauses it when the document is hidden or motion is reduced. */
export function createFrameLoop(isLive: () => boolean, draw: (frame: Frame) => boolean) {
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
	let pending = 0;
	let timeMs = 0;
	let transitMs = 0;
	let paused = false;
	let lastFrame: number | undefined;

	function advanceClock(now: number) {
		const elapsedMs = now - (lastFrame ?? now);
		timeMs += elapsedMs;
		if (!paused) transitMs += elapsedMs;
	}

	function animate(now: number) {
		if (!reduced.matches) advanceClock(now);
		return draw({ timeMs, transitMs, reduced: reduced.matches });
	}

	function frame(now: number) {
		pending = 0;
		if (document.hidden) return;
		if (!animate(now)) {
			lastFrame = undefined;
			return;
		}
		lastFrame = now;
		if (!reduced.matches) render();
	}

	/** Queues one frame regardless of how many painting or view inputs arrive. */
	function render() {
		if (!isLive() || pending || document.hidden) return;
		pending = requestAnimationFrame(frame);
	}

	function resetFrame() {
		lastFrame = undefined;
		render();
	}

	document.addEventListener('visibilitychange', resetFrame);
	reduced.addEventListener('change', resetFrame);

	return {
		render,
		reduced,
		get timeMs() {
			return timeMs;
		},
		get transitMs() {
			return transitMs;
		},
		get paused() {
			return paused;
		},
		/** Leaves the transit clock parked while placement continues. */
		setPaused(next: boolean) {
			if (paused === next) return;
			paused = next;
			resetFrame();
		},
		/** Cancels any scheduled frame and removes the visibility and motion listeners. */
		dispose() {
			document.removeEventListener('visibilitychange', resetFrame);
			reduced.removeEventListener('change', resetFrame);
			cancelAnimationFrame(pending);
		}
	};
}
