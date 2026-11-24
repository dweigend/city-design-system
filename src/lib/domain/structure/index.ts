/** Module: Builds member graphs and checks nominal gravity load paths. */
export { createMemberGraph, memberSections } from './graph';
export type { MemberGraph, StructuralJoint, StructuralMember } from './graph';
export { runGravity, gravityBalanceTolerance } from './gravity';
export type { GravityResult, JointLoad } from './gravity';

/** A standalone three-bay portal and its roof loads. */
export { portalExample } from './example';
