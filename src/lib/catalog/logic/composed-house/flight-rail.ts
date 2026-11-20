import { parcelFitsRail } from './stair-parcel';
import { landingSeats } from './landing-seats';
import { volume, remainingAccessVolume } from './access-budget';
import { stairClearance, stairHouse } from './stair-clearance';
import type { Section } from './types';
import type { Vec3 } from '../parametrik/types';
import { houseObject, type StockPart } from './house-object';
import { roleSurface, type HouseSurfaces } from './surfaces';
import {
	edgeBays,
	railDistance,
	type RailLeg,
	type RailEdgeReport,
	type RailReason
} from './rail-edge';
import { postSeats } from './post-seats';
import { bodyParts } from './provider';

type Rail = Extract<StockPart, { kind: 'pipe' }>;
function segment(stock: Rail[], a: Vec3, b: Vec3, span: number, id: string) {
	const distance = railDistance(a, b),
		scale = distance / span;
	const dx = b[0] - a[0],
		dy = b[1] - a[1],
		run = Math.hypot(dx, dy);
	const [start, end] = stock[0].points;
	const roll = Math.atan2(b[2] - a[2], run) - Math.atan2(end[2] - start[2], end[0] - start[0]);
	const cos = Math.cos(roll),
		sin = Math.sin(roll);
	function mount([x, , z]: Vec3): Vec3 {
		const along = scale * ((x - start[0]) * cos - (z - start[2]) * sin);
		return [
			a[0] + (along * dx) / run,
			a[1] + (along * dy) / run,
			a[2] + scale * ((x - start[0]) * sin + (z - start[2]) * cos)
		];
	}

	return stock.map((p, i) => ({
		...p,
		id: id + '/' + i,
		structuralRole: 'cantilever' as const,
		radius: p.radius * scale,
		points: p.points.map(mount)
	}));
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
	const stockFor = (variant: string) =>
		houseObject('railing', variant, s.seed, {
			instanceId: s.id + '/stair/rail',
			slots: { frame: roleSurface(surfaces.frame, 'screen') }
		}).parts.map((p) => {
			if (p.kind !== 'pipe') throw Error('Expected a registered rail');
			return p;
		});
	const stocks = new Map<string, Rail[]>();
	function fitting(a: Vec3, b: Vec3, small: boolean) {
		const angle = Math.atan2(b[2] - a[2], Math.hypot(b[1] - a[1], b[0] - a[0]));
		const pitch = Math.min(75, Math.max(0, Math.round((angle * 12) / Math.PI) * 15));
		const variant = (small ? 'closure-post' : 'short-post') + (pitch ? '-' + pitch : '');
		const stock = stocks.get(variant) ?? stockFor(variant);
		stocks.set(variant, stock);
		return stock;
	}
	const stock = stockFor('short-post'),
		[start, end] = stock[0].points,
		span = railDistance(start, end);
	const seated = postSeats(walk);
	const house = stairHouse(s, surfaces);
	const clear = stairClearance(house);
	const wallClear = stairClearance(
		s.composition.levels.flatMap((l) => l.bodies.flatMap((b) => bodyParts(b, surfaces)))
	);
	const seats = s.composition.path === 'spiral' ? [] : landingSeats(walk, house, surfaces.deck);
	let remaining = remainingAccessVolume(house, walk, seats);
	function omission(bay: Rail[]): RailReason | undefined {
		if (!bay.every(clear) || !bay.slice(1).every(seated)) return 'clearance';
		if (!wallClear({ ...bay[0], radius: bay[0].radius + 0.3 })) return 'wall';
		if (!bay.every((p) => parcelFitsRail(s, p))) return 'parcel';
		if (volume(bay) > remaining) return 'volume';
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
			return edgeBays(run, offset, span).flatMap(({ a, b, length, fits, small }, i) => {
				report.length += length;
				const raised = (p: Vec3): Vec3 => [p[0], p[1], p[2] + start[2] - 0.17];
				const bay = fits
					? segment(
							fitting(a, b, small),
							raised(a),
							raised(b),
							small ? span / 4 : span,
							s.id + '/stair/rail/' + flight + '/' + side + '/' + i
						)
					: [];
				const reason = fits ? omission(bay) : 'clearance';
				if (reason) {
					report.omitted[reason] += length;
					return [];
				}
				report.covered += length;
				remaining -= volume(bay);
				return bay;
			});
		})
	);
}
