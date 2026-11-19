import { houseStair } from '../../data/house-stair';
import type { HouseObstacle } from '../composed-house';
import type { ObjectGeometry } from '../assets';

export type Point = [number, number];
export type Position = HouseObstacle['position'];
export const width = houseStair.width;
export const epsilon = 1e-8;
export type NetworkInput = {
	houses: readonly {
		id: string;
		entrance: Point;
		ports?: readonly Position[];
		obstacles: readonly HouseObstacle[];
	}[];
	/** Convex water/forest cell outlines, clockwise or counterclockwise. */
	blockedCells: readonly (readonly Point[])[];
	terrain: (x: number, y: number) => number;
	/** Ensemble area in square metres and optional absolute height of its common sole. */
	ensembleArea: number;
	datum?: number;
};
export type Segment = { a: Point; b: Point };
export type Edge = {
	id: string;
	from: string;
	to: string;
	kind: 'ground' | 'deck' | 'stair' | 'ramp';
	points: Position[];
};
export type Network = {
	nodes: {
		id: string;
		position: Position;
		kind: 'entrance' | 'port' | 'fork' | 'plaza' | 'bend' | 'stair' | 'ramp';
		houses: string[];
	}[];
	edges: Edge[];
	geometry: (ObjectGeometry & { slot: 'frame' | 'access' | 'deck' })[];
	length: number;
	planArea: number;
	entranceMst: number;
};
