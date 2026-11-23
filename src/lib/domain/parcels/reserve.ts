import type { Vec2 } from '../../core/geometry';
import { edgeFrame, polygonArea, rectangle, subtract } from './geometry';
import type { LaneInput, PlanPolygon } from './types';

export type Frontage = Readonly<{
	laneId: string;
	frame: ReturnType<typeof edgeFrame>;
	depthM: number;
}>;

export function laneAddress({ edge }: LaneInput) {
	const support =
		edge.provenance.kind === 'plan'
			? edge.provenance.planEdgeId
			: ['shore', edge.provenance.cellId];
	return JSON.stringify([support, edge.nodeIds]);
}

export function frontageFrame(lane: LaneInput, a: Vec2, b: Vec2): Frontage {
	return {
		laneId: laneAddress(lane),
		frame: edgeFrame(a, b),
		depthM: lane.oneSided ? lane.widthM : lane.widthM / 2
	};
}

export function reserveLanes(
	outline: readonly Vec2[],
	sides: readonly Frontage[],
	toleranceM: number
) {
	const gross: PlanPolygon = Object.freeze([outline]);
	const buffers = sides.map(({ frame, depthM }) =>
		rectangle(frame, -depthM, frame.lengthM + depthM, -depthM, depthM)
	);
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
	sides: readonly Frontage[],
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
