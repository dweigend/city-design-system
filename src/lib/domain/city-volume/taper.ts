import type { Vec2, Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { columnPlanes, planeIndex } from './foundation';
import type { Column } from './frame';
import { readPlanTopology, type PlanRing, type PlanTopology } from './plan-topology';

/** Horizontal meters a corner moves per level above the lowest column around it. */
export const taperStep = 5;
/** Largest move as a share of the corner's distance to the centre of the columns it carries. */
const taperCap = 0.4;
/** Plan coordinates are matched to the centimetre. */
const keyPerMeter = 100;

type Bands = (id: string) => ReturnType<typeof columnPlanes>;

/** Keeps both endpoints of every incident centre-fan triangle on its original side.
 * Each can move at most a third of the smaller endpoint altitude. The two linear
 * terms and the quadratic term can then change less than the original signed area. */
function cornerClearance({ columns, centres }: PlanTopology, { corner, cells }: PlanRing) {
	let clearance = Infinity;
	for (const id of cells) {
		const { corners } = required(columns.get(id), 'taper column');
		const [cx, cy] = required(centres.get(id), 'taper centre');
		const i = corners.findIndex(({ id }) => id === corner.id);
		const [ax, ay] = corner.position;
		const a = Math.hypot(ax - cx, ay - cy);
		for (const j of [(i + corners.length - 1) % corners.length, (i + 1) % corners.length]) {
			const [bx, by] = corners[j].position;
			const area2 = Math.abs((ax - cx) * (by - cy) - (ay - cy) * (bx - cx));
			const altitude = area2 / Math.max(a, Math.hypot(bx - cx, by - cy));
			clearance = Math.min(clearance, altitude / 3);
		}
	}
	return clearance;
}

/** Retreat of one corner at one level: `taperStep` per level above the lowest column around it,
 * along the line to the mean centre of the columns that still reach that level. Open plan edges
 * count as the foundation cap. */
function cornerRetreat(topology: PlanTopology, bands: Bands) {
	const clearances = new Map<string, number>();
	return ({ corner, cells, interior }: PlanRing, level: number): Vec2 => {
		const base = Math.max(...cells.map((cell) => bands(cell).foundation));
		if (level <= base) return [0, 0];
		const roof = (cell: string) => bands(cell).roof;
		const depth = level - (interior ? Math.min(...cells.map(roof)) : base);
		const carried = cells.filter((cell) => roof(cell) >= level);
		if (depth <= 0 || !carried.length) return [0, 0];
		const [x, y] = carried
			.map((cell) => required(topology.centres.get(cell), 'taper centre'))
			.reduce(([a, b], [u, v]) => [a + u / carried.length, b + v / carried.length], [0, 0]);
		const [dx, dy] = [x - corner.position[0], y - corner.position[1]];
		const reach = Math.hypot(dx, dy);
		// Columns that only touch diagonally across the corner give it no direction.
		if (reach < 1e-6) return [0, 0];
		let clearance = clearances.get(corner.id);
		if (clearance === undefined) {
			clearance = cornerClearance(topology, { corner, cells, interior });
			clearances.set(corner.id, clearance);
		}
		const move = Math.min(taperStep * depth, taperCap * reach, clearance) / reach;
		return [dx * move, dy * move];
	};
}

function mean(points: readonly Vec2[]): Vec2 {
	const [x, y] = points.reduce(([a, b], [u, v]) => [a + u, b + v], [0, 0]);
	return [x / points.length, y / points.length];
}

const planKey = (x: number, y: number) =>
	`${Math.round(x * keyPerMeter)},${Math.round(y * keyPerMeter)}`;

/** Builds the city's taper field: the full horizontal retreat in world meters of a point of the
 * city volume. Signed use scales it, 1 retreats toward the taller columns like a zoning setback and
 * −1 overhangs the lower ones. A plan corner moves along its ring; a cell centre and an edge
 * midpoint move with the mean of their corners. Between two level planes the move is linear in Z.
 * Throws RangeError for a point that is none of these plan addresses. */
export function createCityTaper(columns: readonly Column[], datumZ: number) {
	const topology = readPlanTopology(columns);
	const planes = new Map(
		columns.map((column) => [column.planCellId, columnPlanes(column, datumZ)])
	);
	const retreat = cornerRetreat(topology, (id) => required(planes.get(id), 'taper column'));
	const atCorner = (id: string, level: number) =>
		retreat(required(topology.rings.get(id), 'taper ring'), level);
	const addresses = new Map<string, (level: number) => Vec2>();
	for (const { corner } of topology.rings.values())
		addresses.set(planKey(corner.position[0], corner.position[1]), (level) =>
			atCorner(corner.id, level)
		);
	for (const [id, [x, y]] of topology.centres) {
		const { corners } = required(topology.columns.get(id), 'taper column');
		addresses.set(planKey(x, y), (level) => mean(corners.map((c) => atCorner(c.id, level))));
	}
	for (const { ends } of topology.edges.values()) {
		const [[ax, ay], [bx, by]] = ends.map(({ position }) => position);
		addresses.set(planKey((ax + bx) / 2, (ay + by) / 2), (level) =>
			mean(ends.map((end) => atCorner(end.id, level)))
		);
	}
	return ([x, y, z]: Vec3): Vec2 => {
		const at = addresses.get(planKey(x, y));
		if (!at) throw new RangeError(`No plan address at ${x}, ${y}`);
		const index = Math.max(0, planeIndex(datumZ, z));
		const low = Math.floor(index + 1e-9);
		const t = index - low;
		const below = at(low);
		if (t < 1e-9) return below;
		const above = at(low + 1);
		return [below[0] + (above[0] - below[0]) * t, below[1] + (above[1] - below[1]) * t];
	};
}

/** The taper field of one city volume. */
export type CityTaper = ReturnType<typeof createCityTaper>;
