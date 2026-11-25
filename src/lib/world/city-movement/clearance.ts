import { convexHull, type Vec2, type Vec3 } from '../../core/geometry';
import { createPolygonIndex } from '../../core/polygon-index';
import { columnRoof, type CityColumn } from '../../domain/city-volume';

export function walkwayClearance(
	columns: readonly CityColumn[],
	datumZ: number,
	levelHeightM: number,
	z: number,
	verticalM: number,
	sideM: number,
	allowTouch = false
) {
	return columnClearance(columns, datumZ, levelHeightM)(z, verticalM, sideM, allowTouch);
}

export function columnClearance(
	columns: readonly CityColumn[],
	datumZ: number,
	levelHeightM: number
) {
	function index() {
		return createPolygonIndex(
			columns.map((column, i) => {
				const outline = column.corners.map(({ position: [x, y] }): Vec2 => [x, y]);
				return {
					id: String(i),
					outline,
					roofM: columnRoof(column, datumZ, levelHeightM),
					hull: convexHull(outline)
				};
			})
		);
	}
	let solids: ReturnType<typeof index> | undefined;
	return (z: number, verticalM: number, sideM: number, allowTouch = false) =>
		(a: Vec3, b: Vec3) => {
			solids ??= index();
			return !solids.someCandidate(
				[
					[a[0], a[1]],
					[b[0], b[1]]
				],
				(column) =>
					column.roofM + verticalM > z && intersects(a, b, column.hull, sideM, allowTouch),
				sideM
			);
		};
}

function intersects(
	a: Vec3,
	b: Vec3,
	hull: ReturnType<typeof convexHull>,
	sideM: number,
	allowTouch: boolean
) {
	let enter = 0;
	let leave = 1;
	for (let i = 0; i < hull.length; i++) {
		const [x, y] = hull[i];
		const [u, v] = hull[(i + 1) % hull.length];
		const dx = u - x;
		const dy = v - y;
		const expand = sideM * Math.hypot(dx, dy);
		const first = dx * (a[1] - y) - dy * (a[0] - x) + expand;
		const last = dx * (b[1] - y) - dy * (b[0] - x) + expand;
		if (allowTouch ? first <= 0 && last <= 0 : first < 0 && last < 0) return false;
		if (first < 0) enter = Math.max(enter, first / (first - last));
		else if (last < 0) leave = Math.min(leave, first / (first - last));
		if (allowTouch ? enter >= leave : enter > leave) return false;
	}
	return true;
}
