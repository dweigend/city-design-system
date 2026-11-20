/** Coordinates are world metres with z up. A port's level is position[2]. */
export type Position = readonly [number, number, number];
export type MovementKind =
	| 'court'
	| 'entrance'
	| 'path'
	| 'walkway'
	| 'tunnel'
	| 'monorail'
	| 'station'
	| 'stair'
	| 'ramp'
	| 'bridge'
	| 'junction';
export type MovementPort = {
	id: string;
	kind: MovementKind;
	position: Position;
	/** Outward plan angle, radians counterclockwise from +x. */
	heading: number;
	width: number;
	headroom: number;
	accepts: readonly MovementKind[];
	/** Surveyed ground dock with a level square and the three terrain stations at its apron toe. */
	groundLanding?: { depth: number; toe: readonly Position[] };
	/** Boundary arcs between the mouths of a surveyed common landing, in plan metres. */
	rim?: readonly (readonly (readonly [number, number])[])[];
};
/** A surveyed bidirectional element. Intermediate samples preserve bends and slopes. */
export type MovementElement = {
	id: string;
	from: string;
	to: string;
	kind: MovementKind | 'dock';
	mode: 'walk' | 'rail';
	/** Travellers per minute, supplied by the generator. */
	capacity: number;
	via?: readonly Position[];
	width?: number;
	/** Unit plan normals at each centreline sample preserve the analytic sweep at bends. */
	normals?: readonly (readonly [number, number])[];
	guardGroup?: string;
};
export type DockRequest = {
	/** Defaults to a walking connection. Stations may expose either mode. */
	mode?: MovementElement['mode'];
	id: string;
	from: string;
	to: string;
	profile: {
		width: number;
		headroom: number;
		rampGrade: number;
		stairGrade: number;
		/** Minimum horizontal depth per tread in metres when fitting stock stairs. */
		treadGoing?: number;
		capacity: number;
	};
};
export type MovementEdge = MovementElement & { length: number; grade: number; width: number };
