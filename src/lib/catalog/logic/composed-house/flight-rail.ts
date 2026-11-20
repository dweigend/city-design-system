import { parcelFitsRail } from './stair-parcel';
import { landingSeats } from './landing-seats';
import { volume, remainingAccessVolume } from './access-budget';
import { stairClearance, stairHouse } from './stair-clearance';
import type { Section } from './types';
import type { Vec3 } from '../parametrik/types';
import { houseObject, type StockPart } from './house-object';
import { roleSurface, type HouseSurfaces } from './surfaces';
import { edgeBays, type RailLeg, type RailEdgeReport, type RailReason } from './rail-edge';
import { postSeats } from './post-seats';
import { bodyParts } from './provider';

type Rail = Extract<StockPart, { kind: 'pipe' }>;
function railMember(stock: Rail, id: string, points: Vec3[]) {
	return { ...stock, id, points, sampled: true, structuralRole: 'cantilever' as const };
}
/** Fits both edges of every flight from the terrain up, reserving volume for the lower runs first. */
export function flightRail(
	s: Section,
	legs: RailLeg[],
	width: number,
	surfaces: HouseSurfaces,
	walk: StockPart[],
	reports?: RailEdgeReport[]
) {
	const stock = houseObject('railing', 'short-post', s.seed, {
		instanceId: s.id + '/stair/rail',
		slots: { frame: roleSurface(surfaces.frame, 'screen') }
	}).parts.map((p) => {
		if (p.kind !== 'pipe') throw Error('Expected a registered rail');
		return p;
	});
	const height = stock[0].points[0][2],
		spacing = stock[0].points[1][0] - stock[0].points[0][0];
	const seated = postSeats(walk);
	const house = stairHouse(s, surfaces);
	const clear = stairClearance(house);
	const wallClear = stairClearance(
		s.composition.levels.flatMap((l) => l.bodies.flatMap((b) => bodyParts(b, surfaces)))
	);
	const seats = s.composition.path === 'spiral' ? [] : landingSeats(walk, house, surfaces.deck);
	let remaining = remainingAccessVolume(house, walk, seats);
	function omission(bay: Rail[], credit: number): RailReason | undefined {
		if (!bay.every(clear) || !bay.slice(1).every(seated)) return 'clearance';
		if (!wallClear({ ...bay[0], radius: bay[0].radius + 0.3 })) return 'wall';
		if (!bay.every((p) => parcelFitsRail(s, p))) return 'parcel';
		if (volume(bay) > remaining + credit) return 'volume';
	}
	function extend(previous: ReturnType<typeof railMember>, top: Rail, end: Rail) {
		const continued = { ...previous, points: [...previous.points, ...top.points.slice(1)] };
		const credit = volume([previous]),
			bay = [continued, end];
		if (omission(bay, credit)) return false;
		remaining += credit - volume(bay);
		previous.points = continued.points;
		return true;
	}
	function projectEdge(run: RailLeg[], offset: number, report: RailEdgeReport) {
		const { flight, side } = report;
		const parts: ReturnType<typeof railMember>[] = [];
		let previous: ReturnType<typeof railMember> | undefined;
		for (const [i, { path, length }] of edgeBays(run, offset, spacing).entries()) {
			report.length += length;
			const id = s.id + '/stair/rail/' + flight + '/' + side + '/' + i;
			const raised = ([x, y, z]: Vec3): Vec3 => [x, y, z + height - 0.17];
			const post = (p: Vec3, n: number) =>
				railMember(stock[n], id + '/' + n, [[p[0], p[1], p[2] - 0.17], raised(p)]);
			const top = railMember(stock[0], id + '/0', path.map(raised));
			const end = post(path[path.length - 1], 2);
			if (previous && extend(previous, top, end)) {
				parts.push(end);
			} else {
				const bay = [top, ...(previous ? [] : [post(path[0], 1)]), end];
				const reason = omission(bay, 0);
				if (reason) {
					report.omitted[reason] += length;
					previous = undefined;
					continue;
				}
				remaining -= volume(bay);
				parts.push(...bay);
				previous = top;
			}
			report.covered += length;
		}
		return parts;
	}
	const groups = Map.groupBy(legs, (l) => l.flight);
	return [...groups].reverse().flatMap(([flight, run]) =>
		['outer', 'inner'].flatMap((side) => {
			const report: RailEdgeReport = {
				flight,
				side: side === 'outer' ? 'outer' : 'inner',
				length: 0,
				covered: 0,
				omitted: { wall: 0, clearance: 0, parcel: 0, volume: 0 }
			};
			reports?.push(report);
			const offset = (width / 2 - 0.09) * (side === 'outer' ? 1 : -1);
			return projectEdge(run, offset, report);
		})
	);
}
