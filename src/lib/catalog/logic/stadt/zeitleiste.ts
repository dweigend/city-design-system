/**
 * Deterministic timeline for explainer loops. An image is a pure function of time:
 * same time, same seed, same image. No clock, no state, no randomness without a seed.
 * Time in seconds (suffix S), progress dimensionless 0–1.
 */

export type Phase = { id: string; durationS: number };

export type PhaseAt = {
	/** Index of the running phase. */
	index: number;
	/** Progress within the phase, 0–1. */
	local: number;
	/** Time within one run, 0 ≤ timeS < totalS. */
	timeS: number;
};

export const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x);

/** Smooth transition (smoothstep): start and end without a jolt. */
export const smooth = (x: number) => {
	const c = clamp01(x);
	return c * c * (3 - 2 * c);
};

export const mix = (a: number, b: number, f: number) => a + (b - a) * f;

/** Progress of x in the window a–b, smoothed. */
export const window01 = (x: number, a: number, b: number) =>
	b <= a ? (x >= b ? 1 : 0) : smooth((x - a) / (b - a));

export const totalDuration = (phases: readonly Phase[]) =>
	phases.reduce((sum, p) => sum + p.durationS, 0);

/** Start of a phase in seconds from the loop start. */
export function phaseStart(phases: readonly Phase[], index: number): number {
	let t = 0;
	for (let i = 0; i < index && i < phases.length; i++) t += phases[i].durationS;
	return t;
}

/** Maps time onto one run; negative times run backward into the loop. */
export function loopTime(phases: readonly Phase[], timeS: number): number {
	const total = totalDuration(phases);
	if (total <= 0) return 0;
	return ((timeS % total) + total) % total;
}

export function phaseAt(phases: readonly Phase[], timeS: number): PhaseAt {
	const t = loopTime(phases, timeS);
	let start = 0;
	for (let i = 0; i < phases.length; i++) {
		const end = start + phases[i].durationS;
		if (t < end || i === phases.length - 1)
			return { index: i, local: clamp01((t - start) / phases[i].durationS), timeS: t };
		start = end;
	}
	return { index: 0, local: 0, timeS: t };
}

/**
 * Progress of a named phase in the running run: 0 before, 0–1 during, 1 after.
 * This allows states that build up over several phases.
 */
export function phaseProgress(phases: readonly Phase[], timeS: number, id: string): number {
	const index = phases.findIndex((p) => p.id === id);
	if (index < 0) throw new Error(`Unknown phase: ${id}`);
	const t = loopTime(phases, timeS);
	const start = phaseStart(phases, index);
	return clamp01((t - start) / phases[index].durationS);
}

/** Recurring motion: position 0–1 of a particle with an offset within a period. */
export const cycle = (timeS: number, periodS: number, offset = 0) =>
	(((timeS / periodS + offset) % 1) + 1) % 1;

/**
 * Veil over the seam of a loop, 0 = clear image, 1 = fully covered. In the last
 * `blendeS` seconds of a run it closes, in the first `blendeS` of the next it opens
 * again. That way the image does not jump hard back to the start at the end. The very first run
 * (time below one loop duration) starts without a veil.
 */
export function loopSchleier(phases: readonly Phase[], timeS: number, blendeS = 0.6): number {
	const total = totalDuration(phases);
	if (total <= 0 || blendeS <= 0 || timeS < 0) return 0;
	const t = loopTime(phases, timeS);
	const aus = timeS >= total ? 1 - smooth(t / blendeS) : 0;
	const ein = smooth((t - (total - blendeS)) / blendeS);
	return Math.max(aus, ein);
}
