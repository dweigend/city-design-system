import type { Vec2 } from '../../core/geometry';
import type { RiverCourse } from '../../domain/valley';

export function riverFrame({ xy, bearing }: RiverCourse) {
	const u = Math.cos(bearing);
	const v = Math.sin(bearing);
	const along = (x: number, y: number) => x * u + y * v;
	const stations = Array.from({ length: xy.length / 2 }, (_, i) => along(xy[2 * i], xy[2 * i + 1]));

	function at(station: number) {
		let low = 0;
		let high = stations.length - 1;
		while (low + 1 < high) {
			const mid = (low + high) >>> 1;
			if (station < stations[mid]) high = mid;
			else low = mid;
		}
		const t = (station - stations[low]) / (stations[high] - stations[low]);
		const x = xy[2 * low];
		const y = xy[2 * low + 1];
		return [x + t * (xy[2 * high] - x), y + t * (xy[2 * high + 1] - y)] as const;
	}
	return {
		at,
		bearing,
		bank([x, y]: Vec2) {
			const [rx, ry] = at(along(x, y));
			return Math.sign((y - ry) * u - (x - rx) * v);
		}
	};
}
