import type { AccessClass } from '../../data/parzelle';
export type { AccessClass, BlockSpec, DriverSpec, Point } from '../../data/parzelle';

export const STATE_FORMAT = 'parzelle/1';
export const GENERATOR_VERSION = 1;
export type PublicUse = 'commons' | 'passage' | 'hub';
export type PrivateUse = 'living' | 'work' | 'farm' | 'mixed';
export type ParcelUse = PublicUse | PrivateUse;
export type Vertex = { id: string; x: number; y: number };
export type BoundaryEdge = { from: string; to: string; access: AccessClass };
export type Parcel = {
	id: string;
	ring: string[];
	use: ParcelUse;
	bornEpoch: number;
	parents: string[];
	isProtected: boolean;
};
export type ErrorCode =
	| 'invalid-seed'
	| 'invalid-ring'
	| 'not-ccw'
	| 'skeleton-event'
	| 'landlocked-block'
	| 'nonconvex'
	| 'degenerate-split'
	| 'protected'
	| 'public-parcel'
	| 'not-adjacent'
	| 'merge-not-simple'
	| 'unknown-parcel'
	| 'size-rule'
	| 'no-access';
export type Outcome<T> = { ok: true; value: T } | { ok: false; code: ErrorCode; detail: string };
export type EventRecord = {
	epoch: number;
	kind: 'split' | 'merge' | 'convert' | 'reject';
	parcelIds: string[];
	resultIds: string[];
	code?: ErrorCode;
};
export type ParcelState = {
	format: typeof STATE_FORMAT;
	generatorVersion: number;
	seed: number;
	blockId: string;
	epoch: number;
	vertices: Vertex[];
	boundary: BoundaryEdge[];
	parcels: Parcel[];
	log: EventRecord[];
};
export type ParcelRules = {
	frontTarget: number;
	frontMin: number;
	areaMin: number;
	depthMin: number;
	irregularity: number;
	passageWidth: number;
	commonsAreaMin: number;
	stopFront: number;
	stripDepth?: Partial<Record<AccessClass, number>>;
};
export const ACCESS_CLASSES: Record<
	AccessClass,
	{ grantsAccess: boolean; levels: number[]; stripDepth: number }
> = {
	footway: { grantsAccess: true, levels: [0], stripDepth: 14 },
	square: { grantsAccess: true, levels: [0], stripDepth: 16 },
	skywalk: { grantsAccess: true, levels: [1], stripDepth: 10 },
	stop: { grantsAccess: true, levels: [0, 1], stripDepth: 18 },
	green: { grantsAccess: true, levels: [0], stripDepth: 12 },
	water: { grantsAccess: false, levels: [], stripDepth: 0 },
	transit: { grantsAccess: false, levels: [], stripDepth: 0 },
	party: { grantsAccess: false, levels: [], stripDepth: 0 }
};
// depthMin is reserved: the specified size rules check only area and frontage.
export const DEFAULT_RULES: ParcelRules = {
	frontTarget: 9,
	frontMin: 5,
	areaMin: 60,
	depthMin: 6,
	irregularity: 0.5,
	passageWidth: 3,
	commonsAreaMin: 150,
	stopFront: 24
};
export const PRIVATE_USES: PrivateUse[] = ['living', 'work', 'farm', 'mixed'];
/** Detects public use without side effects; dimensionless, no error. */
export function isPublic(use: ParcelUse): boolean {
	return use === 'commons' || use === 'passage' || use === 'hub';
}
/** Creates an error without state; inputs stay unchanged. */
export function failure(
	code: ErrorCode,
	detail: string = code
): { ok: false; code: ErrorCode; detail: string } {
	return { ok: false, code, detail };
}
/** Fully detaches the state and sorts ID sets lexicographically; rings/log stay ordered. */
export function canonical(state: ParcelState): ParcelState {
	const copy = structuredClone(state);
	copy.vertices.sort(byId);
	copy.parcels.sort(byId);
	return copy;
}
/** Stable, language-independent ID order; no error, no mutation. */
export function byId(a: { id: string }, b: { id: string }): number {
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
