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
	| 'bridge';
export type MovementPort = {
	id: string;
	kind: MovementKind;
	position: Position;
	/** Outward plan angle, radians counterclockwise from +x. */
	heading: number;
	width: number;
	headroom: number;
	accepts: readonly MovementKind[];
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
		capacity: number;
	};
};
export type MovementEdge = MovementElement & { length: number; grade: number };
