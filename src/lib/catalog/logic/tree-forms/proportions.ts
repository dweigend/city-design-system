import { defineParams, numberParam, resolveParams } from '../params';

/** Shared proportions for the design bible and sandbox. */
export const TREE_PARAMS = defineParams({
	trunkRadius: numberParam('Trunk radius factor', 'ratio', 0.07, [0.01, 2, 0.01]),
	trunkRadiusMin: numberParam('Minimum trunk radius', 'm', 0.12, [0, 5, 0.01]),
	trunkHeight: numberParam('Trunk height factor', 'ratio', 0.9, [0.01, 5, 0.05]),
	trunkIntoCrown: numberParam('Trunk overlap factor', 'ratio', 0.3, [0, 5, 0.05]),
	ballRadius: numberParam('Ball radius factor', 'ratio', 0.6, [0.01, 5, 0.05]),
	coneRadius: numberParam('Cone radius factor', 'ratio', 0.42, [0.01, 5, 0.01]),
	coneHeight: numberParam('Cone height factor', 'ratio', 1.8, [0.01, 8, 0.05])
});

export const TREE_FORM = Object.freeze(resolveParams(TREE_PARAMS));
export type TreeProfile = typeof TREE_FORM;

/** Trunk radius in meters for a tree of size `s`, using the supplied resolved profile. */
export const trunkRadius = (s: number, profile: TreeProfile = TREE_FORM) =>
	Math.max(profile.trunkRadiusMin, s * profile.trunkRadius);
