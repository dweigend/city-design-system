import type { Vec2 } from '../../core/geometry';
import { columnRoof, levelHeight, type CityColumn } from '../../domain/city-volume';
import { createTransitLine, type RailAnchor, type RailCorridor } from '../../domain/transit-line';
import type { CityGrid, CitySite } from '../city-site';
import { defaults } from '../../../config/city-movement';
import type { groundLanes } from './ground';

export function cityRail(
	site: CitySite,
	layout: CityGrid,
	ground: ReturnType<typeof groundLanes>,
	columns: readonly CityColumn[]
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
	const head = ground.crossings[0];
	const center = head
		? ground.node(head.first).position
		: ground.nodes.values().next().value?.position;
	const cityCenter: Vec2 = center ? [center[0], center[1]] : site.origin;
	const across = getAcross(cityCenter);
	const along = getAlong(cityCenter);
	const half = defaults.railHalfLengthM;
	const corridors: RailCorridor[] = [];
	for (let i = 0; i <= defaults.railCorridorCount; i++) {
		const offset = i * defaults.railCorridorStepM;
		corridors.push([at(-half, across + offset), at(half, across + offset)]);
		if (i) corridors.push([at(-half, across - offset), at(half, across - offset)]);
	}
	const approaches: RailAnchor[] = [...ground.nodes.values()].map(({ id, position: [wx, wy] }) => ({
		id,
		point: [wx, wy]
	}));
	const catchments = ['upstream', 'downstream'].map((id, i) => {
		const target = along + (i - 0.5) * defaults.railCatchmentSpacingM;
		return {
			id,
			approaches: approaches.filter(
				({ point }) => Math.abs(getAlong(point) - target) <= defaults.railCatchmentHalfWidthM
			)
		};
	});
	const obstacles = columns.map((column) => ({
		outline: column.corners.map(({ position: [wx, wy] }): Vec2 => [wx, wy]),
		topM: columnRoof(column, layout.datumZ)
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
	return createTransitLine({
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
		levels: { datumM: layout.datumZ, spacingM: levelHeight }
	});
}
