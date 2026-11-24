import type { Vec2 } from '../../core/geometry';
import { columnRoof, type CityColumn } from '../../domain/city-volume';
import {
	createStraightLevelTransitLine,
	type RailAnchor,
	type RailCorridor,
	type StraightLevelRailSurvey
} from '../../domain/transit-line';
import type { CityGrid, CitySite } from '../city-site';
import { defaults } from '../../../config/city-movement';
import { stairSurvey } from './stairs';
import { raised } from './links';
import type { groundLanes } from './ground';

/** Caller-selected rail survey origin, station catchment centres and terrain upper bounds. */
export type CityRailOptions = Readonly<{
	center: Vec2;
	catchments: readonly { id: string; center: Vec2 }[];
	readSpanUpperM: StraightLevelRailSurvey['readSpanUpperM'];
}>;

export function cityRail(
	site: CitySite,
	layout: CityGrid,
	ground: ReturnType<typeof groundLanes>,
	columns: readonly CityColumn[],
	options: CityRailOptions,
	levelHeightM: number
) {
	const { bearing } = site.frame;
	const u = Math.cos(bearing);
	const v = Math.sin(bearing);
	const [x, y] = site.origin;
	const at = (along: number, across: number): Vec2 => [
		x + u * along - v * across,
		y + v * along + u * across
	];
	const getAlong = ([wx, wy]: Vec2) => (wx - x) * u + (wy - y) * v;
	const getAcross = ([wx, wy]: Vec2) => (wy - y) * u - (wx - x) * v;
	const across = getAcross(options.center);
	const half = defaults.railHalfLengthM;
	const corridors: RailCorridor[] = [];
	for (let i = 0; i <= defaults.railCorridorCount; i++) {
		const offset = i * defaults.railCorridorStepM;
		corridors.push([at(-half, across + offset), at(half, across + offset)]);
		if (i) corridors.push([at(-half, across - offset), at(half, across - offset)]);
	}
	const occupied = new Set(columns.map(({ planCellId }) => planCellId));
	const boundary = new Set(
		ground.edges
			.filter(({ cellIds }) => cellIds.length === 1 || cellIds.some((id) => !occupied.has(id)))
			.flatMap(({ nodeIds }) => nodeIds)
	);
	const approaches: RailAnchor[] = [...ground.nodes]
		.filter(([id]) => boundary.has(id))
		.map(
			([
				,
				{
					id,
					position: [wx, wy]
				}
			]) => ({ id, point: [wx, wy] })
		);

	const catchments = options.catchments.map(({ id, center }) => {
		const target = getAlong(center);
		return {
			id,
			approaches: approaches.filter(
				({ point }) => Math.abs(getAlong(point) - target) <= defaults.railCatchmentHalfWidthM
			)
		};
	});
	const obstacles = columns.map((column) => ({
		outline: column.corners.map(({ position: [wx, wy] }): Vec2 => [wx, wy]),
		topM: columnRoof(column, layout.datumZ, levelHeightM)
	}));
	const anchorNodes = new Map(
		[...layout.plan.vertices, ...layout.grid.vertices].map((node) => [node.id, node])
	);
	const occupiedAlong = obstacles.flatMap(({ outline }) => outline.map(getAlong));
	const occupiedAcross = obstacles.flatMap(({ outline }) => outline.map(getAcross));
	const alongMin = Math.min(...occupiedAlong);
	const alongMax = Math.max(...occupiedAlong);
	const acrossMin = Math.min(...occupiedAcross);
	const acrossMax = Math.max(...occupiedAcross);
	const stair = stairSurvey(site, columns, layout.datumZ, levelHeightM, ground.clear);
	const nodes = new Map([...ground.nodes.values()].map((node) => [node.id, node]));
	const access = new Map<string, boolean>();
	return createStraightLevelTransitLine({
		readSpanUpperM: options.readSpanUpperM,
		acceptsApproach({ id }, platform) {
			const z = platform[2];
			const key = id + '/' + z;
			const cached = access.get(key);
			if (cached !== undefined) return cached;
			const node = nodes.get(id);
			if (!node) return false;
			const level = Math.round((z - layout.datumZ) / levelHeightM);
			const usable = Boolean(stair(id, node, raised(node, level, z)));
			access.set(key, usable);
			return usable;
		},
		corridors,
		readGround(wx, wy) {
			const sample = site.sampleGround(wx, wy);
			return {
				heightM:
					sample.waterKind === null ? sample.height : Math.max(sample.height, sample.waterHeight),
				dryClearanceM: sample.waterClearance
			};
		},
		anchors: [...anchorNodes.values()].map(({ id, position: [wx, wy] }): RailAnchor => ({
			id,
			point: [wx, wy]
		})),
		requiresAnchor(point) {
			const a = getAlong(point);
			const b = getAcross(point);
			return a >= alongMin && a <= alongMax && b >= acrossMin && b <= acrossMax;
		},
		obstacles,
		catchments,
		dockReachM: defaults.railDockReachM,
		levels: { datumM: layout.datumZ, spacingM: levelHeightM }
	});
}
