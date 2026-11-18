import type { RoofCell } from './footprints';
type Ring = RoofCell['polygon'];
type Survey = { start: number; direction: number };

// Each corner and its outgoing wall describe a traversal without a world-space axis.
function signature(ring: Ring, { start, direction }: Survey) {
	return ring.flatMap((_, i) => {
		const n = ring.length,
			j = (start + i * direction + n) % n;
		const a = ring[(j - direction + n) % n],
			b = ring[j],
			c = ring[(j + direction + n) % n];
		const ux = a[0] - b[0],
			uy = a[1] - b[1],
			vx = c[0] - b[0],
			vy = c[1] - b[1];
		const edge = Math.hypot(vx, vy);
		return [(ux * vx + uy * vy) / (Math.hypot(ux, uy) * edge), edge];
	});
}
function compare(a: number[], b: number[]) {
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
	return 0;
}
/** Returns a preferred survey starting at the sharpest corner. Subsequent angles and
 * wall lengths break ties. Exact symmetries retain the normalized survey order. */
export function preferredWallRing(ring: Ring) {
	let best = { start: 0, direction: 1 },
		key = signature(ring, best);
	for (const direction of [1, -1])
		for (let start = 0; start < ring.length; start++) {
			const candidate = { start, direction },
				next = signature(ring, candidate);
			if (compare(next, key) < 0) {
				best = candidate;
				key = next;
			}
		}
	return ring.map((_, i) => ring[(best.start + i * best.direction + ring.length) % ring.length]);
}
