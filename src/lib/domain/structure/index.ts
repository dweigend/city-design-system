/** Module: Builds member graphs and checks nominal gravity load paths. */
export {
	/** Validates and detaches joints and members. */
	createMemberGraph,
	/** Resolves primary classification from the member and its section. */
	readMemberPrimary,
	/** Reads the validated section used by a member of this graph. */
	readMemberSection,
	/** Encodes a role and section as the member's geometry slot. */
	readMemberSlot
} from './graph';
export type {
	/** Detached, validated graph in ascending code-unit order by ID. */
	MemberGraph,
	/** A joint in world XYZ meters, with Z up. */
	StructuralJoint,
	/** An undirected connection by joint ID, with a role and section key. */
	StructuralMember
} from './graph';
/** Section dimensions and optional material definitions for a graph. */
export {
	/** Default section geometry and primary classification. */
	memberSections,
	/** A square outside profile, its load-bearing area and optional material reference stress. */
	type MemberSection,
	/** Extend or override the built-in sections and roles for one immutable graph. */
	type StructureDefinitions
} from './definitions';
export {
	/** Routes nonnegative gravity loads to reachable supports. */
	runGravity,
	/** Relative tolerance for checking the vertical force balance. */
	gravityBalanceTolerance
} from './gravity';
export type {
	/** Vertical force balance, support reactions and per-member estimates. */
	GravityResult,
	/** Nonnegative downward force in kN, applied once per joint. */
	JointLoad
} from './gravity';

/** A standalone three-bay portal and its roof loads. */
export { portalExample } from './portal-example';

/** Builds the geometry for a standalone frame or an addressed member subset. */
export {
	/** Builds square-profile members in graph order and preserves selected support anchors. */
	createFrameBayObject,
	/** An optional addressed subset and coordinate mapping for a frame object. */
	type FrameBayOptions
} from './frame-object';
