import { parcelFitsRail } from './stair-parcel';
import { landingSeats } from './landing-seats';
import { volume, remainingAccessVolume } from './access-budget';
import { stairClearance, stairHouse } from './stair-clearance';
import type { Section } from './types';
import type { Vec3 } from '../parametrik/types';
import { houseObject, type StockPart } from './house-object';
import { roleSurface, type HouseSurfaces } from './surfaces';
import { edge, type Station } from './stair-track';

type Rail = Extract<StockPart, { kind: 'pipe' }>;
type End = { station: Station; z: number };

function length(a: Vec3, b: Vec3) {
	return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

// Sample equal distances along the stair edge, then measure each straight stock chord.
function divide(points: Vec3[], distances: number[], count: number) {
	let i = 1;
	return Array.from({ length: count + 1 }, (_, j): Vec3 => {
		const d = (distances[distances.length - 1] * j) / count;
		while (i < distances.length - 1 && distances[i] < d) i++;
		const t = (d - distances[i - 1]) / (distances[i] - distances[i - 1]);
		return points[i - 1].map((v, k) => v + t * (points[i][k] - v)) as Vec3;
	});
}

function joints(points: Vec3[], span: number) {
	const distances = [0];
	for (let i = 1; i < points.length; i++)
		distances.push(distances[i - 1] + length(points[i - 1], points[i]));
	const total = distances[distances.length - 1];
	for (let count = Math.max(1, Math.ceil(total / span)); count >= 1; count--) {
		const ends = divide(points, distances, count);
		const scales = ends.slice(1).map((b, i) => length(ends[i], b) / span);
		if (Math.min(...scales) >= 1 && Math.max(...scales) <= 1.15) return ends;
		if (Math.max(...scales) > 1.15) break;
	}
	return [];
}

function segment(stock: Rail[], a: Vec3, b: Vec3, span: number, id: string) {
	const distance = length(a, b),
		scale = distance / span;
	const axis = b.map((v, k) => (v - a[k]) / distance) as Vec3;
	const horizontal = Math.hypot(axis[0], axis[1]);
	const up = [(-axis[2] * axis[0]) / horizontal, (-axis[2] * axis[1]) / horizontal, horizontal];
	// Adjacent bays share the end-post axis. Pivot about the top joint so pitched bays meet at turns.
	const railHeight = stock[0].points[0][2];
	const centre = a.map((v, k) => (v + b[k]) / 2 - up[k] * railHeight * scale);

	return stock.map((p, i) => ({
		...p,
		id: id + '/' + i,
		structuralRole: 'cantilever' as const,
		radius: p.radius * scale,
		points: p.points.map(
			([x, , z]) => centre.map((v, k) => v + scale * (axis[k] * x + up[k] * z)) as Vec3
		)
	}));
}

/** Fits whole handrail bays along the surveyed outer edge, including the curved stair turns. */
export function flightRail(
	s: Section,
	ends: End[],
	width: number,
	surfaces: HouseSurfaces,
	walk: StockPart[]
) {
	const id = s.id + '/stair/rail/';
	const object = houseObject('railing', 'standard', s.seed, {
		instanceId: id,
		slots: { frame: roleSurface(surfaces.frame, 'screen') }
	});
	const stock = object.parts.map((p) => {
		if (p.kind !== 'pipe') throw Error('Expected a registered rail');
		return p;
	});
	const [start, end] = stock[0].points;
	const span = length(start, end);
	const points = ends.map(({ station, z }): Vec3 => [
		...edge(station, width / 2 - 0.09),
		z + start[2]
	]);
	const path = joints(points, span);
	const house = stairHouse(s, surfaces);
	const clear = stairClearance(house);
	const seats = s.composition.path === 'spiral' ? [] : landingSeats(walk, house, surfaces.deck);
	let remaining = remainingAccessVolume(house, walk, seats);
	return path.slice(1).flatMap((b, i) => {
		const bay = segment(stock, path[i], b, span, id + i);
		const cost = volume(bay);
		if (
			cost > remaining ||
			!bay.every((p) => clear({ ...p, radius: p.radius + 0.16 }) && parcelFitsRail(s, p))
		)
			return [];
		remaining -= cost;
		return bay;
	});
}
