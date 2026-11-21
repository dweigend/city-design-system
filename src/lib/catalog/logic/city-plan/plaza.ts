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

type Rect = readonly [number, number, number, number];
const overlaps = (a: Rect, b: Rect) =>
	a[0] < b[1] - 1e-6 && b[0] < a[1] - 1e-6 && a[2] < b[3] - 1e-6 && b[2] < a[3] - 1e-6;
// Walk the connected parcels whose projected intervals intersect the reservation.
// Conservative corner intersections keep both paving and planting clear of adjacent stock.
function footprint(grid: TerrainGrid, start: TerrainCell, axes: Profile, rectangles: Rect[]) {
	const seen = new Set([start.id]),
		queue = [start],
		cells = [];
	for (const c of queue) {
		const u = c.corners.map(axes.along),
			v = c.corners.map(axes.out);
		const box: Rect = [Math.min(...u), Math.max(...u), Math.min(...v), Math.max(...v)];
		if (!rectangles.some((rect) => overlaps(box, rect))) continue;
		cells.push(c);
		for (const id of c.neighbors)
			if (id && !seen.has(id)) {
				seen.add(id);
				queue.push(required(grid.cellsById.get(id), 'plaza neighbour'));
			}
	}
	return cells;
}

function terraceFrame(frame: ReturnType<typeof axes>, wings: TerrainCell[]) {
	const side = [...wings].sort((a, b) => frame.out(b.center) - frame.out(a.center))[0];
	const rear = required(
		wings.find((w) => w !== side),
		'rear wing'
	);
	const sign = Math.sign(frame.along(side.center));
	const sideEdge = Math.min(...side.corners.map((q) => sign * frame.along(q)));
	const shift = sideEdge - 7;
	return {
		width: frame.width,
		front: Math.max(...rear.corners.map(frame.out)),
		along: (q: readonly number[]) => sign * frame.along(q) - shift,
		out: frame.out,
		point: (u: number, v: number) => frame.point(sign * (u + shift), v)
	};
}
/** Surveys a fourteen-metre square beyond the recessed court and reserves its planted and stepped edges. */
export function surveyPlaza(
	grid: TerrainGrid,
	court: TerrainCell,
	throat: TerrainCell,
	lots: string[],
	free: ReadonlySet<string>,
	gates: ReadonlySet<string>,
	wings: TerrainCell[] = []
) {
	const source = axes(court, throat);
	const stock = lots.map((id) => required(grid.cellsById.get(id), 'court wing'));
	const frame =
		wings.length === 2
			? terraceFrame(source, wings)
			: { ...source, front: Math.max(0, ...stock.flatMap((c) => c.corners.map(source.out))) };
	const front = frame.front;
	const far = front + 14;
	const p = frame.point;
	const w = frame.width / 2;
	const rectangles: Rect[] = [
		[-w, w, Math.min(0, front), wings.length === 2 ? front : Math.max(0, front)],
		[-10.2, 7, front, far],
		[-2, 2, far, far + 2.4]
	];
	const start = cellAtPoint(grid, ...p(0, front + 7));
	if (!start) return;
	const surveyed = footprint(grid, start, frame, rectangles);
	if (wings.length === 2 && surveyed.some((c) => lots.includes(c.id))) return;
	const cells = surveyed.filter((c) => !lots.includes(c.id));
	if (cells.some((c) => !free.has(c.id))) return;
	const gate = [4, 6, 8, 10]
		.map((n) => cellAtPoint(grid, ...p(-4, far + n)))
		.find((c) => c && gates.has(c.id) && !cells.includes(c));
	if (!gate) return;
	const polygon = [p(-7, front), p(7, front), p(7, far), p(-7, far)];
	if (polygon.some((q) => !cellAtPoint(grid, ...q))) return;

	const apron = wings.length === 2 ? [] : [p(-w, 0), p(w, 0), p(w, front), p(-w, front)];
	const bed = [p(-7, front), p(-7, far), p(-10.2, far), p(-10.2, front)];
	const steps = [p(-2, far), p(2, far), p(2, far + 2.4), p(-2, far + 2.4)];
	return { mouth: gate.id, polygon, apron, bed, steps, cells: cells.map((c) => c.id) };
}

/** Surveys a central open square against the same carrier footprint as the recessed plaza.
 * Returns its connected cells and the closest available street mouth on the perimeter. */
export function surveyCentrePlaza(
	grid: TerrainGrid,
	centre: TerrainCell,
	land: ReadonlyMap<string, TerrainCell>,
	approach: TerrainCell
) {
	const [x, y] = centre.center;
	const frame = {
		along: (p: readonly number[]) => p[0] - x,
		out: (p: readonly number[]) => p[1] - y,
		point: (u: number, v: number): Point => [u + x, v + y]
	};
	// Keep the footprint on the same network as the centre if the crop clips the survey.
	const surveyed = new Set(
		footprint(grid, centre, frame, [[-5, 5, -5, 5]])
			.filter((cell) => land.has(cell.id))
			.map(({ id }) => id)
	);
	const cells = [centre];
	const kept = new Set([centre.id]);
	const mouths = new Map<string, TerrainCell>();
	for (const cell of cells) {
		for (const id of cell.neighbors) {
			if (id === null || kept.has(id)) continue;
			const next = land.get(id);
			if (!next) continue;
			if (surveyed.has(id)) {
				kept.add(id);
				cells.push(next);
			} else mouths.set(id, next);
		}
	}
	const distance = (cell: TerrainCell) =>
		Math.hypot(cell.center[0] - approach.center[0], cell.center[1] - approach.center[1]);
	const mouth = [...mouths.values()].sort(
		(a, b) => distance(a) - distance(b) || a.index - b.index
	)[0];
	return mouth ? { cells: kept, mouth } : undefined;
}
