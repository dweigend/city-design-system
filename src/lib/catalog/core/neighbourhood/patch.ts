/** A sparse, iterable tick delta. Its JSON form is directly accepted by the Map constructor. */
export function tickPatch<T>() {
	const patch = new Map<string, T>();
	return Object.assign(patch, { toJSON: () => Array.from(patch) });
}
