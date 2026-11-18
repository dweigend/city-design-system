/**
 * Proportions of the abstract model trees: one owner for the form vocabulary of the design
 * bible and for the forests of the sandbox. Every length is a factor of the tree size `s`
 * in meters, unless named otherwise. Independent core module: imports nothing.
 */
export const TREE_FORM = {
	/** Trunk radius as a share of the size, with a lower bound in meters. */
	trunkRadius: 0.07,
	trunkRadiusMin: 0.12,
	/** Trunk height below the crown, and how far the trunk reaches into the crown. */
	trunkHeight: 0.9,
	trunkIntoCrown: 0.3,
	/** Ball tree: radius of the crown; its center sits one radius above the trunk. */
	ballRadius: 0.6,
	/** Cone tree: base radius and height of the crown. */
	coneRadius: 0.42,
	coneHeight: 1.8
} as const;

/** Trunk radius in meters for a tree of size `s`. */
export const trunkRadius = (s: number) =>
	Math.max(TREE_FORM.trunkRadiusMin, s * TREE_FORM.trunkRadius);
