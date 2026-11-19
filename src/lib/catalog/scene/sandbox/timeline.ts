/** Visible playback time in seconds. Explicit seeks also drive frozen study plates. */
export function createTimeline(canvas: HTMLCanvasElement, invalidate: () => void) {
	const motion = matchMedia('(prefers-reduced-motion: reduce)');
	let visible = typeof IntersectionObserver === 'undefined';
	let paused = false;
	let fixed: number | undefined;
	let seconds = 0;
	let previous: number | undefined;
	let transitHold: number | undefined;
	let transitOffset = 0;
	const atRest = () => paused || motion.matches || fixed !== undefined;
	const playing = () => visible && !document.hidden && !atRest();
	function restart() {
		previous = undefined;
		invalidate();
	}
	const observer =
		typeof IntersectionObserver === 'undefined'
			? undefined
			: new IntersectionObserver(([entry]) => {
					visible = entry.isIntersecting;
					restart();
				});
	observer?.observe(canvas);
	document.addEventListener('visibilitychange', restart);
	motion.addEventListener('change', restart);
	return {
		playing,
		get seeking() {
			return fixed !== undefined;
		},
		get transitSeconds() {
			return fixed ?? (transitHold ?? seconds) - transitOffset;
		},
		/** Pause affects live vehicle playback. An absolute seek always samples the requested pose. */
		pauseTransit(value: boolean) {
			if (value === (transitHold !== undefined)) return;
			if (value) transitHold = seconds;
			else {
				transitOffset += seconds - (transitHold ?? seconds);
				transitHold = undefined;
			}
			invalidate();
		},
		pause(value: boolean) {
			paused = value;
			restart();
		},
		sample(stamp: number) {
			const next = Math.max(stamp, previous ?? stamp);
			if (playing() && previous !== undefined) seconds += (next - previous) / 1000;
			previous = next;
			return fixed ?? seconds;
		},
		seek(value: number | undefined) {
			if (value !== undefined && !Number.isFinite(value)) throw new RangeError('Invalid timeline');
			if (value !== undefined) {
				seconds = value;
				transitOffset = 0;
				if (transitHold !== undefined) transitHold = value;
			}
			fixed = value;
			restart();
		},
		dispose() {
			observer?.disconnect();
			document.removeEventListener('visibilitychange', restart);
			motion.removeEventListener('change', restart);
		}
	};
}
