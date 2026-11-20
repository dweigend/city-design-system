import type { HouseEnvelope } from './envelope';
import type { Survey } from './survey';
import type { HouseSite, HouseSlot, Deck } from './site';
import type { buildObject, ObjectGeometry } from '../assets';
import type { Typology, HouseRole } from './families';
export type Plan = {
	site: Survey;
	type: Typology;
	seed: number;
	sign: number;
	datum: number;
	rear: number;
	away: [number, number];
	bar: number;
};
export type FitPart = (ObjectGeometry | ReturnType<typeof buildObject>['parts'][number]) &
	FitMetadata;
export type Point = HouseSlot['position'];
export type { Deck } from './site';
export type Joint =
	| 'deck'
	| 'service'
	| 'body'
	| 'capsule'
	| 'socket'
	| 'foot'
	| 'shaft'
	| 'head'
	| 'brace'
	| 'beam'
	| 'attic'
	| 'crown';
export type FitMetadata = {
	joint?: Joint;
	ground?: number;
	nativeSize?: Point;
	scale?: Point;
	source?: { objectId: string; variant: string; member?: number; seed?: number };
};
/** Assembly envelopes carry registry dimensions and functional slots, independent of dressing. */
type AssemblyShape = Extract<
	ObjectGeometry,
	{ kind: 'box' | 'mesh' | 'cylinder' | 'cone' | 'prism' }
>;
export type StructuralRole = 'bearing' | 'cantilever';
export type Occupant = { structuralRole: 'occupant'; carrier: string };
export type Solid = AssemblyShape &
	FitMetadata & { structuralRole: StructuralRole; joint: Joint; ground: number; size: Point };
export type Block = Extract<Solid, { kind: 'box' }>;
/** Size is occupied local geometry. A capsule bay is its nominal 1.25 m plan-grid reservation. */
export type Body = HouseSlot & {
	structuralRole: StructuralRole;
	objectId: string;
	variant: string;
	seed: number;
	rotation: number;
	scale: number;
	nativeSize: Point;
	nativeCenter: Point;
	bay?: [number, number];
	band?: {
		cells?: HouseSite['cells'];
		finish?: HouseEnvelope['finish'];
		skin?: HouseEnvelope['skin'];
		wellX?: number;
		lining?: [number, number][];
		footprint?: { polygon: [number, number][]; holes: [number, number][][] };
		modules?: Point;
		plinth?: boolean;
		shell: boolean;
		court?: { center: Point; width: number };
	};
};
export type Level = Deck & {
	bodies: Body[];
	landing: Point;
	deckArea: number;
	outline: Point[];
	field?: boolean;
	well?: Point[];
	void?: Point[];
	court?: { center: Point; width: number };
};
export type Port = { level: number; position: Point };
export type HouseComposition = {
	exterior?: ReturnType<typeof import('./parcel-section').parcelExterior>;
	flightWidth: number;
	signature: ReturnType<typeof import('./signature').silhouette>;
	path: ReturnType<typeof import('./routes').housePath>;
	id: string;
	compact: boolean;
	bay: { x: number; y: number; width: number; depth: number };
	start: number;
	stories: number;
	role: HouseRole;
	/** Number of houses planned together; a standalone house is an ensemble of one. */
	ensembleSize: number;
	shellUse: HouseSlot['use'];
	sharedRoof?: 'head' | 'terrace';
	typology: Typology;
	cells: HouseSite['cells'];
	datum: number;
	ground: number;
	accessSide: 'north' | 'south';
	family: { radius: number; bar: number; parapet: 'rail' | 'panel' };
	core: { position: Point; width: number };
	levels: Level[];
	supports: Solid[];
	parts: Solid[];
	crown: Body;
	fittings: Body[];
	ports: Port[];
	people: (Occupant & { position: Point; height: number; level: number; count: number })[];
};
export type Bridge = {
	a: string;
	b: string;
	portA: Port;
	portB: Port;
	from: Point;
	to: Point;
	span: number;
	pier?: Point;
	kind: 'walkway' | 'platform' | 'bridge-house';
};
