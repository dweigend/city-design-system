import { cellAtPoint, type TerrainCell, type TerrainGrid } from '../terrain-grid';
import { required } from '../required';

type Point = [number, number];
type Profile = {
	along: (p: readonly number[]) => number;
	out: (p: readonly number[]) => number;
	point: (u: number, v: number) => Point;
};

function axes(court: TerrainCell, mouth: TerrainCell) {
	const [a, b] = court.corners.filter((p) =>
		mouth.corners.some((q) => p[0] === q[0] && p[1] === q[1])
	);
	const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
	const ux = (b[0] - a[0]) / width,
		uy = (b[1] - a[1]) / width;
	const x = (a[0] + b[0]) / 2,
		y = (a[1] + b[1]) / 2;
	const sign = Math.sign((mouth.center[0] - x) * uy - (mouth.center[1] - y) * ux);
	const nx = sign * uy,
		ny = -sign * ux;
	const point = (u: number, v: number): Point => [x + u * ux + v * nx, y + u * uy + v * ny];
	return {
		width,
		point,
		along: (p: readonly number[]) => (p[0] - x) * ux + (p[1] - y) * uy,
		out: (p: readonly number[]) => (p[0] - x) * nx + (p[1] - y) * ny
	};
}

// Walk the connected parcels whose projected intervals intersect the reservation.
// Conservative corner intersections keep both paving and planting clear of adjacent stock.
function footprint(grid: TerrainGrid, start: TerrainCell, axes: Profile, end: number) {
	const seen = new Set([start.id]),
		queue = [start],
		cells = [];
	for (const c of queue) {
		const u = c.corners.map(axes.along),
			v = c.corners.map(axes.out);
		if (
			Math.min(...u) >= 10.3 ||
			Math.max(...u) <= -10.3 ||
			Math.min(...v) >= end ||
			Math.max(...v) <= 0.001
		)
			continue;
		cells.push(c);
		for (const id of c.neighbors)
			if (id && !seen.has(id)) {
				seen.add(id);
				queue.push(required(grid.cellsById.get(id), 'plaza neighbour'));
			}
	}
	return cells;
}

/** Surveys a fourteen-metre square beyond the recessed court and reserves its planted and stepped edges. */
export function surveyPlaza(
	grid: TerrainGrid,
	court: TerrainCell,
	throat: TerrainCell,
	lots: string[],
	free: ReadonlySet<string>
) {
	const frame = axes(court, throat);
	const front = Math.max(
		0,
		...lots.flatMap((id) => required(grid.cellsById.get(id), 'wing').corners.map(frame.out))
	);
	const far = front + 14;
	const p = frame.point;
	const cells = footprint(grid, throat, frame, far + 3.2).filter((c) => !lots.includes(c.id));
	if (cells.some((c) => !free.has(c.id))) return;
	const gate = cellAtPoint(grid, ...p(0, far + 8));
	if (!gate || !free.has(gate.id) || cells.some((c) => c === gate)) return;
	const polygon = [p(-7, front), p(7, front), p(7, far), p(-7, far)];
	if (polygon.some((q) => !cellAtPoint(grid, ...q))) return;
	const w = frame.width / 2;
	const apron = [p(-w, 0), p(w, 0), p(w, front), p(-w, front)];
	return { mouth: gate.id, polygon, apron, cells: cells.map((c) => c.id) };
}
