import { displacement, dotProduct, type Vec2, type Vec3 } from '../../core/geometry';
import {
	readStoreyElevation,
	type CellSpace,
	type CellStorey,
	type FineCell
} from '../../domain/cell-space';
import type { HouseCell } from '../../domain/massing';
import type { CameraRay } from '../stage';

/** The fine cell and available storeys locked on press, with its center in stage coordinates. */
export type VerticalTarget = Readonly<{
	cell: FineCell;
	center: Vec2;
	storeys: readonly CellStorey[];
}>;

type PlanRay = Readonly<{ origin: Vec2; direction: Vec2 }>;

// Clips the ray's distance range against the inward half-plane of every CCW cell edge.
function readCellDistance(cell: FineCell, ray: PlanRay, first: number, last: number) {
	const { quad } = cell;
	const {
		origin: [x, y],
		direction: [dx, dy]
	} = ray;
	for (const [i, [ax, ay]] of quad.entries()) {
		const [bx, by] = quad[(i + 1) % quad.length];
		const offset = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
		const slope = (bx - ax) * dy - (by - ay) * dx;
		if (slope > 0) first = Math.max(first, -offset / slope);
		else if (slope < 0) last = Math.min(last, -offset / slope);
		else if (offset < 0) return undefined;
		if (first > last) return undefined;
	}
	return first;
}

/** Reads the first fine cell containing a plan point, breaking shared edges in cell order. */
export function readFineCell(space: CellSpace, position: Vec2): FineCell | undefined {
	const point = {
		origin: position,
		direction: /* Exact arithmetic: a stationary point. */ [0, 0]
	} as const;
	const interval = /* Exact arithmetic: test only the ray origin. */ [0, 0] as const;
	return space.cells.find((cell) => readCellDistance(cell, point, ...interval) !== undefined);
}

function readHeightInterval(z: number, dz: number, bottom: number, top: number) {
	if (dz === 0) {
		if (z < bottom || z > top) return undefined;
		return [-Infinity, Infinity] as const;
	}
	const a = (bottom - z) / dz;
	const b = (top - z) / dz;
	return [Math.min(a, b), Math.max(a, b)] as const;
}

/** Reads the nearest occupied cell volume along a ray in the cell space's coordinates.
 * The exclusive limit can be the terrain hit, so ground hides volumes behind it. */
export function readOccupiedCell(
	space: CellSpace,
	cells: readonly HouseCell[],
	ray: CameraRay,
	limit: number
): Readonly<{ cell: FineCell; distance: number }> | undefined {
	const {
		origin: [x, y, z],
		direction: [dx, dy, dz]
	} = ray;
	const plan: PlanRay = { origin: [x, y], direction: [dx, dy] };
	const occupancy = new Map(cells.map((cell) => [cell.id, cell]));
	let hit: { cell: FineCell; distance: number } | undefined;
	let nearest = limit;
	for (const cell of space.cells) {
		const run = occupancy.get(cell.id);
		if (!run || run.fromStorey >= run.toStorey) continue;
		const bottom = readStoreyElevation(space, run.fromStorey);
		const top = readStoreyElevation(space, run.toStorey);
		const heights = readHeightInterval(z, dz, bottom, top);
		if (!heights) continue;
		const distance = readCellDistance(
			cell,
			plan,
			Math.max(0, heights[0]),
			Math.min(nearest, heights[1])
		);
		if (distance === undefined || distance >= nearest) continue;
		hit = { cell, distance };
		nearest = distance;
	}
	return hit;
}

function readHeight(ray: CameraRay, point: Vec3, normal: Vec3): number | undefined {
	const along = dotProduct(ray.direction, normal);
	if (Math.abs(along) <= Number.EPSILON) return undefined;
	const distance = dotProduct(displacement(ray.origin, point), normal) / along;
	if (distance < 0) return undefined;
	const height = ray.origin[2] + distance * ray.direction[2];
	return Number.isFinite(height) ? height : undefined;
}

/** Locks a vertical plane through the fine cell center, facing the press ray horizontally.
 * Reads the bands crossed from the press to the current ray in drag order. Each band is
 * bottom-inclusive and top-exclusive. Parallel rays have no preview. */
export function createVerticalStroke(target: VerticalTarget, ray: CameraRay) {
	const [dx, dy] = ray.direction;
	const length = Math.hypot(dx, dy);
	if (length <= Number.EPSILON) return undefined;
	const normal: Vec3 = [dx / length, dy / length, /* Exact arithmetic: horizontal normal. */ 0];
	const point: Vec3 = [...target.center, /* Exact arithmetic: any Z lies in the plane. */ 0];
	const start = readHeight(ray, point, normal);
	if (start === undefined) return undefined;
	return (current: CameraRay): readonly CellStorey[] | undefined => {
		const height = readHeight(current, point, normal);
		if (height === undefined) return undefined;
		const low = Math.min(start, height);
		const high = Math.max(start, height);
		const crossed = target.storeys.filter(({ bottomZ, topZ }) => bottomZ <= high && low < topZ);
		return height < start ? crossed.reverse() : crossed;
	};
}
