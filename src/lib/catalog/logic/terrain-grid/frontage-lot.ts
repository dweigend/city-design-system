import type { Vec3 } from '../parametrik/types';
import type { QuadCell } from '../quad-grid';
import { kern } from '../parametrik/raster/universal';

/** Reserve a passage inside the terrain cell. A shallow parcel becomes public ground. */
export function behindPassage(
	corners: QuadCell['corners'],
	mask: number,
	width: number,
	minArea: number
) {
	const side = mask & 1 ? 0 : 2;
	const [a, b, c, d] = Array.from({ length: 4 }, (_, i) => corners[(i + side) % 4]);
	const dx = b[0] - a[0],
		dy = b[1] - a[1],
		length = Math.hypot(dx, dy);
	const inset = (front: Vec3, back: Vec3): Vec3 | undefined => {
		const depth = (dx * (back[1] - front[1]) - dy * (back[0] - front[0])) / length;
		if (depth <= width) return;
		const t = width / depth;
		return [
			front[0] + t * (back[0] - front[0]),
			front[1] + t * (back[1] - front[1]),
			front[2] + t * (back[2] - front[2])
		];
	};
	const left = inset(a, d),
		right = inset(b, c);
	if (!left || !right) return;
	const lot = side === 0 ? ([left, right, c, d] as const) : ([c, d, left, right] as const);
	const quality = kern.quadQuality(lot.map(([x, y]) => [x, y]));
	return kern.acceptable(quality, { ...kern.defaultLimits, minArea }) ? lot : undefined;
}
