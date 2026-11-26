import { distance, type Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { encodeKey } from '../../core/ref';
import type { ParcelLane } from '../../domain/parcels';
import { createCityRailSurvey, readCityMovement, readCityRail } from '../city-movement';
import type { CityCrossing, CityGrid, CitySite } from '../city-site';
import type { CityColumn } from '../../domain/city-volume';
import { readLanesAtNodes } from './lanes';
import { developmentDefaults } from './recipe';
import type {
	CityInfrastructurePart,
	CityGrowthDevelopment,
	EventDate,
	RailOpened,
	StationOpened
} from './types';

/** Takes ownership of plain geometry freshly returned by survey or registry builders. */
export function freezeGeometry<T>(value: T): T {
	if (value !== null && typeof value === 'object') {
		for (const child of Object.values(value)) freezeGeometry(child);
		Object.freeze(value);
	}
	return value;
}

export function prepareInfrastructure(
	site: CitySite,
	layout: CityGrid,
	columns: readonly CityColumn[],
	lanes: readonly ParcelLane[],
	development: CityGrowthDevelopment,
	endYear: number
) {
	const landmarks = new Map([
		...layout.plan.vertices.map(({ id, position }) => [id, position] as const),
		...layout.grid.vertices.map(({ id, position }) => [id, position] as const)
	]);
	const lanesAtNode = readLanesAtNodes(lanes);
	const railFromYear = development.railFromYear ?? developmentDefaults.railFromYear;
	if (railFromYear > endYear) return { landmarks, lanesAtNode };
	const survey = createCityRailSurvey(
		site,
		layout,
		layout.crossings[0]?.heads.map(({ nodeId }) => nodeId) ?? []
	);
	const rail = readCityRail(site, layout, columns, survey);
	if (!rail?.stations.length) return { landmarks, lanesAtNode };
	const { network } = readCityMovement(
		site,
		{ ...layout, selectedCrossings: [] },
		columns,
		/* Exact arithmetic: zero offset for a ground network with no upper walkway centers. */ 0,
		rail,
		[]
	);
	return { rail, network, landmarks, lanesAtNode };
}

type Survey = ReturnType<typeof prepareInfrastructure>;
type PartBuilder = ReturnType<typeof createPartBuilder>;

export function createPartBuilder(readDatumIndex: (elevationM: number) => number) {
	return (
		owner: string,
		key: string,
		kind: CityInfrastructurePart['kind'],
		builtYear: number,
		points: readonly Vec3[]
	): CityInfrastructurePart => {
		const datumIndex = readDatumIndex(required(points.at(-1), 'infrastructure endpoint')[2]);
		return freezeGeometry({
			id: encodeKey([owner, key, kind, datumIndex]),
			kind,
			datumIndex,
			builtYear,
			points
		});
	};
}

function readBridgePoints(survey: Survey, crossing: CityCrossing): readonly Vec3[] {
	const ids = crossing.span?.nodeIds ?? crossing.path.nodeIds;
	const points = ids.map((id) => required(survey.landmarks.get(id), 'crossing plan node'));
	const first = points[0];
	const last = required(points.at(-1), 'crossing end');
	const lengths = points
		.slice(1)
		.map(([x, y], index) => distance([x, y], [points[index][0], points[index][1]]));
	const lengthM = lengths.reduce((sum, length) => sum + length, 0);
	let chainageM = 0;
	return points.map(([x, y], index) => {
		if (index === 0) return first;
		if (index === points.length - 1) return last;
		chainageM += lengths[index - 1];
		return [x, y, first[2] + (last[2] - first[2]) * (chainageM / lengthM)];
	});
}

export function createBridge(
	survey: Survey,
	crossing: CityCrossing,
	year: number,
	part: PartBuilder
) {
	const points = readBridgePoints(survey, crossing);
	const segments = crossing.span ? [crossing.id] : crossing.path.edges.map(({ id }) => id);
	const deck = segments.map((id, i) =>
		part(crossing.id, id, 'deck', year, [points[i], points[i + 1]])
	);
	const supports = crossing.heads.map(({ nodeId }) => {
		const top = required(survey.landmarks.get(nodeId), 'bridge head');
		const [x, y, z] = top;
		const base: Vec3 = [x, y, z - developmentDefaults.bearingDepthM];
		return { nodeId, top, base };
	});
	const bearings = supports.map(({ nodeId, base, top }) =>
		part(crossing.id, nodeId, 'bearing', year, [base, top])
	);
	return { points, supports, parts: Object.freeze([...deck, ...bearings]) };
}

export function createRailEvents(
	survey: Survey,
	scope: string,
	date: EventDate,
	part: PartBuilder,
	readCatchment: (
		nodeId: string,
		point: Vec3
	) => { ids: string[]; lane: ParcelLane; open: boolean } | undefined
) {
	if (!survey.rail || !survey.network) return;
	const { stations, ...line } = survey.rail;
	const id = encodeKey([scope, 'overland']);
	const docks: StationOpened[] = [];
	for (const station of stations) {
		const approach = survey.network.readNode(station.approachId);
		const route = survey.network.readRoute(station.approachId, 'station/' + station.id);
		if (!approach || !route?.edges.length) continue;
		const nodeId = station.approachId.slice('ground/'.length);
		const catchment = readCatchment(nodeId, approach.position);
		if (!catchment) continue;
		const centerId = encodeKey([id, 'station', station.approachId]);
		docks.push(
			freezeGeometry({
				kind: 'station-opened',
				year: date.year,
				sequence: date.sequence + docks.length + 1,
				id: centerId,
				railId: id,
				station,
				dock: route.edges,
				catchmentHoldingIds: catchment.ids,
				lanes: catchment.open ? [] : [{ ...catchment.lane, builtYear: date.year }],
				parts: [
					part(centerId, station.id, 'platform', date.year, [station.base, station.position]),
					...route.edges.map(({ id, points }) => part(centerId, id, 'dock', date.year, points))
				]
			})
		);
	}
	if (!docks.length) return;
	const track = part(id, 'guideway', 'track', date.year, line.points);
	const bearings = line.piers.map(({ anchorId, base, top }, index) =>
		part(id, anchorId ?? encodeKey(['pier', index]), 'bearing', date.year, [base, top])
	);
	const rail: RailOpened = freezeGeometry({
		kind: 'rail-opened',
		...date,
		id,
		line,
		parts: [track, ...bearings]
	});
	return [rail, ...docks];
}

export function distanceXY(a: Vec3, b: Vec3) {
	return distance([a[0], a[1]], [b[0], b[1]]);
}
