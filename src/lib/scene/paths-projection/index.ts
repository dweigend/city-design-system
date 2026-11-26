/** Module: Projects movement routes, walkways and transit lines through shared surfaces. */
/** Projects movement centerlines into ground traces, decks, bearing columns and stairs. */
export { paths as projectMovement } from './walking';
/** Projects a route and its two endpoints in the same local frame as the movement network. */
export { highlight as projectMovementRoute } from './walking';
/** Projects a rail alignment, foundations and platform bodies through the object contract. */
export { guideway as projectTransitLine } from './rail';
export type {
	/** How a movement kind should be drawn. */
	MovementDrawing,
	/** World-to-local transform and metric footprint supplied by the scene that hosts the paths. */
	PathsFrame
} from './types';
/** Styles the path and rail drawings with the same focus selection as the city. */
export { pathsPresentation } from './presentation';

/** The chapter's composed focus policy and selection. */
export {
	/** The Paths composition includes city context, measured lanes, upper paths and transit. */
	pathsFocusPreset,
	/** A selectable focus in the Paths composition. */
	type PathsFocusChoice
} from './focus';

/** Assigns the shared access and rail surfaces to registered objects. */
export {
	/** Colors and finishes for walkway decks, stairs, and bearings. */
	accessSurfaces,
	/** Resolves a registered access or rail object's roles with the Paths palette. */
	projectPathAsset,
	/** Colors and finishes of rail components by slot. */
	railSurfaces
} from './surfaces';

export {
	/** Projects an elevated deck with a glazed enclosure and path-colored ribs. */
	projectWalkableTube,
	/** Projects a compact utility run and flow-colored fittings. */
	projectServicePipe,
	/** Applies normal or transparency visibility without rebuilding service geometry. */
	paintServicePipe,
	/** Optional roll constraints and contact stations on the supplied centerline. */
	type TubeAttachments,
	/** Functional palette roles available to a building service pipe. */
	type ServicePipeFlow,
	/** Frozen slot geometry alongside the projected drawables. */
	type TubeProjection
} from './tubes';
