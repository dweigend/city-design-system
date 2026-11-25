/** Module: Builds a level transit line with bearings and stations. */
import { defaults } from '../../../config/transit-line';
import { surveyCorridor } from './corridor';
import { railPiers } from './piers';
import { railStations } from './stations';
import type { StraightLevelRailSurvey, TransitLine } from './types';

export type {
	/** Candidate dry ground anchor with a caller-defined plan address. */
	RailAnchor,
	/** An approach preference at one site. */
	RailCatchment,
	/** Numeric constraints can override the defaults. */
	RailConstraints,
	/** Ordered endpoints of a candidate straight corridor, in world XY meters. */
	RailCorridor,
	/** Ground survey at one XY point, with the top of water or terrain and signed dry clearance. */
	RailGround,
	/** Horizontal outline of an obstruction and its upper elevation. */
	RailObstacle,
	/** A bearing on the guideway and its dry ground foundation. */
	RailPier,
	/** A station identified by its catchment ID and docked toward an approach address. */
	RailStation,
	/** Survey inputs and preferences. */
	StraightLevelRailSurvey,
	/** A level guideway with two endpoints, foundations and optional station sites. */
	TransitLine
} from './types';

/** Default design limits for the rail grade, radius and vertical clearance. */
export const railConstraints = Object.freeze({
	maximumGradeRatio: defaults.maximumGradeRatio,
	minimumRadiusM: defaults.minimumRadiusM,
	railClearanceM: defaults.railClearanceM
});

/** Creates a straight, level guideway, with grade 0 and infinite horizontal radius.
 * Rejects unsupported candidates, then ranks by wet runs, feasible docks and input order.
 * Terrain clearance comes from the caller's span bounds. Returns undefined if no corridor is feasible. */
export function createStraightLevelTransitLine(
	survey: StraightLevelRailSurvey
): TransitLine | undefined {
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
	return survey.corridors
		.flatMap((corridor) => {
			const { axis, wetRuns, heightM } = surveyCorridor(corridor, survey);
			const clearM = heightM + limits.railClearanceM;
			const z = levels
				? levels.datumM + Math.ceil((clearM - levels.datumM) / levels.spacingM) * levels.spacingM
				: clearM;
			const piers = railPiers(axis, survey, z);
			if (!piers.length) return [];
			return [levelLine(axis, z, wetRuns, piers, survey)];
		})
		.sort((a, b) => a.wetRuns - b.wetRuns || b.stations.length - a.stations.length)[0];
}

// Exact arithmetic: a level, straight line starts at chainage zero and has zero grade.
function levelLine(
	axis: Parameters<typeof railStations>[0],
	z: number,
	wetRuns: number,
	piers: TransitLine['piers'],
	survey: StraightLevelRailSurvey
): TransitLine {
	return /* Exact arithmetic: the straight level corridor has zero grade. */ {
		points: [
			[...axis.at(0), z],
			[...axis.at(axis.lengthM), z]
		],
		piers,
		stations: railStations(axis, piers, survey),
		wetRuns,
		lengthM: axis.lengthM,
		gradeRatio: 0,
		minimumRadiusM: Infinity
	};
}

/** Single-pier and station objects used by the rail projection and placement registry. */
export {
	/** Builds a rail pier between the supplied base and bearing, including any offset crosshead. */
	createRailPierObject,
	/** Builds a platform, paired shelters and their posts along a horizontal track direction. */
	createStationPlatformObject,
	/** Thickness of the guideway slab and its crossheads in meters. */
	railDeckThicknessM,
	/** Returns the length of a finite, nonzero XY track direction in meters. */
	trackDirectionLength,
	/** Schemas for editable pier radius and platform width in meters. */
	transitObjectParams
} from './objects';
