import { styleForYear } from '../sandbox';
import { defineParams, numberParam, resolveParams } from '../params';
import type { Vec3 } from '../traeger';
import { jointMeshes, type JointMesh } from './geometry';

import { fitSeat, seatTangent } from './seat';

type Part = { id: string; diameter: number };
type Seat =
	| 'terrain'
	| 'wall-crest'
	| 'chord'
	| 'frame-corner'
	| 'block-transition'
	| 'roof-step'
	| 'rail-saddle';
export type StructuralContact = {
	member: Part;
	/** For terrain, use the stable ground patch ID and its usable bearing width in metres. */
	support: Part;
	seat: Seat;
	/** Stable site ID within the directed member/support pair. */
	anchor: string;
	owner: string;
	built: number;
	/** World-space member endpoint on the surveyed support face, in metres. The planner ends the member here. */
	point: Vec3;
	/** Axis of the circular member or its bounding cylinder, directed away from the support. */
	axis: Vec3;
	/** Outward world normal of an oblique support plane. Defaults to the member axis. */
	supportNormal?: Vec3;
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

function derive(c: StructuralContact, partId: string): StructuralJoint {
	const { member, support, axis, point } = c;
	const length = Math.hypot(...axis);
	if (
		![member.diameter, support.diameter, length].every((n) => Number.isFinite(n) && n > 0) ||
		!point.every(Number.isFinite) ||
		!Number.isSafeInteger(c.built) ||
		![member.id, support.id, c.owner, c.anchor].every(Boolean) ||
		member.id === support.id
	)
		throw new RangeError('Invalid structural contact');
	const width = Math.min(
		(styleForYear(c.built) === 'terrace' ? historic : current).width,
		member.diameter / 4,
		support.diameter / 4
	);
	const shoe = c.seat === 'terrain' || c.seat === 'wall-crest';
	const unit: Vec3 = [axis[0] / length, axis[1] / length, axis[2] / length];
	const tangent = seatTangent(unit);
	const geometry = jointMeshes(shoe, member.diameter / 2, width);
	if (c.supportNormal) fitSeat(geometry, unit, tangent, c.supportNormal);
	return {
		partId,
		type: shoe ? 'shoe' : 'cuff',
		owner: c.owner,
		built: c.built,
		anchor: c.anchor,
		point: [...point],
		axis: unit,
		tangent,
		stroke: c.stroke,
		geometry
	};
}

/** Derives one fitting per directed contact site, sorted by stable part ID. Conflicting rows are invalid. */
export function deriveStructuralJoints(contacts: readonly StructuralContact[]): StructuralJoint[] {
	const sites = new Map<string, { contact: StructuralContact; signature: string }>();
	for (const c of contacts) {
		const id = 'joint/' + [c.member.id, c.support.id, c.anchor].map(encodeURIComponent).join('/');
		const signature = JSON.stringify([
			c.owner,
			c.built,
			c.seat,
			c.stroke,
			c.member.diameter,
			c.support.diameter,
			c.point,
			c.supportNormal,
			c.axis
		]);
		const previous = sites.get(id);
		if (previous && previous.signature !== signature)
			throw new Error('Conflicting structural contact: ' + id);
		sites.set(id, { contact: c, signature });
	}
	return [...sites.keys()].sort().map((id) => derive(sites.get(id)!.contact, id));
}
