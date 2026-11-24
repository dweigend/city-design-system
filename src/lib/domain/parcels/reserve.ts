import { distance, type Vec2 } from '../../core/geometry';
import { edgeFrame, intersect, polygonArea, rectangle, subtract } from './geometry';
import type { LaneInput, PlanPolygon } from './types';

export type Frontage = Readonly<{
	laneId: string;
	frame: ReturnType<typeof edgeFrame>;
	depthM: number;
	sideIndex: number;
}>;

export function laneAddress({ edge }: LaneInput) {
	const support =
		edge.provenance.kind === 'plan'
			? edge.provenance.planEdgeId
			: ['shore', edge.provenance.cellId];
	return JSON.stringify([support, edge.nodeIds]);
}

export function frontageFrame(lane: LaneInput, a: Vec2, b: Vec2, sideIndex: number): Frontage {
	return {
		laneId: laneAddress(lane),
		sideIndex,
		frame: edgeFrame(a, b),
		depthM: lane.oneSided ? lane.widthM : lane.widthM / 2
	};
}

// Exact arithmetic: The supporting lane edge is the origin of its local frame.
const edgeLineM = 0;

function laneBuffers(gross: PlanPolygon, sides: readonly Frontage[], toleranceM: number) {
	const [outline] = gross;
	const turns = outline.map((point, index) => {
		const previous = outline[(index + outline.length - 1) % outline.length];
		const next = outline[(index + 1) % outline.length];
		return edgeFrame(previous, point).read(next)[1] < -toleranceM;
	});
	const strip = ({ frame, depthM }: Frontage) =>
		rectangle(frame, edgeLineM, frame.lengthM, edgeLineM, depthM);
	if (!turns.some(Boolean)) return sides.map(strip);

	const buffers = sides.flatMap((side) =>
		intersect(gross, strip(side), toleranceM).filter(
			([outer]) => frontageContacts(outer, [{ ...side, depthM: edgeLineM }], toleranceM).length > 0
		)
	);
	const bySide = new Map(sides.map((side) => [side.sideIndex, side]));
	for (const [i, point] of outline.entries()) {
		if (!turns[i]) continue;
		const previous = bySide.get((i + outline.length - 1) % outline.length);
		const next = bySide.get(i);
		if (!previous || !next) continue;
		// Bevel the join at its incident corner. Ignore disconnected pieces on other arms.
		const bevel: PlanPolygon = [
			[
				point,
				next.frame.pointAt(edgeLineM, next.depthM),
				previous.frame.pointAt(previous.frame.lengthM, previous.depthM)
			]
		];
		for (const piece of intersect(gross, bevel, toleranceM)) {
			if (piece[0].some((vertex) => distance(vertex, point) <= toleranceM)) buffers.push(piece);
		}
	}
	return buffers;
}

export function reserveLanes(
	outline: readonly Vec2[],
	sides: readonly Frontage[],
	toleranceM: number
) {
	const gross: PlanPolygon = Object.freeze([outline]);
	const buffers = laneBuffers(gross, sides, toleranceM);
	const netGround = subtract(gross, buffers, toleranceM);
	const laneGround = netGround.length ? subtract(gross, netGround, toleranceM) : [gross];
	return {
		grossAreaM2: polygonArea(gross),
		laneAreaM2: laneGround.reduce((sum, polygon) => sum + polygonArea(polygon), 0),
		laneGround: Object.freeze(laneGround),
		netGround: Object.freeze(netGround)
	};
}

type Contact = Readonly<{
	laneId: string;
	lengthM: number;
	points: readonly [Vec2, Vec2];
	edgeIndex: number;
}>;

export function frontageContacts(
	ring: readonly Vec2[],
	sides: readonly Omit<Frontage, 'sideIndex'>[],
	toleranceM: number
) {
	return ring.flatMap((a, edgeIndex): Contact[] => {
		const b = ring[(edgeIndex + 1) % ring.length];
		return sides.flatMap(({ laneId, frame, depthM }) => {
			const [u, leftA] = frame.read(a);
			const [v, leftB] = frame.read(b);
			if (Math.abs(leftA - depthM) > toleranceM || Math.abs(leftB - depthM) > toleranceM) return [];
			const lo = Math.max(0, Math.min(u, v));
			const hi = Math.min(frame.lengthM, Math.max(u, v));
			const lengthM = hi - lo;
			if (lengthM <= toleranceM) return [];
			const points = Object.freeze(
				u < v
					? ([frame.pointAt(lo, depthM), frame.pointAt(hi, depthM)] as const)
					: ([frame.pointAt(hi, depthM), frame.pointAt(lo, depthM)] as const)
			);
			return [{ laneId, lengthM, points, edgeIndex }];
		});
	});
}
