import { position, side, type triangle } from './catchment-grid';
import { eachNeighbor } from './drainage-grid';
import type { solveDrainage } from './drainage';

/** Bounds edits at the solved lake barriers and keeps a receiver route open at each sill.
 * Only vertices where the edited bed violates a bound contribute a correction. */
export function spillBarriers(
	{ bed, basins, membership, receiver }: ReturnType<typeof solveDrainage>,
	height: (x: number, y: number) => number
) {
	const minimum = new Map<number, number>();
	const maximum = new Map<number, number>();
	for (let i = 0; i < membership.length; i++) {
		const basin = basins[membership[i]];
		if (!basin) continue;
		eachNeighbor(side, i, (neighbor) => {
			if (membership[neighbor] === membership[i]) return;
			minimum.set(neighbor, Math.max(minimum.get(neighbor) ?? -Infinity, basin.level));
		});
	}
	for (const { outlet, level } of basins) {
		minimum.set(outlet, bed[outlet]);
		for (let i = outlet; i >= 0; i = receiver[i]) {
			if ((maximum.get(i) ?? Infinity) <= level) break;
			maximum.set(i, level);
		}
	}
	const correction = new Float64Array(bed.length);
	for (const i of new Set([...minimum.keys(), ...maximum.keys()])) {
		const edited = Math.round(height(...position(i)) * 1000);
		const lower = minimum.get(i) ?? -Infinity;
		const upper = maximum.get(i) ?? Infinity;
		correction[i] = (Math.max(lower, Math.min(upper, edited)) - edited) / 1000;
	}
	return ({ a, b, c, wa, wb, wc }: ReturnType<typeof triangle>) =>
		correction[a] * wa + correction[b] * wb + correction[c] * wc;
}
