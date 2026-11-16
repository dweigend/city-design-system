/**
 * Additional contract for L10 (Townscaper principle, docs/research/80-townscaper.md §9–10).
 * Types only. Systems (eckraster/): topology, occupancy, masks, context.
 * Forms (formen/eck.ts): corner modules (geometry).
 *
 * Build cells (dual) are occupied; visible modules sit in slots (primal):
 * a quad of the main mesh between two height levels. Each of the 8 slot corners
 * corresponds to a build cell on one level; occupied = 1.
 */
import type { Point2 } from './vocab';
import type { ColorToken, Primitive, Role } from './types';

/**
 * Bit order of the mask: bottom 0–3, top 4–7, each in the corner order
 * of `Slot.corners` (counterclockwise). Bit i set = corner i occupied.
 */
export type CornerMask = number;

/** Column at vertex `corner` (center of the build cell) from z = `from` up to the slot center. */
export type Stilt = { corner: number; from: number };

export type SlotContext = {
	/** Side i (corners[i] → corners[i+1]) borders an occupied neighboring slot. */
	neighborFilled: [boolean, boolean, boolean, boolean];
	/** Free above (roof/termination needed). No effect with `centered`. */
	openAbove: boolean;
	/** Near the ground: lowest slot layer (with `centered` the ground slot −1). */
	ground: boolean;
	/** Part of a closed courtyard open to the sky (garden rule). */
	courtyard: boolean;
	/** Above a free space between two bearings (arch/bridge). */
	span: boolean;
	role: Role;

	/* ── Optional extensions (round 1). If they are missing, the old behavior applies. ── */

	/** Color of the whole slot (one group). Without the field: ink (paper surface, ink line). */
	token?: ColorToken;
	/**
	 * Color per corner bit (index 0–7 as in the mask), derived from the occupancy group.
	 * Bits of the same color form one volume; different colors meet at a joint.
	 * `null` = ink. Takes precedence over `token`.
	 */
	tokens?: (ColorToken | null)[];
	/** Corner bits that belong to existing stock (mixed slots: existing quarters gray and unchanged). */
	bestand?: CornerMask;
	/**
	 * Floors lie around the slot center (Townscaper): the level of the lower bit = zLow … zMid
	 * is its upper half, the level of the upper bit = zMid … zHigh its lower half.
	 * Floor joints and roofs then lie only on zMid, never on zLow/zHigh.
	 * A ground slot (level −1, empty below) thus carries the lower half of the ground floor.
	 */
	centered?: boolean;
	/**
	 * Corner bits whose build cell is an open walkway deck (bridge, elevated walkway). Upper bit:
	 * deck slab on zMid with parapet, beam below. Lower bit: clear space, no volume.
	 * Replaces `span` when set.
	 */
	deck?: CornerMask;
	/** Columns down to the next thing below (ground or component). Replaces the pilotis rule at the ground. */
	stilts?: Stilt[];

	/* ── Round 2: structural frame and shared components. ── */

	/**
	 * Corner bits with frame/scaffold (open strut grid). The module draws struts on the
	 * outlines of the build cell: columns at the outline corners, beams at every floor joint,
	 * diagonals in open bays. A bit can be structural frame and plug-in module (volume) at once.
	 */
	frame?: CornerMask;
	/** Corner bits that are occupied but hollow (empty frame): no volume, frame only. */
	hollow?: CornerMask;
	/**
	 * Side i belongs to this slot: shared components on the side (frame column at the
	 * middle of the side) are built only by the owner. Without the field every slot builds all sides.
	 */
	owns?: [boolean, boolean, boolean, boolean];

	/* ── Round 3: paths as an occupancy kind. ── */

	/**
	 * Corner bits whose build cell carries a path (group `weg` or `bahn`): no volume but
	 * a narrow footbridge on the cell floor. Upper bit: landing at the vertex on zMid, footbridge along
	 * every slot side to the next path bit; lower bit and upper bit of the neighboring corner: stair flight
	 * over one floor. Color per bit from `tokens`. Only with `centered`.
	 */
	weg?: CornerMask;
	/** Corner bits of new volumes: a path beside them docks with a spur footbridge up to the facade. */
	dock?: CornerMask;
	/** Columns under path landings (vertex, from `from` up to zMid). */
	wegStilts?: Stilt[];
	/**
	 * From the upper path bit of corner i a flight continues upward that this slot does not see:
	 * bit 2i along side i (toward corner i + 1), bit 2i + 1 along side i − 1 (toward corner i − 1).
	 * There the landing stays without a railing.
	 */
	wegAuf?: number;
	/** Color of the structural frame. Without the field: frame red. */
	frameToken?: ColorToken;
};

export type Slot = {
	id: string;
	/** Four corners of the (distorted) quad, counterclockwise. */
	corners: [Point2, Point2, Point2, Point2];
	/** Bottom and top edge in meters. */
	zLow: number;
	zHigh: number;
	mask: CornerMask;
	/** Context from the surroundings, computed by the system part (eckraster/). */
	context: SlotContext;
	seed: number;
};

/** The form part provides a function of this shape (export `eckModul` from formen/eck.ts). */
export type CornerModule = (slot: Slot) => Primitive[];
