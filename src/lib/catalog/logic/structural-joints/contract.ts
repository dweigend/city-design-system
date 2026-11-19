import type { Vec3 } from '../traeger';

export type Part = { id: string; diameter: number };
export type Seat =
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
