import { defineRules, type Options, type Policy, type Snapshot } from '../neighbourhood';
import { FRAME_DIAMETER } from '../../data/frame-sections';

import { defineParams, numberParam, resolveParams, type ParamOverrides } from '../../core/params';
import { compileSeams } from './seams';
import { faceSeam } from './address';
import type { FrameSeam } from './seam-policy';

const framePlacementParams = defineParams({
	secondaryDensity: numberParam(
		'Interior seams with a secondary member',
		'fraction',
		1,
		[0, 1, 0.05]
	)
});
type FramePolicy = Readonly<{
	seed: number;
	city?: ParamOverrides<typeof framePlacementParams>;
	districts?: ReadonlyMap<string, ParamOverrides<typeof framePlacementParams>>;
}>;

const uses = ['house', 'court', 'passage'];
const contacts = Object.fromEntries(uses.map((use) => [use, uses]));

/** Compiles district infill tendencies. City and district weights describe the desired mix of uses. */
export function frameRules(scopes: Pick<Policy, 'city' | 'districts'> = {}, options?: Options) {
	return defineRules({ ...scopes, contacts }, options);
}

type Point = readonly [number, number, number];
type Polygon = Readonly<{
	vertexIds: readonly string[];
	corners: readonly Point[];
	neighbors: readonly (string | null)[];
}>;
type Side = { vertices: readonly [string, string]; axis: readonly [Point, Point] };
function sideOf(face: Polygon, index: number) {
	const address = faceSeam(face, index);
	const a = face.corners[index],
		b = face.corners[(index + 1) % face.corners.length];
	if (
		address.vertices[0] === address.vertices[1] ||
		!a.every(Number.isFinite) ||
		!b.every(Number.isFinite) ||
		a.every((v, k) => v === b[k])
	)
		throw new RangeError('Invalid frame edge');
	const axis: Side['axis'] = address.vertices[0] === face.vertexIds[index] ? [a, b] : [b, a];
	return { ...address, axis };
}

function parcel(id: string, state: Snapshot, carrier: ReadonlyMap<string, Polygon>) {
	const cell = state.get(id),
		face = carrier.get(id);
	if (
		!cell ||
		cell.id !== id ||
		!uses.includes(cell.form) ||
		!face ||
		face.neighbors.length < 3 ||
		face.neighbors.length > 5 ||
		[face.vertexIds, face.corners, cell.neighbors].some(
			(ring) => ring.length !== face.neighbors.length
		) ||
		face.neighbors.some((n, i) => n !== cell.neighbors[i])
	)
		throw new RangeError('Mismatched frame parcel: ' + id);
	return { cell, face };
}

/** Projects shared seams incident to the region in lexical edge-ID order, once per vertex pair.
 * Axis endpoints borrow the carrier's positions in metres. Rim sides are outside this application.
 * Openings use JSON-encoded sorted vertex ID pairs. Nominal diameters are design roles for sizing.
 */
export function districtFrame(
	ids: Iterable<string>,
	state: Snapshot,
	carrier: ReadonlyMap<string, Polygon>,
	openings: ReadonlySet<string> = new Set(),
	policy: FramePolicy = { seed: 0 }
) {
	const requested = new Set(ids);
	for (const id of requested) parcel(id, state, carrier);
	const axes = new Map<string, ReturnType<typeof sideOf>>();
	const seams: FrameSeam[] = [];
	const selection = new Set<string>();
	for (const id of [...state.keys()].sort()) {
		const { cell, face } = parcel(id, state, carrier);
		face.neighbors.forEach((n, i) => {
			if (n === null) return;
			const side = sideOf(face, i);
			if (requested.has(id)) selection.add(side.id);
			if (axes.has(side.id)) return;
			const other = parcel(n, state, carrier);
			const reciprocal = other.face.neighbors.indexOf(id);
			if (reciprocal < 0 || JSON.stringify(sideOf(other.face, reciprocal)) !== JSON.stringify(side))
				throw new RangeError('Inconsistent shared frame edge: ' + side.id);
			axes.set(side.id, side);
			seams.push(surveyPair(cell, other.cell, side, openings, policy));
		});
	}
	return [...compileSeams(seams).solve(selection, new Map(), policy.seed)].map(([id, decision]) => {
		const side = axes.get(id);
		if (!side) throw new RangeError('Missing seam axis');
		const { role, reason } = decision;
		return {
			...side,
			role,
			reason,
			nominalDiameter: role === 'gap' ? 0 : FRAME_DIAMETER[role === 'main' ? 'main' : 'brace']
		};
	});
}

export {
	compileSeams,
	omissionMeasures,
	type BaySnapshot,
	type BayState,
	type OmissionEvidence
} from './seams';
export {
	seamPolicy,
	type EdgeUse,
	type FrameRole,
	type FrameSeam,
	type Character
} from './seam-policy';
export {
	planGoal,
	type FrameGoal,
	type FrameEvent,
	type Forecast,
	type PlanningContext
} from './horizon';

export { frameInfill, type FutureTarget } from './infill-policy';

export { transition as advanceSeams } from './transition';
export { faceSeam, seamAddress } from './address';

function surveyPair(
	cell: ReturnType<typeof parcel>['cell'],
	other: typeof cell,
	side: ReturnType<typeof sideOf>,
	openings: ReadonlySet<string>,
	policy: FramePolicy
): FrameSeam {
	const pair = [cell, other];
	const forms = pair.map((c) => c.form);
	const density = resolveParams(
		framePlacementParams,
		policy.city,
		policy.districts?.get(cell.district)
	).secondaryDensity;
	return {
		...side,
		houses: pair.filter((c) => c.form === 'house').map((c) => c.id),
		district: cell.district,
		character: 'neutral',
		districtEdge: cell.district !== other.district,
		use: forms.includes('court') ? 'court' : 'houses',
		secondaryFactor: density,
		opening: openings.has(side.id) ? 'opening' : forms.includes('passage') ? 'passage' : undefined
	};
}
export {
	ensembleRole,
	ensembleSetback,
	ensembleSurcharge,
	type EnsembleDistrict,
	type EnsembleRole,
	type StoreySurcharge
} from './ensemble-policy';

export {
	houseProgramme,
	bridgeForm,
	type HousePlan,
	type TierKind,
	type LinkKind,
	type CrownKind
} from './composed-policy';

export { houseAspect, type HouseSide } from './house-aspect';
