import type { Vec3 } from '../parametrik/types';
import type { QuadCell } from '../quad-grid';
import { kern } from '../parametrik/raster/universal';

/** Signed perpendicular clearance from the reserved frontage, in world meters. */
export function passageClearance(corners: QuadCell['corners'], mask: number, p: Vec3) {
	const side = mask & 1 ? 0 : 2,
		a = corners[side],
		b = corners[(side + 1) % 4],
		dx = b[0] - a[0],
		dy = b[1] - a[1];
	return (dx * (p[1] - a[1]) - dy * (p[0] - a[0])) / Math.hypot(dx, dy);
}
/** Reserve a passage inside the terrain cell. A shallow parcel becomes public ground. */
export function behindPassage(
	corners: QuadCell['corners'],
	mask: number,
	width: number,
	minArea: number
) {
	const side = mask & 1 ? 0 : 2;
	const [a, b, c, d] = Array.from({ length: 4 }, (_, i) => corners[(i + side) % 4]);
	const inset = (front: Vec3, back: Vec3): Vec3 | undefined => {
		const depth = passageClearance(corners, mask, back);
		if (depth <= width) return;
		const sample = (t: number): Vec3 => [
			front[0] + t * (back[0] - front[0]),
			front[1] + t * (back[1] - front[1]),
			front[2] + t * (back[2] - front[2])
		];
		let low = width / depth,
			high = 1;
		const direct = sample(low);
		if (passageClearance(corners, mask, direct) >= width) return direct;
		// Choose the first representable point on the permitted side of the cut.
		for (let mid = (low + high) / 2; mid > low && mid < high; mid = (low + high) / 2) {
			if (passageClearance(corners, mask, sample(mid)) >= width) high = mid;
			else low = mid;
		}
		const inside = sample(high);
		return passageClearance(corners, mask, inside) >= width ? inside : back;
	};
	const left = inset(a, d),
		right = inset(b, c);
	if (!left || !right) return;
	const lot = side === 0 ? ([left, right, c, d] as const) : ([c, d, left, right] as const);
	const quality = kern.quadQuality(lot.map(([x, y]) => [x, y]));
	return kern.acceptable(quality, { ...kern.defaultLimits, minArea }) ? lot : undefined;
}
