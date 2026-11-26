import {
	distance,
	measurePointSegmentDistance,
	readVertexMean,
	type Vec2
} from '../../core/geometry';
import { required } from '../../core/invariant';
import {
	createStripSpace,
	DegenerateParcelError,
	fineCellWidth,
	parcelEdgeId,
	type CellSpace,
	type FineCell
} from '../../domain/cell-space';
import type { AddressedParcel, ParcelPortal } from '../../domain/parcels';
import type { CityGrowthCourtAccess } from './types';

export type Burgage = Readonly<{
	space: CellSpace;
	frontId: string;
	rearId: string;
	courtAccess: CityGrowthCourtAccess;
	groundByCell: ReadonlyMap<string, Readonly<{ lowest: number; highest: number }>>;
}>;

function neighbors(cell: FineCell) {
	return cell.sides.flatMap(({ neighbour }) => (neighbour === null ? [] : [neighbour])).sort();
}

function readPaths(first: FineCell, cells: ReadonlyMap<string, FineCell>) {
	const paths = new Map([[first.id, [first]]]);
	for (const path of paths.values()) {
		for (const id of neighbors(required(path.at(-1), 'path end'))) {
			const cell = cells.get(id);
			if (cell && !paths.has(id)) paths.set(id, [...path, cell]);
		}
	}
	return paths;
}

function frontageDistance(cell: FineCell, point: Vec2) {
	return Math.min(
		...cell.sides.flatMap(({ frontage }, i) =>
			frontage
				? [measurePointSegmentDistance(point, cell.quad[i], cell.quad[(i + 1) % cell.quad.length])]
				: []
		)
	);
}

function readWingIds(
	path: readonly FineCell[],
	cells: ReadonlyMap<string, FineCell>,
	depthOf: (cell: FineCell) => number
) {
	const reserved = new Set(path.map(({ id }) => id));
	const frontIds = neighbors(path[0]).filter(
		(id) => !reserved.has(id) && cells.get(id)?.sides.some(({ frontage }) => frontage)
	);
	const access = new Set(path.slice(1).flatMap(neighbors));
	for (const frontId of frontIds) {
		const front = required(cells.get(frontId), 'front wing');
		const rearId = neighbors(front).find((id) => {
			const cell = cells.get(id);
			return (
				cell &&
				!reserved.has(id) &&
				access.has(id) &&
				!cell.sides.some(({ frontage }) => frontage) &&
				depthOf(cell) > depthOf(front)
			);
		});
		if (rearId) return { frontId, rearId };
	}
}

function readBurgagePlan(
	cells: ReadonlyMap<string, FineCell>,
	portal: ParcelPortal,
	linearToleranceM: number
) {
	const [a, b] = portal.points;
	const midpoint = readVertexMean(portal.points);
	const portalLength = distance(a, b);
	const depthOf = ({ quad }: FineCell) => {
		const [x, y] = readVertexMean(quad);
		return ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) / portalLength;
	};
	const entries = [...cells.values()].filter(
		(cell) => frontageDistance(cell, midpoint) <= linearToleranceM
	);
	for (const entry of entries) {
		const paths = [...readPaths(entry, cells).values()].toSorted(
			(a, b) => depthOf(required(b.at(-1), 'court')) - depthOf(required(a.at(-1), 'court'))
		);
		for (const path of paths) {
			if (path.length === 1) continue;
			const wings = readWingIds(path, cells, depthOf);
			if (!wings) continue;
			const courtAccess: CityGrowthCourtAccess = Object.freeze({
				cellIds: Object.freeze(path.map(({ id }) => id)),
				polygons: Object.freeze(path.map(({ quad }) => quad))
			});
			return { ...wings, courtAccess };
		}
	}
}

/** Reserves a dry route from the actual portal to a rear court, with attached wings on one side. */
export function prepareBurgage(
	parcel: AddressedParcel,
	portal: ParcelPortal,
	linearToleranceM: number,
	readGround: (ring: readonly Vec2[]) => { lowest: number; highest: number } | undefined
): Burgage | undefined {
	let space: CellSpace;
	try {
		space = createStripSpace({
			id: parcel.id,
			corners: parcel.corners,
			frontage: [parcelEdgeId(...portal.side)],
			baseZ: /* Exact arithmetic: initial subdivision uses a local plane. */ 0,
			storeyCount: /* Exact arithmetic: plan capture needs one placeholder slice. */ 1
		});
	} catch (error) {
		if (error instanceof DegenerateParcelError) return undefined;
		throw error;
	}
	const cells = new Map<string, FineCell>();
	const groundByCell = new Map<string, { lowest: number; highest: number }>();
	for (const cell of space.cells) {
		if (fineCellWidth(cell) < (space.houseRules?.minimumWidthM ?? 0)) continue;
		const ground = readGround(cell.quad);
		if (!ground) continue;
		cells.set(cell.id, cell);
		groundByCell.set(cell.id, ground);
	}
	const plan = readBurgagePlan(cells, portal, linearToleranceM);
	return plan && { space, ...plan, groundByCell };
}
