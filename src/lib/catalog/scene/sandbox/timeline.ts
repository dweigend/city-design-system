/** Visible playback time in seconds. Explicit seeks also drive frozen study plates. */
export function createTimeline(canvas: HTMLCanvasElement, invalidate: () => void) {
	const motion = matchMedia('(prefers-reduced-motion: reduce)');
	let visible = false;
	let fixed: number | undefined;
	let seconds = 0;
	let previous: number | undefined;
	const playing = () => visible && !document.hidden && !motion.matches && fixed === undefined;
	function restart() {
		previous = undefined;
		invalidate();
	}
	const observer = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		restart();
	});
	observer.observe(canvas);
	document.addEventListener('visibilitychange', restart);
	motion.addEventListener('change', restart);
	return {
		playing,
		sample(stamp: number) {
			if (playing() && previous !== undefined) seconds += (stamp - previous) / 1000;
			previous = stamp;
			return fixed ?? seconds;
		},
		seek(value: number | undefined) {
			if (value !== undefined && !Number.isFinite(value)) throw new RangeError('Invalid timeline');
			seconds = value ?? seconds;
			fixed = value;
			restart();
		},
		dispose() {
			observer.disconnect();
			document.removeEventListener('visibilitychange', restart);
			motion.removeEventListener('change', restart);
		}
	};
}
