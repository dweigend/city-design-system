/** Module: Builds member graphs and checks nominal gravity load paths. */
export { createMemberGraph, readMemberPrimary, readMemberSection, readMemberSlot } from './graph';
export type { MemberGraph, StructuralJoint, StructuralMember } from './graph';
/** Section dimensions and optional material definitions for a graph. */
export { memberSections, type MemberSection, type StructureDefinitions } from './definitions';
export { runGravity, gravityBalanceTolerance } from './gravity';
export type { GravityResult, JointLoad } from './gravity';

/** A standalone three-bay portal and its roof loads. */
export { portalExample } from './portal-example';

/** Builds the geometry for a standalone frame or an addressed member subset. */
export { createFrameBayObject, type FrameBayOptions } from './frame-object';
