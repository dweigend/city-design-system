import { styleForYear } from '../sandbox';
import { defineParams, numberParam, resolveParams } from '../../core/params';
import type { Vec3 } from '../traeger';
import { jointMeshes, type JointMesh } from './geometry';

import { fitSeat, seatTangent, unit } from './seat';

type Part = { id: string; diameter: number };
type Seat =
	| 'terrain'
	| 'wall-crest'
	| 'chord'
	| 'frame-corner'
	| 'block-transition'
	| 'roof-step'
	| 'rail-saddle'
	| 'slab-seam';
export type StructuralContact = {
	member: Part;
	/** For terrain, use the stable ground patch ID and its usable bearing width in metres. */
	support: Part;
	seat: Seat;
	/** Stable site ID within the directed member/support pair. */
	anchor: string;
	owner: string;
	built: number;
	/** World-space contact on the surveyed support face, in metres. */
	point: Vec3;
	/** Axis of the circular member or its bounding cylinder, directed away from the support. */
	axis: Vec3;
	/** Surveyed outward world normal. Required for terrain and wall crests. Cuffs default to a perpendicular seat. */
	supportNormal?: Vec3;
	/** Chords, rail saddles and frame corners default to round, other seats to plane.
	 * Supply the surveyed cylinder axis for a rotated support. The default generator is
	 * the deterministic first tangent of the surveyed normal. Diameter is support.diameter. */
	supportProfile?: { kind: 'plane' } | { kind: 'round'; axis: Vec3 };
	stroke: 'main' | 'secondary' | 'infill';
};

export type StructuralJoint = {
	partId: string;
	type: 'shoe' | 'cuff';
	owner: string;
	anchor: string;
	built: number;
	point: Vec3;
	axis: Vec3;
	tangent: Vec3;
	stroke: StructuralContact['stroke'];
	geometry: JointMesh[];
};

const dimensions = defineParams({
	width: numberParam('Maximum band width', 'm', 0.38, [0.01, 0.8, 0.01])
});
const current = resolveParams(dimensions);
const historic = resolveParams(dimensions, { width: 0.24 });

function validateContact(c: StructuralContact) {
	const { member, support, point } = c;
	if (
		![member.diameter, support.diameter].every((n) => Number.isFinite(n) && n > 0) ||
		!point.every((n) => Number.isFinite(Math.fround(n))) ||
		!Number.isSafeInteger(c.built) ||
		![member.id, support.id, c.owner, c.anchor].every(Boolean) ||
		member.id === support.id
	)
		throw new RangeError('Invalid structural contact');
}

function validateShoe(c: StructuralContact, shoe: boolean) {
	if (shoe && !c.supportNormal)
		throw new RangeError('Terrain and wall-crest shoes require a surveyed supportNormal');
	if (shoe && c.supportProfile?.kind === 'round')
		throw new RangeError('A shoe requires a planar bearing patch');
}

function bearingAxis(c: StructuralContact, normal: Vec3) {
	const round = c.seat === 'frame-corner' || c.seat === 'chord' || c.seat === 'rail-saddle';
	if (c.supportProfile?.kind === 'round') return c.supportProfile.axis;
	return !c.supportProfile && round ? seatTangent(normal) : undefined;
}

function derive(c: StructuralContact, partId: string): StructuralJoint {
	validateContact(c);
	const { member, support, axis, point } = c;

	const width = Math.min(
		(styleForYear(c.built) === 'terrace' ? historic : current).width,
		member.diameter / 4,
		support.diameter / 4
	);
	const shoe = c.seat === 'terrain' || c.seat === 'wall-crest';
	validateShoe(c, shoe);
	const direction = unit(axis);
	const normal = c.supportNormal ? unit(c.supportNormal) : direction;
	const roundAxis = bearingAxis(c, normal);
	const geometry = jointMeshes(shoe, member.diameter / 2, width);
	const tangent = fitSeat(
		geometry,
		direction,
		normal,
		width,
		support.diameter / 2,
		member.diameter / 2,
		roundAxis
	);
	return {
		partId,
		type: shoe ? 'shoe' : 'cuff',
		owner: c.owner,
		built: c.built || 0,
		anchor: c.anchor,
		point: point.map((n) => n || 0) as Vec3,
		axis: direction,
		tangent,
		stroke: c.stroke,
		geometry
	};
}

/** Each row must uniquely identify a directed member/support/anchor site. Repeated addresses
 * (including identical rows) and invalid seats reject the entire batch with RangeError.
 * A successful call returns one fitting per row in stable part-ID order. */
export function deriveStructuralJoints(contacts: readonly StructuralContact[]): StructuralJoint[] {
	const sites = new Map<string, StructuralContact>();
	for (const c of contacts) {
		const id = 'joint/' + [c.member.id, c.support.id, c.anchor].map(encodeURIComponent).join('/');
		if (sites.has(id)) throw new RangeError('Duplicate structural contact: ' + id);
		sites.set(id, c);
	}
	return [...sites.entries()]
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([id, contact]) => derive(contact, id));
}

export { sandboxStructuralContacts } from './sandbox-contacts';
