/** Declarative inputs for parceling: coordinates in meters, access points and epoch drivers. */
export type Point = readonly [number, number];
export type AccessClass =
	'footway' | 'square' | 'skywalk' | 'stop' | 'green' | 'water' | 'transit' | 'party';
export type DriverSpec = { split: number; merge: number; convert: number };
export type BlockSpec = {
	id: string;
	ring: Point[];
	edges: AccessClass[];
	stops?: { edge: number; t: number }[];
};
