import type { Vec2, Vec3 } from '../../lib/core/geometry';
import {
	cityCameraBearingRad,
	cityCameraMinimumWidthM,
	cityElevation,
	cityFocus,
	cityFrameFillFlat,
	cityFrameFillPerRelief,
	type CityContent,
	type FocusChoice
} from '../../lib/scene/city-volume-projection';
import { projectFocus, type View, type ViewFit } from '../../lib/scene/stage';

type CityStep = '01' | '02' | '03';

/** Selects the city step from the query, defaulting to the complete lattice view. */
export function readCityStep(value: string | null): CityStep {
	return value === '01' || value === '02' ? value : '03';
}

/** The Plan step has no district content and defaults to Plan and crossings. Overlay IDs
 * stay with the projection, including the water-cell overlay in the Plan focus. */
export function readCityStepFocus(
	step: CityStep,
	shares: CityContent['shares'],
	planDrawables: CityContent['planDrawables'],
	requested?: FocusChoice
) {
	const plan = step === '01';
	return cityFocus(
		{
			shares: plan ? { detached: 0, block: 0, center: 0 } : shares,
			lattice: step === '03',
			planDrawables
		},
		requested,
		plan ? 'plan' : 'all'
	);
}

function cityCamera(relief: number) {
	return { bearing: cityCameraBearingRad, elevation: cityElevation(relief) };
}

/** Measures the city envelope in the initial view plane, independent of width and offset. */
export function readCitySubject(view: View, relief: number, points: Iterable<Vec3>) {
	return projectFocus(view, cityCamera(relief), points);
}

/** Leaves room for the Auto profile to raise ground and roofs together. Missing or zero width
 * uses automatic framing. Explicit widths are clamped in meters. */
export function readCityFit(
	relief: number,
	subject: ViewFit['subject'],
	width: number | undefined,
	offset: Vec2
): ViewFit {
	return {
		...cityCamera(relief),
		fill: cityFrameFillFlat - cityFrameFillPerRelief * relief,
		elevationAtWidth: (width) => cityElevation(relief, width),
		subject,
		width: width ? Math.max(cityCameraMinimumWidthM, width) : undefined,
		offset
	};
}
