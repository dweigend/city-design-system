export function mesh() {
	return { kind: 'mesh' as const, positions: [] as number[], indices: [] as number[] };
}

export function edgeKey(a: string | number, b: string | number) {
	return a < b ? `${a}\n${b}` : `${b}\n${a}`;
}

export function segments(
	positions: readonly number[],
	edges: ReadonlyMap<string, readonly [number, number]>
) {
	return Object.freeze(
		Array.from(edges.values()).flatMap(([a, b]) => [
			...positions.slice(3 * a, 3 * a + 3),
			...positions.slice(3 * b, 3 * b + 3)
		])
	);
}
