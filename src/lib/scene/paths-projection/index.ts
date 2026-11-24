/** Module: Projects movement routes, walkways and transit lines through shared surfaces. */
/** Projects movement centerlines into ground traces, decks, bearing columns and stairs. */
export { paths as projectMovement } from './walking';
/** Projects a route and its two endpoints in the same local frame as the movement network. */
export { highlight as projectMovementRoute } from './walking';
/** Projects a rail alignment, foundations and platform bodies through the object contract. */
export { guideway as projectTransitLine } from './rail';
export type { MovementDrawing, PathsFrame } from './types';
/** Styles the path and rail drawings with the same focus selection as the city. */
export { pathsPresentation } from './presentation';

/** The chapter's composed focus policy and selection. */
export { pathsFocusPreset, type PathsFocusChoice } from './focus';

/** Assigns Paths surfaces to registered movement and rail objects. */
export { projectPathAsset } from './surfaces';
