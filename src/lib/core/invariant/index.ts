/** Returns the original non-nullish value unchanged. Throws Error with the invariant name if absent. */
export function required<T>(value: T, name: string): NonNullable<T> {
	if (value == null) throw new Error(`Broken invariant: ${name}`);
	return value;
}
