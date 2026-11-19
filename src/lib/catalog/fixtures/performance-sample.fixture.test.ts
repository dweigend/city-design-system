/** Measures synchronous work in milliseconds on the calling thread's CPU clock. */
export function cpuMilliseconds(work: () => void) {
	const start = process.threadCpuUsage();
	work();
	const { user, system } = process.threadCpuUsage(start);
	return (user + system) / 1000;
}

/** Returns the middle measurement, averaging the two middle values when the count is even. */
export function median(times: number[]) {
	const sorted = times.toSorted((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Discards warmup samples and returns the median of the measured samples. */
export function warmMedian(sample: () => number, warmup: number, repeats = 5) {
	for (let i = 0; i < warmup; i++) sample();
	return median(Array.from({ length: repeats }, sample));
}
