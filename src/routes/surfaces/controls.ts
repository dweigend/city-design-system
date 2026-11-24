/** The family shown horizontally on the sample board and around the body. */
export const groundFamily = 'paving';

/** Reads a shared URL's slider value, clamped to the same band as the on-page control. */
export function readControl(value: string | null, [min, max]: readonly [number, number, number]) {
	const number = value === null ? 1 : Number(value);
	return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : 1;
}
