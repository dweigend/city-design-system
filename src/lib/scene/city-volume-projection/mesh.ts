export function mesh() {
	return { kind: 'mesh' as const, positions: [] as number[], indices: [] as number[] };
}

/** Whether a horizontal ring runs clockwise seen from above, so its faces must be reversed to
 * face up and out, as the stage's roof and wall shading expects. */
export function clockwise(ring: readonly (readonly number[])[]) {
	let area = 0;
	for (const [i, [ax, ay]] of ring.entries()) {
		const [bx, by] = ring[(i + 1) % ring.length];
		area += ax * by - bx * ay;
	}
	return area < 0;
}
