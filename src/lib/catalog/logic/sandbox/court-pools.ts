import { courtReservations } from './court-reservations';
import { floodPool } from './pool-flood';
import { chartScalar, sampleSlot } from './terrain-samples';
import { bankHeight, chartPoint, type TerrainCell, type TerrainGrid } from '../terrain-grid';
import { required } from '../required';
import type { CityPlan } from '../city-plan';
import type { Vec3 } from '../parametrik/types';

type Centre = CityPlan['centres'][number];
type Point = readonly number[];
const smooth = (v: number) => {
	const s = Math.max(0, Math.min(1, v));
	return s * s * (3 - 2 * s);
};

// One broad inlet follows the axis between the ring walk and its court mouths.
function inlet(grid: TerrainGrid, centre: Centre) {
	const parcel = (id: string) => required(grid.cellsById.get(id), 'pool survey');
	const [x, y] = parcel(centre.cellId).center;
	const mouths = centre.ensembles.map((e) => parcel(e.mouth).center);
	const dx = mouths.reduce((sum, p) => sum + p[0] - x, 0) / mouths.length;
	const dy = mouths.reduce((sum, p) => sum + p[1] - y, 0) / mouths.length;
	const run = Math.hypot(dx, dy);
	const ux = run ? dx / run : 1,
		uy = run ? dy / run : 0;
	const length = Math.min(38, 22 + run * 0.65);
	const width = Math.min(17, 12 + run * 0.24);
	const cx = x + dx * 0.47,
		cy = y + dy * 0.47;
	const radius = ([px, py]: Point) => {
		const along = ((px - cx) * ux + (py - cy) * uy) / length;
		const across = (-(px - cx) * uy + (py - cy) * ux) / width;
		return Math.hypot(along, across + 0.3 * Math.cos(along * 2.1));
	};
	return { radius, cx, cy, length };
}

function basin(grid: TerrainGrid, centre: Centre, plots: Set<string>, finished: TerrainCell[]) {
	const shape = inlet(grid, centre);
	const cells = grid.cells.filter(
		(c) =>
			Math.hypot(c.center[0] - shape.cx, c.center[1] - shape.cy) < shape.length * 1.6 + 8 &&
			(c.corners.some((p) => shape.radius(p) < 1.45) || shape.radius(c.center) < 1.45)
	);
	// A common horizontal waterline below the lowest shore leaves all existing
	// landings dry. Only the interior slopes down into the bed.
	const level =
		Math.min(
			...cells.map((c) =>
				Math.min(...(finished[c.index].bank?.points ?? finished[c.index].corners).map((p) => p[2]))
			)
		) - 0.22;
	const protectedVertices = new Set(
		cells.filter((c) => plots.has(c.id)).flatMap((c) => c.vertexIds)
	);
	return { cells, radius: shape.radius, level, protectedVertices };
}

type Basin = ReturnType<typeof basin>;

const divisions = 12;
const stride = divisions + 1;
const bedIndices = Array.from({ length: divisions * divisions }, (_, k) => {
	const a = Math.floor(k / divisions) * stride + (k % divisions),
		d = a + stride;
	return [a, a + 1, d + 1, a, d + 1, d];
}).flat();

function bedSurvey(cell: TerrainCell, pool: Basin, weights: number[], u: number, v: number) {
	const p = chartPoint(cell.corners, u, v),
		source = cell.bank;
	const z = source ? bankHeight(cell, p[0], p[1]) : p[2];
	const r = pool.radius(p);
	// One section runs around the whole inlet. A shallow underwater ledge rises
	// into a broad lawn shelf, then a short outer bank rejoins the hillside.
	const margin = smooth((1.44 - r) / 0.19) * chartScalar(weights, u, v);
	const littoral = smooth((r - 0.76) / 0.24);
	const terrace = pool.level - 1.15 + 1.52 * littoral + 0.12 * smooth((r - 1) / 0.25);
	const height = z + Math.min(0, terrace - z) * margin;
	const turf = smooth((r - 0.94) / 0.045) * margin;
	const slot = (values?: number[]) =>
		values && source ? sampleSlot(values, source.divisions, u, v) * (1 - margin) : 0;
	return {
		point: [p[0], p[1], height] as Vec3,
		cut: height < z - 1e-8,
		shade: slot(source?.shade),
		lawn: Math.max(turf, slot(source?.lawn))
	};
}

function excavate(cell: TerrainCell, pool: Basin): TerrainCell {
	const weights = cell.vertexIds.map((id) => Number(!pool.protectedVertices.has(id)));
	if (!weights.some(Boolean)) return cell;
	const survey = Array.from({ length: stride * stride }, (_, k) =>
		bedSurvey(cell, pool, weights, (k % stride) / divisions, Math.floor(k / stride) / divisions)
	);
	if (!survey.some((s) => s.cut)) return cell;
	const points = survey.map((s) => s.point);
	const wet = points.some((p) => p[2] < pool.level);
	const bank = {
		divisions,
		points,
		indices: bedIndices,
		shade: survey.map((s) => s.shade),
		lawn: survey.map((s) => s.lawn),
		replacesGround: true,
		water: wet ? pool.level : undefined
	};
	return { ...cell, bank };
}

/** Cuts a single level basin into the finished ground between each group of courts
 * and its ring walk. Court seats and occupied wing frontages keep their survey. */
export function courtPools(
	grid: TerrainGrid,
	city: CityPlan,
	cells: TerrainCell[],
	occupied: Iterable<string>
) {
	const plots = new Set([...courtReservations(city), ...occupied]);
	const updated = cells.slice();
	for (const c of city.centres) {
		if (!c.ensembles || c.ensembles.length < 2) continue;
		const pool = basin(grid, c, plots, cells);
		const bed = pool.cells.map((cell) => excavate(updated[cell.index], pool));
		for (const cell of floodPool(bed, pool.level)) updated[cell.index] = cell;
	}
	return updated;
}
