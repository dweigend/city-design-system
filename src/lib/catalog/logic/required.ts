/** Read a value guaranteed by a caller's invariant; report a broken invariant by name. */
export function required<T>(value: T | null | undefined, invariant: string): T {
	if (value === null || value === undefined) throw new Error(`Missing invariant: ${invariant}`);
	return value;
}
