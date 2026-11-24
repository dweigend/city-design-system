import { convexHull, type Vec3 } from '../../core/geometry';
import { columnRoof, type CityColumn } from '../../domain/city-volume';

type Extent = readonly [number, number, number, number];

function overlaps([ax, ay, bx, by]: Extent, [cx, cy, dx, dy]: Extent, clearance: number) {
	return (
		ax <= dx + clearance && bx >= cx - clearance && ay <= dy + clearance && by >= cy - clearance
	);
}

function envelope(column: CityColumn) {
	const xs = column.corners.map(({ position }) => position[0]);
	const ys = column.corners.map(({ position }) => position[1]);
	return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const;
}

export function walkwayClearance(
	columns: readonly CityColumn[],
	datumZ: number,
	z: number,
	verticalM: number,
	sideM: number
) {
	const taller = columns
		.filter((column) => columnRoof(column, datumZ) + verticalM > z)
		.map((column) => ({
			bounds: envelope(column),
			hull: convexHull(column.corners.map(({ position: [x, y] }) => [x, y]))
		}));

	return (a: Vec3, b: Vec3) => {
		const bounds = [
			Math.min(a[0], b[0]),
			Math.min(a[1], b[1]),
			Math.max(a[0], b[0]),
			Math.max(a[1], b[1])
		] as const;
		return !taller.some(
			(column) => overlaps(bounds, column.bounds, sideM) && intersects(a, b, column.hull, sideM)
		);
	};
}

function intersects(a: Vec3, b: Vec3, hull: ReturnType<typeof convexHull>, sideM: number) {
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
		if (first < 0 && last < 0) return false;
		if (first < 0) enter = Math.max(enter, first / (first - last));
		else if (last < 0) leave = Math.min(leave, first / (first - last));
		if (enter > leave) return false;
	}
	return true;
}
