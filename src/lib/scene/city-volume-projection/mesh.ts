export function mesh() {
	return { kind: 'mesh' as const, positions: [] as number[], indices: [] as number[] };
}
