import { defineParams, numberParam, resolveParams } from '../params';
const schema = defineParams({
	minParcelArea: numberParam('Minimum parcel area', 'm²', 7.5, [0.5, 7.5, 0.5]),
	frontageShift: numberParam('Frontage variation', 'cells', 0.48, [0, 0.48, 0.01]),
	relaxPasses: numberParam('Block relaxation', 'passes', 5, [3, 6, 1], 'integer'),
	settlementWidth: numberParam('Settlement half-width', 'valley share', 0.34, [0.1, 0.48, 0.01]),
	settlementReach: numberParam('Settlement half-depth', 'valley share', 0.39, [0.1, 0.45, 0.01]),
	stagger: numberParam('Parcel stagger', 'cells', 0.32, [0, 0.4, 0.01])
});

type OrganicOverrides = import('../params').ParamOverrides<typeof schema>;
/** Validates the parcel controls at the terrain-grid entry point. */
export function parcelProfile({
	minParcelArea,
	frontageShift,
	relaxPasses,
	stagger,
	settlementWidth,
	settlementReach
}: OrganicOverrides = {}) {
	return resolveParams(schema, undefined, {
		minParcelArea,
		frontageShift,
		relaxPasses,
		stagger,
		settlementWidth,
		settlementReach
	});
}
const parcelDefaults = parcelProfile();

/** Distances are meters. Grades are rise divided by horizontal run. */
export const defaultStreetPlan = {
	...parcelDefaults,
	riverWidth: 5,
	mainWidth: 3.8,
	alleyWidth: 0.75,
	stairWidth: 2,
	steepGrade: 0.18,
	terraceRows: 4,
	switchbackColumns: 1,
	squareRadius: 1,
	bridgeClearance: 2,
	bankSetback: 15,
	ravineDepth: 1.5,
	ravineGrade: 0.28
};
