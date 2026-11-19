import type { HouseSlot } from './types';
import { piece, slab } from './parts';

/** Twin pressure cabins on a common shoe. The outer cabin meets the south-facing window slot. */
export function cabins({ id, position: [x, y, z], size: [w, d, h] }: HouseSlot) {
	const shoe = h * 0.12,
		r = Math.min((h - shoe) / 2, d * 0.24, w * 0.36);
	return [
		slab(id, [x, y, z], w, d, shoe, Math.min(w, d) * 0.23),
		...[-1, 1].map((side, i) => {
			const cy = y + side * (d / 2 - r),
				cz = z + shoe + r;
			return piece(id + '/cabin/' + i, {
				kind: 'capsule',
				from: [x - w / 2 + r, cy, cz],
				to: [x + w / 2 - r, cy, cz],
				radius: r
			});
		})
	];
}
