import { defineParams, numberParam, resolveParams } from '../../core/params';
const schema = defineParams({
	alleyBend: numberParam('Terrace alley bend', 'm', 3.6, [0, 4, 0.1]),
	minParcelArea: numberParam('Minimum parcel area', 'm²', 7.5, [0.5, 7.5, 0.5]),
	frontageShift: numberParam('Frontage variation', 'cells', 0.48, [0, 0.48, 0.01]),
	relaxPasses: numberParam('Block relaxation', 'passes', 5, [3, 6, 1], 'integer'),
	settlementWidth: numberParam('Settlement half-width', 'valley share', 0.34, [0.1, 0.48, 0.01]),
	settlementReach: numberParam('Settlement half-depth', 'valley share', 0.39, [0.1, 0.45, 0.01]),
	stagger: numberParam('Parcel stagger', 'cells', 0.18, [0, 0.4, 0.01]),
	promenadeWidth: numberParam('Riverside promenade width', 'm', 4, [3.7, 6, 0.1]),
	mainAlleyWidth: numberParam('Main alley width', 'm', 3.6, [2.4, 3.6, 0.1]),
	alleyWidth: numberParam('Alley line width', 'm', 1.8, [1.8, 2.3, 0.1]),
	passageWidth: numberParam('Narrow passage width', 'm', 2.4, [2.4, 3.6, 0.1]),
	landingGrade: numberParam('Terrace stair approach', 'grade', 0.035, [0.01, 0.15, 0.005]),
	stairAlleyWidth: numberParam('Stair alley width', 'm', 1.8, [1.8, 2.3, 0.1]),
	steepGrade: numberParam('Steep grade', 'grade', 0.18, [0.01, 1, 0.01]),
	terraceRows: numberParam('Terrace rows', 'cells', 4, [2, 8, 1], 'integer'),
	switchbackColumns: numberParam('Switchback columns', 'cells', 1, [0, 1, 0.05]),
	squareRadius: numberParam('Square radius', 'cells', 1, [0, 3, 1], 'integer'),
	footbridgeWidth: numberParam('Footbridge width', 'm', 1.8, [1.8, 3, 0.1]),
	footbridgeClearance: numberParam('Bridge clearance', 'm', 2, [0.2, 5, 0.1]),
	bankSetback: numberParam('Bank setback', 'm', 15, [0, 35, 1]),
	ravineDepth: numberParam('Ravine depth', 'm', 1.5, [0.1, 10, 0.1]),
	ravineGrade: numberParam('Ravine grade', 'grade', 0.28, [0.01, 1, 0.01]),
	transitionWidth: numberParam('Transition width', 'm', 30, [1, 80, 0.01]),
	deckDepth: numberParam('Deck depth', 'm', 0.4, [0.1, 1, 0.01]),
	approachCells: numberParam('Approach cells', 'cells', 3, [1, 8, 1], 'integer')
});
/** Validates the controls shared by the world and its projection. */
export const parcelProfile = (
	overrides?: import('../../core/params').ParamOverrides<typeof schema>
) => {
	const profile = resolveParams(schema, undefined, overrides);
	if (![2, 4, 8].includes(profile.terraceRows))
		throw new RangeError('Terrace rows must be 2, 4 or 8');
	if (profile.passageWidth > profile.mainAlleyWidth)
		throw new RangeError('Passage exceeds main alley width');
	return profile;
};
export const defaultAlleyPlan = parcelProfile();
