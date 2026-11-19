/** Appends the outward triangles between two matching, counterclockwise rings in an indexed mesh. */
export function joinRings(out: number[], start: number, next: number, count: number) {
	for (let j = 0; j < count; j++) {
		const k = (j + 1) % count;
		out.push(start + j, start + k, next + j, start + k, next + k, next + j);
	}
}
