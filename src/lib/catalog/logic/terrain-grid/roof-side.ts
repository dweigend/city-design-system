import type { QuadCell } from '../quad-grid';
import { hash } from '../hash-random';

// The ridge channel in P1's historic roof builder.
const RIDGE_CHANNEL = 17;

/** Orient the pencil bay along the longest footprint side or across it, as in P1. */
export function roofSide(corners: QuadCell['corners'], seed: number, index: number) {
	const lengths = corners.map(([x, y], i) =>
		Math.hypot(corners[(i + 1) % 4][0] - x, corners[(i + 1) % 4][1] - y)
	);
	const longest = lengths.indexOf(Math.max(...lengths));
	return (longest + Number(hash(seed, index, RIDGE_CHANNEL) < 0.5)) % 4;
}
