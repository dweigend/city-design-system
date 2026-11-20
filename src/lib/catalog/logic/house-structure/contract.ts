import type { HouseUse } from '../../data/house-body';
import type { Vec3 } from '../parametrik/types';

/** Plan position in world metres; heights are z in the shared `Vec3`, z up. */
export type XY = [number, number];

/**
 * The way a house carries itself. The label selects a builder and names the house in a legend.
 * It decides no geometry: nodes, rods, platforms and skins state that explicitly.
 */
export type HousePrinciple =
	'layers' | 'scaffold' | 'exoskeleton' | 'mast' | 'tower' | 'fanned-truss';

/** A load-bearing point. `founded` nodes bear on the parcel ground. */
export type StructureNode = { id: string; position: Vec3; founded?: true };

/** A straight member between two nodes. A strut takes compression; a tie only pulls. */
export type Rod = {
	id: string;
	from: string;
	to: string;
	/** Section radius in metres. */
	radius: number;
	action: 'strut' | 'tie';
};

/** Where a skin holds the structure: at a node, or at share `at` in [0, 1] along a rod. */
export type Grip = { node: string } | { rod: string; at: number };

/** Edge treatment of a skin between two neighbouring boundary grips. */
export type SkinEdge = 'seam' | 'cable' | 'free';

/** One cloth tensioned between grips. The cloth itself is solved from them, never stored. */
export type SkinPatch = {
	id: string;
	slot: 'shell' | 'screen';
	use: HouseUse;
	/** Ordered closed loop of at least three grips. */
	boundary: Grip[];
	/** Edge i runs from boundary[i] to boundary[i + 1]. Omitted edges are seams. */
	edges?: SkinEdge[];
	/** Grips inside the loop that push or pull the cloth: a mast head, an outward rod tip. */
	interior?: Grip[];
	/** Gauge pressure in kPa and in-plane tension in kN/m. */
	membrane?: { pressure: number; tension: number };
};

/** An occupied level. It exists only where the house declares one. */
export type Platform = {
	id: string;
	/** Height of the walking surface. */
	datum: number;
	/** Plate depth below the walking surface. */
	thickness: number;
	outline: XY[];
	holes?: XY[][];
	/** Nodes that carry the plate. */
	bearers: string[];
	programme: HouseUse[];
	/** An enclosed room of this clear height. Without it the platform is an open deck. */
	room?: { height: number };
};

/** One explicit way up to a platform. */
export type Access = {
	id: string;
	kind: 'ladder' | 'stair' | 'spiral' | 'ramp' | 'bridge';
	/** Platform the run starts on. Omitted: it starts on the parcel ground. */
	from?: string;
	to: string;
	foot: Vec3;
	head: Vec3;
};

/** The weather cover, when the house has one. */
export type Roof =
	| { kind: 'terrace'; platform: string }
	| { kind: 'skin'; patches: string[] }
	| { kind: 'crown'; platform: string; use: HouseUse };

/** Surveyed ground a house may occupy: one outer ring and its courts. */
export type Parcel = { polygon: XY[]; holes: XY[][] };

/**
 * One house as occupancy and structure. A layered house is one case: a platform with a room on
 * every datum. Every other field is free of that assumption.
 */
export type HouseStructure = {
	id: string;
	principle: HousePrinciple;
	/** Identity of the ensemble the house belongs to. */
	ensemble: string;
	/** Leading use. It colours members that serve no single platform. */
	use: HouseUse;
	/** Height of the parcel ground. */
	ground: number;
	parcel: Parcel;
	nodes: StructureNode[];
	rods: Rod[];
	platforms: Platform[];
	skins: SkinPatch[];
	access: Access[];
	roof?: Roof;
};
