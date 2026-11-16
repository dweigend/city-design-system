/** Scale geometry: ticks, labels, percent position. Pure logic. */
export type Tick = { value: number; major: boolean };
export type Marker = { value: number; label: string; color: string };
export type Segment = { from: number; index: string; label: string };

export const pct = (v: number, min: number, max: number) => ((v - min) / (max - min)) * 100;

export function ticks(min: number, max: number, minor: number, major: number): Tick[] {
	const out: Tick[] = [];
	for (let v = min; v <= max + 1e-9; v += minor)
		out.push({ value: v, major: Math.abs(((v - min) / major) % 1) < 1e-9 });
	return out;
}

/** Where numbers go: at major ticks, at segment boundaries or only at the ends. */
export function labelValues(
	min: number,
	max: number,
	major: number | undefined,
	segments: Segment[]
): number[] {
	if (segments.length) return [...segments.map((s) => s.from), max];
	if (major) return ticks(min, max, major, major).map((t) => t.value);
	return [min, max];
}
