import { defaults } from '../../../config/transit-line';
import { surveyCorridor } from './corridor';
import { railPiers } from './piers';
import type { RailSurvey, TransitLine } from './types';

export type {
	RailAnchor,
	RailCatchment,
	RailConstraints,
	RailCorridor,
	RailGround,
	RailObstacle,
	RailPier,
	RailStation,
	RailSurvey,
	TransitLine
} from './types';

/** Default design limits for the rail grade, radius and vertical clearance. */
export const railConstraints = Object.freeze({
	maximumGradeRatio: defaults.maximumGradeRatio,
	minimumRadiusM: defaults.minimumRadiusM,
	railClearanceM: defaults.railClearanceM
});

/** Selects a straight, level corridor. Prefer fewer wet runs, then more dockable sites,
 * then the surveyed order. The elevation clears sampled ground and nearby obstacles, optionally
 * snapped up to the given lattice. Long wet spans may have no in-water bearing. */
// Exact arithmetic: a level, straight line has zero grade and infinite curve radius.
export function createTransitLine(survey: RailSurvey): TransitLine | undefined {
	const limits = { ...railConstraints, ...survey.constraints };
	if (
		!Object.values(limits).every(Number.isFinite) ||
		limits.maximumGradeRatio < 0 ||
		limits.minimumRadiusM <= 0 ||
		limits.railClearanceM <= 0 ||
		!Number.isFinite(survey.dockReachM) ||
		survey.dockReachM < 0
	)
		throw new RangeError('Invalid rail constraints');
	const levels = survey.levels;
	if (
		levels &&
		!(levels.spacingM > 0 && Number.isFinite(levels.spacingM) && Number.isFinite(levels.datumM))
	)
		throw new RangeError('Invalid rail level lattice');
	const selected = survey.corridors
		.map((corridor) => surveyCorridor(corridor, survey))
		.sort((a, b) => a.wetRuns - b.wetRuns || b.catchments.length - a.catchments.length)[0];
	if (!selected) return undefined;
	const { axis, wetRuns, catchments } = selected;
	const clearM = selected.heightM + limits.railClearanceM;
	const heightM = levels
		? levels.datumM + Math.ceil((clearM - levels.datumM) / levels.spacingM) * levels.spacingM
		: clearM;
	const { lengthM } = axis;
	const piers = railPiers(axis, survey, heightM);
	const stations = catchments.flatMap(({ id, approach, stationM }) => {
		const bearing = piers
			.map(({ top, base }) => ({ top, base, at: axis.locate([top[0], top[1]])[0] }))
			.filter(
				({ top, at }) =>
					at >= defaults.stationMarginM &&
					at <= lengthM - defaults.stationMarginM &&
					Math.hypot(approach.point[0] - top[0], approach.point[1] - top[1]) <= survey.dockReachM
			)
			.sort((a, b) => Math.abs(a.at - stationM) - Math.abs(b.at - stationM) || a.at - b.at)[0];
		return bearing
			? [
					{
						id,
						approachId: approach.id,
						stationM: bearing.at,
						position: bearing.top,
						base: bearing.base
					}
				]
			: [];
	});
	return {
		points: [
			[...axis.at(0), heightM],
			[...axis.at(lengthM), heightM]
		],
		piers,
		stations,
		wetRuns,
		lengthM,
		gradeRatio: 0,
		minimumRadiusM: Infinity
	};
}
