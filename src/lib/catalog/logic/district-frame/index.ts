import { defineRules, type Options, type Policy, type Snapshot } from '../neighbourhood';
import { FRAME_DIAMETER } from '../../data/frame-sections';

import { defineParams, numberParam, resolveParams, type ParamOverrides } from '../../core/params';
import { hashUnit } from '../../core/random';

export const framePlacementParams = defineParams({
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
type FrameEdge = Side & {
	id: string;
	role: 'main' | 'secondary' | 'gap';
	reason: 'opening' | 'passage' | 'unoccupied' | 'density' | 'district' | 'court' | 'houses';
	nominalDiameter: number;
};

function sideOf(face: Polygon, index: number): Side {
	const next = (index + 1) % face.vertexIds.length;
	const a = face.vertexIds[index],
		b = face.vertexIds[next];
	const p = face.corners[index],
		q = face.corners[next];
	if (
		a === b ||
		!p.every(Number.isFinite) ||
		!q.every(Number.isFinite) ||
		p.every((v, k) => v === q[k])
	)
		throw new RangeError('Invalid frame edge');
	return a < b ? { vertices: [a, b], axis: [p, q] } : { vertices: [b, a], axis: [q, p] };
}

function placement(
	a: string,
	b: string,
	districtEdge: boolean,
	opening: boolean
): Pick<FrameEdge, 'role' | 'reason'> {
	if (opening) return { role: 'gap', reason: 'opening' };
	if ([a, b].includes('passage')) return { role: 'gap', reason: 'passage' };
	if (![a, b].includes('house')) return { role: 'gap', reason: 'unoccupied' };
	if (districtEdge) return { role: 'main', reason: 'district' };
	if ([a, b].includes('court')) return { role: 'main', reason: 'court' };
	return { role: 'secondary', reason: 'houses' };
}

function interiorPlacement(key: string, district: string, policy: FramePolicy) {
	const { secondaryDensity } = resolveParams(
		framePlacementParams,
		policy.city,
		policy.districts?.get(district)
	);
	return hashUnit(policy.seed, key, 'frame-secondary-v1') < secondaryDensity
		? ({ role: 'secondary', reason: 'houses' } as const)
		: ({ role: 'gap', reason: 'density' } as const);
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
	const edges = new Map<string, FrameEdge>();
	for (const id of new Set(ids)) {
		const { cell, face } = parcel(id, state, carrier);
		for (const [i, neighbour] of face.neighbors.entries()) {
			if (neighbour === null) continue;
			const other = parcel(neighbour, state, carrier);
			const side = sideOf(face, i);
			const key = JSON.stringify(side.vertices);
			const reciprocal = other.face.neighbors.indexOf(id);
			if (reciprocal < 0 || JSON.stringify(sideOf(other.face, reciprocal)) !== JSON.stringify(side))
				throw new RangeError('Inconsistent shared frame edge: ' + key);
			if (edges.has(key)) continue;
			const seam = placement(
				cell.form,
				other.cell.form,
				cell.district !== other.cell.district,
				openings.has(key)
			);
			const choice =
				seam.role === 'secondary' ? interiorPlacement(key, cell.district, policy) : seam;
			const nominalDiameter =
				choice.role === 'gap' ? 0 : FRAME_DIAMETER[choice.role === 'main' ? 'main' : 'brace'];
			edges.set(key, { ...side, ...choice, id: key, nominalDiameter });
		}
	}
	return [...edges.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}
