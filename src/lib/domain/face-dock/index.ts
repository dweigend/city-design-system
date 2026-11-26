/** Module: Seats placeable modules and visible collars on exposed city lattice faces. */
export {
	/** Builds a socket on a convex planar polygon wound toward the free side. */
	createFaceSocket,
	/** Reads planar supporting sockets from the singly incident faces of a city lattice. */
	readLatticeFaceSockets,
	/** A keyed convex planar polygon in world meters, wound toward the free side. */
	type DockFace,
	/** A face's contact polygon, dimensions and right-handed frame in world meters. */
	type FaceSocket
} from './socket';

export {
	/** Seats a rectangular module of the supplied dimensions on a socket. */
	createDockedModule,
	/** Seats a local placeable object on a socket and checks the occupied bounds. */
	fitDockedModule,
	/** The placed object and collision bounds, or the reason the candidate was rejected. */
	type DockFit,
	/** Dimensions in socket-local meters for a rectangular module. */
	type DockModuleSpec,
	/** Occupancy already reserved in the same world coordinates. */
	type DockOptions
} from './placement';
