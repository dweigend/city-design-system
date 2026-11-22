import type { Vec2 } from '../../core/geometry';
import type { Carrier } from './carrier';
import { axes } from './site';

function bisect(polygon: readonly Vec2[], [x, y]: Vec2, [u, v]: Vec2) {
	const signed = ([a, b]: Vec2) => (a - (x + u) / 2) * (u - x) + (b - (y + v) / 2) * (v - y);
	const ring: Vec2[] = [];
	for (const [i, a] of polygon.entries()) {
		const b = polygon[(i + 1) % polygon.length];
		const da = signed(a);
		const db = signed(b);
		if (da <= 0) ring.push(a);
		if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
			const t = da / (da - db);
			ring.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
		}
	}
	return ring;
}

export const voronoi: Carrier = function* (site, outline, bearing, size, random) {
	const { toLocal, toWorld } = axes(bearing);
	const local = outline.map(([x, y]) =>
		toLocal((x - site.origin[0]) / size, (y - site.origin[1]) / size)
	);
	const columns = local.map(([x]) => x);
	const rows = local.map(([, y]) => y);
	const sites = new Map<string, Vec2>();
	function seedPoint(i: number, j: number): Vec2 {
		const key = `${i},${j}`;
		const current = sites.get(key);
		if (current) return current;
		const stream = random.derive(key);
		const offset = { min: -0.22, max: 0.22 };
		const point: Vec2 = [i + stream.number(offset), j + stream.number(offset)];
		sites.set(key, point);
		return point;
	}
	for (let j = Math.floor(Math.min(...rows)); j <= Math.ceil(Math.max(...rows)); j++) {
		for (let i = Math.floor(Math.min(...columns)); i <= Math.ceil(Math.max(...columns)); i++) {
			const center = seedPoint(i, j);
			let ring: Vec2[] = [
				[i - 2, j - 2],
				[i + 2, j - 2],
				[i + 2, j + 2],
				[i - 2, j + 2]
			];
			// Fixed local competitors keep every cell independent of the crop.
			for (let v = -2; v <= 2; v++) {
				for (let u = -2; u <= 2; u++) {
					if (u || v) ring = bisect(ring, center, seedPoint(i + u, j + v));
				}
			}
			const corners = new Map(
				ring.map(([x, y]) => {
					// Snap at 0.01 micrometers per cell meter so both bisector owners share the address.
					const a = Math.round(x * 1e8);
					const b = Math.round(y * 1e8);
					const [u, v] = toWorld((a * size) / 1e8, (b * size) / 1e8);
					const id = `bisector/${a},${b}`;
					return [id, { id, xy: [site.origin[0] + u, site.origin[1] + v] as const }];
				})
			);
			yield { id: `site/${i},${j}`, corners: [...corners.values()] };
		}
	}
};
