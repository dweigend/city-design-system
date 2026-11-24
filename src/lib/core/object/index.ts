/** Module: Creates, bounds and moves objects with role slots, metric footprints and anchors. */
export { PlaceableObject, bounds, move } from './object';
export type { Anchor, Footprint, Part, Shape } from './object';

/** Creates the fixed house fixture in meters, with detached parts and anchors. */
export { example as houseExample } from './house-example';
