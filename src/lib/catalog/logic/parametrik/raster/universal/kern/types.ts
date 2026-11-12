/** Format 1: meters, radians, CCW planar faces; levels are discrete, not heights. */
export type Vec = readonly [number, number];
export type Id = string;
export type Meaning = {
	occupancy: 'empty' | 'reserved' | 'occupied';
	role: string;
	programs: readonly { level: number; use: string; height: number }[];
	protected: boolean;
};
export type Derivation = { id: Id; parent: Id | null; rule: string; children: Id[] };
export type SourceFace = {
	id: Id;
	ring: readonly Id[];
	level: number;
	parts?: readonly (readonly Id[])[];
};
export type Intent = {
	version: 1;
	seed: number;
	faces: ReadonlyMap<Id, SourceFace>;
	positions: ReadonlyMap<Id, Vec>;
	semantics: ReadonlyMap<Id, Meaning>;
	fixed: ReadonlySet<Id>;
	limits: Limits;
};
export type Limits = { minAngle: number; minJacobian: number; minArea: number; maxAspect: number };
export const defaultLimits: Limits = {
	minAngle: 1,
	minJacobian: 0.01,
	minArea: 1e-10,
	maxAspect: 1000
};
export type QuadQuality = { minAngle: number; minJacobian: number; area: number; aspect: number };
export type HalfEdge = { id: Id; origin: Id; face: Id; next: Id; prev: Id; twin: Id | null };
export type Topology = {
	faces: ReadonlyMap<Id, { id: Id; edge: Id; vertices: readonly Id[]; level: number }>;
	edges: ReadonlyMap<Id, HalfEdge>;
	incident: ReadonlyMap<Id, readonly Id[]>;
	dual: ReadonlyMap<Id, readonly Id[]>;
};
export type Chunk = {
	root: Id;
	topology: Topology;
	geometry: { positions: ReadonlyMap<Id, Vec>; quality: ReadonlyMap<Id, QuadQuality> };
	provenance: ReadonlyMap<Id, Derivation>;
};
export type Model = {
	version: 1;
	intent: Intent;
	/** Each source face is an independent derivation subtree; seams share vertex IDs. */
	chunks: ReadonlyMap<Id, Chunk>;
	semantics: ReadonlyMap<Id, Meaning>;
	dependencies: ReadonlyMap<Id, readonly Id[]>;
};
export const emptyMeaning = (): Meaning => ({
	occupancy: 'empty',
	role: 'free',
	programs: [],
	protected: false
});
export const childId = (parent: Id, rule: string, index: string | number) =>
	`${parent}/${rule}:${encodeURIComponent(String(index))}`;
export const edgeId = (a: Id, b: Id) => JSON.stringify(a < b ? [a, b] : [b, a]);
export class InvariantError extends Error {
	constructor(
		public code: string,
		public ids: readonly Id[] = []
	) {
		super(`${code}: ${ids.join(', ')}`);
	}
}
