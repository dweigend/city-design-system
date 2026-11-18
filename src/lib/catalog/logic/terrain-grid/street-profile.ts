import { defineParams, numberParam, resolveParams } from '../params';
const schema = defineParams({
	minParcelArea: numberParam('Minimum parcel area', 'm²', 7.5, [0.5, 7.5, 0.5]),
	frontageShift: numberParam('Frontage variation', 'cells', 0.48, [0, 0.48, 0.01]),
	relaxPasses: numberParam('Block relaxation', 'passes', 5, [3, 6, 1], 'integer'),
	settlementWidth: numberParam('Settlement half-width', 'valley share', 0.34, [0.1, 0.48, 0.01]),
	settlementReach: numberParam('Settlement half-depth', 'valley share', 0.39, [0.1, 0.45, 0.01]),
	stagger: numberParam('Parcel stagger', 'cells', 0.32, [0, 0.4, 0.01]),
	riverWidth: numberParam('River width', 'm', 5, [0.1, 5, 0.1]),
	mainWidth: numberParam('Main width', 'm', 3.8, [0.1, 5, 0.1]),
	alleyWidth: numberParam('Alley width', 'm', 0.75, [0.1, 5, 0.05]),
	stairWidth: numberParam('Stair width', 'm', 2, [0.1, 5, 0.1]),
	steepGrade: numberParam('Steep grade', 'grade', 0.18, [0.01, 1, 0.01]),
	terraceRows: numberParam('Terrace rows', 'cells', 4, [2, 8, 1], 'integer'),
	switchbackColumns: numberParam('Switchback columns', 'cells', 1, [0, 1, 0.05]),
	squareRadius: numberParam('Square radius', 'cells', 1, [0, 3, 1], 'integer'),
	bridgeClearance: numberParam('Bridge clearance', 'm', 2, [0.2, 5, 0.1]),
	bankSetback: numberParam('Bank setback', 'm', 15, [0, 35, 1]),
	ravineDepth: numberParam('Ravine depth', 'm', 1.5, [0.1, 10, 0.1]),
	ravineGrade: numberParam('Ravine grade', 'grade', 0.28, [0.01, 1, 0.01]),
	transitionWidth: numberParam('Transition width', 'm', 30, [1, 80, 0.01]),
	deckDepth: numberParam('Deck depth', 'm', 0.4, [0.1, 1, 0.01]),
	approachCells: numberParam('Approach cells', 'cells', 3, [1, 8, 1], 'integer'),
	emptyInk: numberParam('Empty ink', 'ratio', 0.18, [0, 1, 0.01]),
	cityInk: numberParam('City ink', 'ratio', 0.32, [0, 1, 0.01]),
	cityRadiusCells: numberParam('City radius cells', 'cells', 4, [1, 16, 1], 'integer'),
	treadsPerCell: numberParam('Treads per cell', 'steps', 4, [1, 10, 1], 'integer'),
	cellInk: numberParam('Cell ink', 'ratio', 0.16, [0, 1, 0.01]),
	nearStart: numberParam('Near start', 'cells/px', 0.05, [0.01, 0.1, 0.01]),
	nearEnd: numberParam('Near end', 'cells/px', 0.12, [0.11, 0.5, 0.01]),
	bridgeTone: numberParam('Bridge tone', 'ratio', 0.25, [0, 1, 0.01])
});
/** Validates the controls shared by the world and its projection. */
export const parcelProfile = (overrides?: import('../params').ParamOverrides<typeof schema>) =>
	resolveParams(schema, undefined, overrides);
export const defaultStreetPlan = parcelProfile();
