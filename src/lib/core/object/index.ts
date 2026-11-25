/** Module: Creates, bounds and moves objects with role slots, metric footprints and anchors. */
export {
	/** Placeable geometry with ordered slots, parts and anchors. */
	PlaceableObject,
	/** Returns detached world bounds of the parts in meters. */
	bounds,
	/** Rotates about the world Z axis in radians, then translates in meters. */
	move
} from './object';
export type {
	/** A named attachment in meters with a unitless outward direction. */
	Anchor,
	/** Ground dimensions in meters along the object's local axes. */
	Footprint,
	/** One shape with an object-local identity and a named slot. */
	Part,
	/** Metric geometry in XY ground and Z up. */
	Shape
} from './object';

/** Creates the fixed house fixture in meters, with detached parts and anchors. */
export { example as houseExample } from './house-example';
