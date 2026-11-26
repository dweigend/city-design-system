import {
	distance,
	measurePointSegmentDistance,
	readVertexMean,
	type Vec2
} from '../../core/geometry';
import { required } from '../../core/invariant';
import { DegenerateParcelError, fineCellWidth, type FineCell } from '../../domain/cell-space';
import { houseStyles } from '../../domain/house-court';
import type { ParcelPortal } from '../../domain/parcels';
import { createParcelHouse, type ParcelHouseSite, type PlacedParcelHouse } from '../house-site';
import type { CityConstructionEra, CityGrowthCourtAccess } from './types';

export type Burgage = Readonly<{
	placed: PlacedParcelHouse;
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
	blocked: ReadonlySet<string>,
	builtIds: ReadonlySet<string>,
	depthOf: (cell: FineCell) => number
) {
	const reserved = new Set([...blocked, ...path.map(({ id }) => id)]);
	const frontIds = neighbors(path[0])
		.filter((id) => !reserved.has(id) && cells.get(id)?.sides.some(({ frontage }) => frontage))
		.sort((a, b) => Number(builtIds.has(b)) - Number(builtIds.has(a)) || (a < b ? -1 : 1));
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

function placedCourtRoute(
	placed: PlacedParcelHouse,
	cells: ReadonlyMap<string, FineCell>,
	midpoint: Vec2,
	linearToleranceM: number
) {
	const [entryIds] = placed.house.entrances;
	if (!entryIds?.length) return undefined;
	const route = entryIds.map((id) => cells.get(id));
	if (route.some((cell) => cell === undefined)) return undefined;
	const entry = route[0] as FineCell;
	if (frontageDistance(entry, midpoint) > linearToleranceM) return undefined;
	const courtRoles = new Set(
		placed.house.cells.filter(({ role }) => role === 'court').map(({ id }) => id)
	);
	const last = route.at(-1) as FineCell;
	const courtId = neighbors(last).find((id) => courtRoles.has(id) && cells.has(id));
	if (!courtId) return undefined;
	return [...(route as FineCell[]), required(cells.get(courtId), 'placed court cell')];
}

function readBurgagePlan(
	placed: PlacedParcelHouse,
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
	const blocked = new Set(placed.house.entrances.flat());
	const builtIds = new Set(
		placed.house.cells
			.filter(({ toStorey, fromStorey }) => toStorey > fromStorey)
			.map(({ id }) => id)
	);
	const buildPlan = (path: readonly FineCell[]) => {
		const wings = readWingIds(path, cells, blocked, builtIds, depthOf);
		if (!wings) return undefined;
		const courtAccess: CityGrowthCourtAccess = Object.freeze({
			cellIds: Object.freeze(path.map(({ id }) => id)),
			polygons: Object.freeze(path.map(({ quad }) => quad))
		});
		return { ...wings, courtAccess };
	};
	const nativeRoute = placedCourtRoute(placed, cells, midpoint, linearToleranceM);
	if (nativeRoute) {
		const plan = buildPlan(nativeRoute);
		if (plan) return plan;
	}
	const entryOrder = new Set(placed.house.entrances.map((path) => path[0]).filter(Boolean));
	const entries = [...cells.values()]
		.filter((cell) => frontageDistance(cell, midpoint) <= linearToleranceM)
		.sort(
			(x, y) =>
				Number(entryOrder.has(y.id)) - Number(entryOrder.has(x.id)) || (x.id < y.id ? -1 : 1)
		);
	for (const entry of entries) {
		const paths = [...readPaths(entry, cells).values()].toSorted(
			(x, y) => depthOf(required(y.at(-1), 'court')) - depthOf(required(x.at(-1), 'court'))
		);
		for (const path of paths) {
			if (path.length === 1) continue;
			const plan = buildPlan(path);
			if (plan) return plan;
		}
	}
}

/** Places one parcel house via world/house-site and reserves a dry portal-to-court route with adjacent wings. */
export function prepareBurgage(
	parcelSite: ParcelHouseSite,
	era: CityConstructionEra,
	initialHeightM: number,
	seed: number,
	readGround: (ring: readonly Vec2[]) => { lowest: number; highest: number } | undefined
): Burgage | undefined {
	let result: ReturnType<typeof createParcelHouse>;
	try {
		result = createParcelHouse(
			parcelSite,
			{ height: initialHeightM, seed },
			houseStyles[era.styleId]
		);
	} catch (error) {
		if (error instanceof DegenerateParcelError) return undefined;
		throw error;
	}
	if (result.status !== 'placed') return undefined;
	const { space } = result;
	const cells = new Map<string, FineCell>();
	const groundByCell = new Map<string, { lowest: number; highest: number }>();
	for (const cell of space.cells) {
		if (fineCellWidth(cell) < (space.houseRules?.minimumWidthM ?? 0)) continue;
		const ground = readGround(cell.quad);
		if (!ground) continue;
		cells.set(cell.id, cell);
		groundByCell.set(cell.id, ground);
	}
	const plan = readBurgagePlan(result, cells, parcelSite.portal, parcelSite.linearToleranceM);
	return plan && { placed: result, ...plan, groundByCell };
}
