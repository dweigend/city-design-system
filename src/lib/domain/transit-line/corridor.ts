import type { Vec2 } from '../../core/geometry';
import { defaults } from '../../../config/transit-line';
import type { RailCorridor, RailObstacle, StraightLevelRailSurvey } from './types';

// Exact arithmetic: the transverse axis starts at a signed zero offset.
export function frame([start, end]: RailCorridor) {
	const dx = end[0] - start[0];
	const dy = end[1] - start[1];
	const lengthM = Math.hypot(dx, dy);
	if (!Number.isFinite(lengthM) || lengthM <= 0) throw new RangeError('Invalid rail corridor');
	const u = dx / lengthM;
	const v = dy / lengthM;
	return {
		lengthM,
		at: (along: number, across = /* Exact arithmetic: centerline offset is zero. */ 0): Vec2 => [
			start[0] + u * along - v * across,
			start[1] + v * along + u * across
		],
		locate: ([x, y]: Vec2): Vec2 => [
			(x - start[0]) * u + (y - start[1]) * v,
			(y - start[1]) * u - (x - start[0]) * v
		]
	};
}

export type Frame = ReturnType<typeof frame>;

function near({ outline }: RailObstacle, frame: Frame, reachM: number) {
	const coords = outline.map(frame.locate);
	return (
		coords.some(([u]) => u >= 0) &&
		coords.some(([u]) => u <= frame.lengthM) &&
		coords.some(([, v]) => v >= -reachM) &&
		coords.some(([, v]) => v <= reachM)
	);
}

export function surveyCorridor(corridor: RailCorridor, survey: StraightLevelRailSurvey) {
	const axis = frame(corridor);
	const { lengthM } = axis;
	const count = Math.ceil(lengthM / defaults.surveyStepM);
	let wetRuns = 0;
	let wet = false;
	let heightM = -Infinity;
	let previous = axis.at(0);
	for (let i = 0; i <= count; i++) {
		const point = axis.at((i * lengthM) / count);
		const ground = survey.readGround(...point);
		if (i > 0) {
			const upperM = survey.readSpanUpperM(previous, point);
			if (!Number.isFinite(upperM)) throw new RangeError('Expected a finite terrain span bound');
			heightM = Math.max(heightM, upperM);
		}
		previous = point;
		heightM = Math.max(heightM, ground.heightM);
		const nextWet = ground.dryClearanceM <= 0;
		if (nextWet && !wet) wetRuns++;
		wet = nextWet;
	}
	for (const obstacle of survey.obstacles ?? []) {
		if (near(obstacle, axis, survey.dockReachM)) heightM = Math.max(heightM, obstacle.topM);
	}
	return { axis, heightM, wetRuns };
}
