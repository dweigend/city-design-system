import { writable, type Readable, type Writable } from 'svelte/store';
import type { Vec2, Vec3 } from '../../lib/core/geometry';
import { resolveParams, type ParameterSchema } from '../../lib/core/params';
import { columnRoof, type CityColumn } from '../../lib/domain/city-volume';
import {
	cityCameraBearingRad,
	cityCameraMinimumWidthM,
	cityElevation,
	cityFocus,
	cityFrameFillFlat,
	cityFrameFillPerRelief,
	type CityContent,
	type FocusChoice,
	type CityDrawable,
	type projectCityTerrain
} from '../../lib/scene/city-volume-projection';
import { projectFocus, type View, type ViewFit } from '../../lib/scene/stage';
import type { Drawable } from '../../lib/scene/surface';

type CityTerrainProjection = ReturnType<typeof projectCityTerrain>;

/** Composes the route's wet-plan lines (omitting merged interior edges) and parcel drawables. */
export function readCityPlanDrawables(
	terrain: Pick<CityTerrainProjection, 'projectWetPlan' | 'projectParcels'>,
	selectedCrossings: Parameters<CityTerrainProjection['projectWetPlan']>[0],
	holdings: Parameters<CityTerrainProjection['projectParcels']>[0]
) {
	return {
		planLines: terrain.projectWetPlan(selectedCrossings, holdings.mergedUnits),
		parcelDrawables: terrain.projectParcels(holdings)
	};
}

type CityStep = '01' | '02' | '03';
type CitySlider = Readable<number> & {
	draft: Writable<number>;
	commit: (value: number) => void;
};

/** Creates a fresh draft initialized from the query and a readable committed value.
 * Both values use the schema's units, bounds and steps. Missing query values use the
 * schema default. Non-finite query or commit values throw RangeError. */
export function createCitySlider(param: ParameterSchema[string], queryValue?: number): CitySlider {
	const schema = { value: param };
	const initial = resolveParams(schema, { value: queryValue ?? param.default }).value;
	const draft = writable(initial);
	const committed = writable(initial);
	return {
		draft,
		subscribe: committed.subscribe,
		commit: (value: number) => {
			const resolved = resolveParams(schema, { value }).value;
			draft.set(resolved);
			committed.set(resolved);
		}
	};
}

/** Selects the city step from the query, defaulting to the complete lattice view. */
export function readCityStep(value: string | null): CityStep {
	return value === '01' || value === '02' ? value : '03';
}

/** Reads only the visible geometry for the step, using lazy projection readers. */
export function readCityStepDrawables(
	step: CityStep,
	readEnvelope: () => readonly CityDrawable[],
	readMembers: () => readonly Drawable[]
) {
	return {
		tiles: step === '01' ? [] : readEnvelope(),
		wires: step === '03' ? readMembers() : []
	};
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

/** Streams the local XYZ vertices in meters that bound the untapered envelope. Interior walls
 * start on neighboring roof corners. All intermediate wall vertices lie on the segments between
 * roof and floor, so only roof corners and exposed ground corners can extend the projected bounds. */
export function* readCitySubjectPoints(
	columns: readonly CityColumn[],
	datumZ: number,
	terrain: Pick<CityTerrainProjection, 'toLocal'>,
	levelHeightM: number
): IterableIterator<Vec3> {
	for (const column of columns) {
		const { corners, neighbors } = column;
		const roof = columnRoof(column, datumZ, levelHeightM);
		for (const [
			index,
			{
				position: [x, y, z]
			}
		] of corners.entries()) {
			const local = terrain.toLocal(x, y);
			yield [...local, roof];
			const previous = index === 0 ? neighbors.length - 1 : index - 1;
			if (neighbors[index] === null || neighbors[previous] === null) yield [...local, z];
		}
	}
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
