import type { Vec3 } from '../../core/geometry';

/** IDs are nonempty, opaque, case-sensitive strings unique within a node or edge list. */
export type MovementNode = Readonly<{
	id: string;
	position: Vec3;
	level: 'ground' | number;
}>;

/** An undirected link with caller-defined kind and positive cost, oriented from its first end.
 * Via points describe its metric centerline. Supports pair the deck and bearing positions. */
export type MovementLink<K extends string = string> = Readonly<{
	id: string;
	kind: K;
	nodeIds: readonly [string, string];
	cost: number;
	via?: readonly Vec3[];
	supports?: readonly Readonly<{ top: Vec3; base: Vec3 }>[];
}>;

/** A measured link with its complete centerline in meters. */
export type MovementEdge<K extends string = string> = MovementLink<K> &
	Readonly<{ lengthM: number; points: readonly Vec3[] }>;

/** A route in traversal order. Climb sums all positive rises in its direction. */
export type MovementRoute<K extends string = string> = Readonly<{
	nodes: readonly string[];
	edges: readonly MovementEdge<K>[];
	lengthM: number;
	climbM: number;
	cost: number;
}>;

/** An indexed, undirected graph whose kinds carry caller-defined semantics. */
export type MovementNetwork<K extends string = string> = Readonly<{
	nodes: readonly MovementNode[];
	edges: readonly MovementEdge<K>[];
	/** Returns the node at this address, if present. */
	readNode: (id: string) => MovementNode | undefined;
	/** Returns the least-cost route, or undefined when the ends are disconnected.
	 * Equal costs retain the first discovery ordered by settled cost, node ID and edge ID. */
	readRoute: (from: string, to: string) => MovementRoute<K> | undefined;
	/** Labels each node with the smallest node ID in its connected component. */
	readComponents: () => ReadonlyMap<string, string>;
}>;
